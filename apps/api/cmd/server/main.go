package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"

	"github.com/opencord/api/internal/auth"
	"github.com/opencord/api/internal/channel"
	"github.com/opencord/api/internal/database"
	"github.com/opencord/api/internal/instance"
	"github.com/opencord/api/internal/invite"
	"github.com/opencord/api/internal/keys"
	"github.com/opencord/api/internal/member"
	"github.com/opencord/api/internal/message"
	"github.com/opencord/api/internal/upload"
	"github.com/opencord/api/internal/user"
	"github.com/opencord/api/internal/ws"
)

func main() {
	// Config from env
	databaseURL := getEnv("DATABASE_URL", "postgres://opencord:opencord@localhost:5432/opencord?sslmode=disable")
	jwtSecret := getEnv("JWT_SECRET", "dev-secret-change-me")
	port := getEnv("PORT", "8080")
	uploadPath := getEnv("UPLOAD_PATH", "./uploads")
	instanceURL := getEnv("INSTANCE_URL", "http://localhost:"+port)

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

	// Repositories
	authRepo := auth.NewPostgresRepository(db)
	userRepo := user.NewPostgresRepository(db)
	channelRepo := channel.NewPostgresRepository(db)
	messageRepo := message.NewPostgresRepository(db)
	memberRepo := member.NewPostgresRepository(db)
	inviteRepo := invite.NewPostgresRepository(db)
	instanceRepo := instance.NewPostgresRepository(db)
	keysRepo := keys.NewPostgresRepository(db)

	// Services
	authService := auth.NewService(authRepo, jwtSecret)

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Handlers
	authHandler := auth.NewHandler(authService)
	userHandler := user.NewHandler(userRepo)
	channelHandler := channel.NewHandler(channelRepo)
	messageHandler := message.NewHandler(messageRepo, hub)
	memberHandler := member.NewHandler(memberRepo)
	inviteHandler := invite.NewHandler(inviteRepo, memberRepo)
	instanceHandler := instance.NewHandler(instanceRepo)
	uploadHandler := upload.NewHandler(uploadPath, instanceURL)
	keysHandler := keys.NewHandler(keysRepo)

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

	// Serve uploaded files
	fileServer := http.FileServer(http.Dir(uploadPath))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", fileServer))

	// Public routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/instance", instanceHandler.GetInfo)

		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.Refresh)
		})

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(authHandler.Middleware)

			r.Delete("/auth/logout", authHandler.Logout)

			r.Get("/users/me", userHandler.GetMe)
			r.Patch("/users/me", userHandler.UpdateMe)

			r.Post("/channels", channelHandler.Create)
			r.Get("/channels", channelHandler.List)
			r.Get("/channels/{id}", channelHandler.Get)
			r.Patch("/channels/{id}", channelHandler.Update)
			r.Delete("/channels/{id}", channelHandler.Delete)

			r.Get("/channels/{id}/messages", messageHandler.List)
			r.Post("/channels/{id}/messages", messageHandler.Create)
			r.Patch("/messages/{id}", messageHandler.Update)
			r.Delete("/messages/{id}", messageHandler.Delete)

			r.Post("/invites", inviteHandler.Create)
			r.Get("/invites", inviteHandler.List)
			r.Post("/invites/{code}/join", inviteHandler.Join)

			r.Get("/members", memberHandler.List)
			r.Delete("/members/{userId}", memberHandler.Kick)
			r.Patch("/members/{userId}", memberHandler.UpdateRole)

			r.Post("/upload", uploadHandler.Upload)

			r.Post("/keys/upload", keysHandler.Upload)
			r.Get("/keys/query", keysHandler.Query)
			r.Post("/keys/claim", keysHandler.Claim)
		})
	})

	// WebSocket (auth via query param)
	r.Get("/api/ws", ws.HandleWebSocket(hub, func(token string) (uuid.UUID, error) {
		claims, err := authService.ValidateAccessToken(token)
		if err != nil {
			return uuid.UUID{}, err
		}
		return claims.UserID, nil
	}))

	log.Printf("OpenCord API starting on :%s", port)
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
