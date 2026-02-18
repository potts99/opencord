package auth

import (
	"time"

	"github.com/google/uuid"
)

// TokenClaims holds the claims extracted from a JWT (both central and local auth).
type TokenClaims struct {
	UserID      uuid.UUID
	Username    string
	DisplayName string
	AvatarURL   *string
}

type contextKey string

const UserContextKey contextKey = "user"
const ClaimsContextKey contextKey = "claims"

// Local auth request/response types

type RegisterRequest struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Password    string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type AuthResponse struct {
	AccessToken  string       `json:"accessToken"`
	RefreshToken string       `json:"refreshToken"`
	User         UserResponse `json:"user"`
}

type UserResponse struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	AvatarURL   *string   `json:"avatarUrl"`
	CreatedAt   time.Time `json:"createdAt"`
}
