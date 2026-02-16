package auth

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID
	Email        string
	Username     string
	DisplayName  string
	AvatarURL    *string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type RefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
}

type Repository interface {
	CreateUser(email, username, displayName, passwordHash string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	UpdateUser(id uuid.UUID, req UpdateUserRequest) (*User, error)
	CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) error
	GetRefreshToken(tokenHash string) (*RefreshToken, error)
	DeleteRefreshToken(tokenHash string) error
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) CreateUser(email, username, displayName, passwordHash string) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		`INSERT INTO users (email, username, display_name, password_hash)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, email, username, display_name, avatar_url, password_hash, created_at, updated_at`,
		email, username, displayName, passwordHash,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.AvatarURL, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *PostgresRepository) GetUserByEmail(email string) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		`SELECT id, email, username, display_name, avatar_url, password_hash, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.AvatarURL, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *PostgresRepository) GetUserByID(id uuid.UUID) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		`SELECT id, email, username, display_name, avatar_url, password_hash, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.AvatarURL, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *PostgresRepository) UpdateUser(id uuid.UUID, req UpdateUserRequest) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		`UPDATE users SET
			display_name = COALESCE($2, display_name),
			avatar_url = COALESCE($3, avatar_url),
			updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, email, username, display_name, avatar_url, password_hash, created_at, updated_at`,
		id, req.DisplayName, req.AvatarURL,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.AvatarURL, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *PostgresRepository) CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.Exec(
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	return err
}

func (r *PostgresRepository) GetRefreshToken(tokenHash string) (*RefreshToken, error) {
	rt := &RefreshToken{}
	err := r.db.QueryRow(
		`SELECT id, user_id, token_hash, expires_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.CreatedAt)
	if err != nil {
		return nil, err
	}
	return rt, nil
}

func (r *PostgresRepository) DeleteRefreshToken(tokenHash string) error {
	_, err := r.db.Exec(`DELETE FROM refresh_tokens WHERE token_hash = $1`, tokenHash)
	return err
}
