package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/opencord/auth/internal/auth"
	"github.com/opencord/auth/internal/database"
)

func main() {
	// Config from env
	databaseURL := getEnv("DATABASE_URL", "postgres://opencord:opencord@localhost:5432/opencord_auth?sslmode=disable")
	port := getEnv("PORT", "9090")
	keyDir := getEnv("KEY_DIR", "./keys")
	issuer := getEnv("ISSUER", "http://localhost:9090")

	// Database
	db, err := database.Connect(databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.RunMigrations(db, "migrations"); err != nil {
		log.Printf("migration warning: %v", err)
	}

	// ES256 key pair
	keyPair, err := auth.LoadOrGenerateKeyPair(keyDir)
	if err != nil {
		log.Fatalf("failed to load key pair: %v", err)
	}
	log.Printf("loaded ES256 key pair (kid: %s)", keyPair.KID)

	// Repository & service
	authRepo := auth.NewPostgresRepository(db)
	authService := auth.NewService(authRepo, keyPair, issuer)

	// Handler
	authHandler := auth.NewHandler(authService)

	// Router
	r := chi.NewRouter()

	// Middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// JWKS endpoint (public, well-known)
	r.Get("/.well-known/jwks.json", auth.JWKSHandler(keyPair))

	// Public auth routes
	r.Route("/api", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.Refresh)
		})

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(authHandler.Middleware)

			r.Delete("/auth/logout", authHandler.Logout)
			r.Get("/users/me", authHandler.GetMe)
			r.Patch("/users/me", authHandler.UpdateMe)
		})
	})

	log.Printf("OpenCord Auth starting on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
