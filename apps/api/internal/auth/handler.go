package auth

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct {
	validator TokenValidator
	localAuth *LocalAuthService   // nil in central mode
	userRepo  UserCacheRepository // nil in local mode
}

// UserCacheRepository is implemented by user.PostgresRepository to upsert from JWT claims.
type UserCacheRepository interface {
	UpsertFromClaims(claims *TokenClaims) error
}

func NewCentralHandler(svc *CentralAuthService, userRepo UserCacheRepository) *Handler {
	return &Handler{validator: svc, userRepo: userRepo}
}

func NewLocalHandler(svc *LocalAuthService) *Handler {
	return &Handler{validator: svc, localAuth: svc}
}

// IsLocalAuth returns true when the instance handles auth locally.
func (h *Handler) IsLocalAuth() bool {
	return h.localAuth != nil
}

// ValidateToken validates a token string using the configured validator.
func (h *Handler) ValidateToken(token string) (*TokenClaims, error) {
	return h.validator.ValidateAccessToken(token)
}

// Middleware authenticates requests using Bearer tokens.
// Works for both central auth (ES256/JWKS) and local auth (HS256).
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

		claims, err := h.validator.ValidateAccessToken(parts[1])
		if err != nil {
			writeError(w, "invalid token", http.StatusUnauthorized)
			return
		}

		// Upsert user cache only in central mode (local mode users are already in the DB)
		if h.userRepo != nil {
			if err := h.userRepo.UpsertFromClaims(claims); err != nil {
				writeError(w, "failed to sync user", http.StatusInternalServerError)
				return
			}
		}

		ctx := r.Context()
		ctx = SetUserContext(ctx, claims.UserID)
		ctx = SetClaimsContext(ctx, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Register handles POST /api/auth/register (local auth only).
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Username == "" || req.Password == "" {
		writeError(w, "email, username, and password are required", http.StatusBadRequest)
		return
	}

	if req.DisplayName == "" {
		req.DisplayName = req.Username
	}

	resp, err := h.localAuth.Register(req)
	if err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, resp, http.StatusCreated)
}

// Login handles POST /api/auth/login (local auth only).
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, "email and password are required", http.StatusBadRequest)
		return
	}

	resp, err := h.localAuth.Login(req)
	if err != nil {
		writeError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	writeJSON(w, resp, http.StatusOK)
}

// Refresh handles POST /api/auth/refresh (local auth only).
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.RefreshToken == "" {
		writeError(w, "refresh token is required", http.StatusBadRequest)
		return
	}

	resp, err := h.localAuth.RefreshTokens(req.RefreshToken)
	if err != nil {
		writeError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	writeJSON(w, resp, http.StatusOK)
}

// Logout handles DELETE /api/auth/logout (local auth only).
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	_ = h.localAuth.Logout(req.RefreshToken)
	w.WriteHeader(http.StatusNoContent)
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
