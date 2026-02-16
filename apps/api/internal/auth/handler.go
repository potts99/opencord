package auth

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct {
	service  *Service
	userRepo UserCacheRepository
}

// UserCacheRepository is implemented by user.PostgresRepository to upsert from JWT claims.
type UserCacheRepository interface {
	UpsertFromClaims(claims *TokenClaims) error
}

func NewHandler(service *Service, userRepo UserCacheRepository) *Handler {
	return &Handler{service: service, userRepo: userRepo}
}

// Middleware authenticates requests using Bearer tokens from the central auth server.
// It validates the ES256 JWT, upserts the user cache, and stores claims in context.
func (h *Handler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, "authorization header required", http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeError(w, "invalid authorization header", http.StatusUnauthorized)
			return
		}

		claims, err := h.service.ValidateAccessToken(parts[1])
		if err != nil {
			writeError(w, "invalid token", http.StatusUnauthorized)
			return
		}

		// Upsert user into local cache table so JOINs work
		if err := h.userRepo.UpsertFromClaims(claims); err != nil {
			writeError(w, "failed to sync user", http.StatusInternalServerError)
			return
		}

		ctx := r.Context()
		ctx = SetUserContext(ctx, claims.UserID)
		ctx = SetClaimsContext(ctx, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{"data": data})
}

func writeError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
