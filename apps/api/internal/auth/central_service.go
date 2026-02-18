package auth

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var ErrInvalidToken = errors.New("invalid token")

// CentralAuthService validates JWTs issued by the central auth server using JWKS.
type CentralAuthService struct {
	jwks *JWKSClient
}

func NewCentralAuthService(jwks *JWKSClient) *CentralAuthService {
	return &CentralAuthService{jwks: jwks}
}

func (s *CentralAuthService) ValidateAccessToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("missing kid in token header")
		}

		return s.jwks.GetKey(kid)
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	userIDStr, ok := claims["sub"].(string)
	if !ok {
		return nil, ErrInvalidToken
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, ErrInvalidToken
	}

	tc := &TokenClaims{UserID: userID}
	if username, ok := claims["username"].(string); ok {
		tc.Username = username
	}
	if displayName, ok := claims["display_name"].(string); ok {
		tc.DisplayName = displayName
	}
	if avatarURL, ok := claims["avatar_url"].(string); ok {
		tc.AvatarURL = &avatarURL
	}

	return tc, nil
}
