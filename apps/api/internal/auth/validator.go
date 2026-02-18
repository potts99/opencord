package auth

// TokenValidator validates access tokens and returns claims.
// Implemented by both CentralAuthService (ES256/JWKS) and LocalAuthService (HS256).
type TokenValidator interface {
	ValidateAccessToken(tokenString string) (*TokenClaims, error)
}
