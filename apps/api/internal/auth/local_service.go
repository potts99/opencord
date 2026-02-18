package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// LocalAuthService handles registration, login, and HS256 JWT validation for standalone instances.
type LocalAuthService struct {
	repo      Repository
	jwtSecret []byte
}

func NewLocalAuthService(repo Repository, jwtSecret string) *LocalAuthService {
	return &LocalAuthService{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
	}
}

func (s *LocalAuthService) Register(req RegisterRequest) (*AuthResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user, err := s.repo.CreateUser(req.Email, req.Username, req.DisplayName, string(hash))
	if err != nil {
		return nil, err
	}

	return s.generateTokens(user)
}

func (s *LocalAuthService) Login(req LoginRequest) (*AuthResponse, error) {
	user, err := s.repo.GetUserByEmail(req.Email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	if user.PasswordHash == nil {
		return nil, errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	return s.generateTokens(user)
}

func (s *LocalAuthService) RefreshTokens(refreshToken string) (*AuthResponse, error) {
	tokenHash := hashToken(refreshToken)

	stored, err := s.repo.GetRefreshToken(tokenHash)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	if stored.ExpiresAt.Before(time.Now()) {
		_ = s.repo.DeleteRefreshToken(stored.ID)
		return nil, errors.New("refresh token expired")
	}

	// Rotate: delete old token
	_ = s.repo.DeleteRefreshToken(stored.ID)

	user, err := s.repo.GetUserByID(stored.UserID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	return s.generateTokens(user)
}

func (s *LocalAuthService) Logout(refreshToken string) error {
	tokenHash := hashToken(refreshToken)
	stored, err := s.repo.GetRefreshToken(tokenHash)
	if err != nil {
		return nil // Already invalid, treat as success
	}
	return s.repo.DeleteRefreshToken(stored.ID)
}

func (s *LocalAuthService) ValidateAccessToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
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

func (s *LocalAuthService) generateTokens(user *LocalUser) (*AuthResponse, error) {
	now := time.Now()
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":          user.ID.String(),
		"username":     user.Username,
		"display_name": user.DisplayName,
		"avatar_url":   user.AvatarURL,
		"iat":          now.Unix(),
		"exp":          now.Add(15 * time.Minute).Unix(),
	})

	accessTokenString, err := accessToken.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	refreshTokenID := uuid.New().String()
	refreshTokenHash := hashToken(refreshTokenID)
	expiresAt := now.Add(7 * 24 * time.Hour)

	if err := s.repo.CreateRefreshToken(user.ID, refreshTokenHash, expiresAt); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenID,
		User: UserResponse{
			ID:          user.ID,
			Email:       user.Email,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			CreatedAt:   user.CreatedAt,
		},
	}, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
