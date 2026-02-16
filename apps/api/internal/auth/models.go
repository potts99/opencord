package auth

import "github.com/google/uuid"

// TokenClaims holds the claims extracted from a central auth JWT.
type TokenClaims struct {
	UserID      uuid.UUID
	Username    string
	DisplayName string
	AvatarURL   *string
}

type contextKey string

const UserContextKey contextKey = "user"
const ClaimsContextKey contextKey = "claims"
