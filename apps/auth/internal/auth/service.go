package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already taken")
	ErrUsernameTaken      = errors.New("username already taken")
	ErrInvalidToken       = errors.New("invalid token")
)

type Service struct {
	repo    Repository
	keyPair *KeyPair
	issuer  string
}

func NewService(repo Repository, keyPair *KeyPair, issuer string) *Service {
	return &Service{repo: repo, keyPair: keyPair, issuer: issuer}
}

func (s *Service) Register(req RegisterRequest) (*AuthResponse, error) {
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

func (s *Service) Login(req LoginRequest) (*AuthResponse, error) {
	user, err := s.repo.GetUserByEmail(req.Email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.generateTokens(user)
}

func (s *Service) RefreshTokens(refreshToken string) (*AuthResponse, error) {
	tokenHash := hashToken(refreshToken)

	rt, err := s.repo.GetRefreshToken(tokenHash)
	if err != nil {
		return nil, ErrInvalidToken
	}

	if time.Now().After(rt.ExpiresAt) {
		return nil, ErrInvalidToken
	}

	user, err := s.repo.GetUserByID(rt.UserID)
	if err != nil {
		return nil, err
	}

	// Delete old refresh token (rotation)
	_ = s.repo.DeleteRefreshToken(tokenHash)

	return s.generateTokens(user)
}

func (s *Service) Logout(refreshToken string) error {
	tokenHash := hashToken(refreshToken)
	return s.repo.DeleteRefreshToken(tokenHash)
}

func (s *Service) ValidateAccessToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.keyPair.PublicKey, nil
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

func (s *Service) GetUserByID(id uuid.UUID) (*User, error) {
	return s.repo.GetUserByID(id)
}

func (s *Service) UpdateUser(id uuid.UUID, req UpdateUserRequest) (*User, error) {
	return s.repo.UpdateUser(id, req)
}

func (s *Service) generateTokens(user *User) (*AuthResponse, error) {
	// Access token — ES256, 15 minutes
	now := time.Now()
	tokenClaims := jwt.MapClaims{
		"iss":          s.issuer,
		"sub":          user.ID.String(),
		"exp":          now.Add(15 * time.Minute).Unix(),
		"iat":          now.Unix(),
		"username":     user.Username,
		"display_name": user.DisplayName,
	}
	if user.AvatarURL != nil {
		tokenClaims["avatar_url"] = *user.AvatarURL
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodES256, tokenClaims)
	accessToken.Header["kid"] = s.keyPair.KID
	accessTokenString, err := accessToken.SignedString(s.keyPair.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token — random 32 bytes
	refreshTokenBytes := make([]byte, 32)
	if _, err := rand.Read(refreshTokenBytes); err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}
	refreshTokenString := hex.EncodeToString(refreshTokenBytes)

	// Store hashed refresh token
	tokenHash := hashToken(refreshTokenString)
	expiresAt := now.Add(30 * 24 * time.Hour) // 30 days
	if err := s.repo.CreateRefreshToken(user.ID, tokenHash, expiresAt); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
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
