package auth

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// LocalUser is the full user row used by local auth (includes password_hash).
type LocalUser struct {
	ID           uuid.UUID
	Email        string
	Username     string
	DisplayName  string
	AvatarURL    *string
	PasswordHash *string
	CreatedAt    time.Time
}

// StoredRefreshToken is a refresh token row.
type StoredRefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// Repository defines data access for local auth (users + refresh tokens).
type Repository interface {
	CreateUser(email, username, displayName, passwordHash string) (*LocalUser, error)
	GetUserByEmail(email string) (*LocalUser, error)
	GetUserByID(id uuid.UUID) (*LocalUser, error)
	CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) error
	GetRefreshToken(tokenHash string) (*StoredRefreshToken, error)
	DeleteRefreshToken(id uuid.UUID) error
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) CreateUser(email, username, displayName, passwordHash string) (*LocalUser, error) {
	u := &LocalUser{}
	err := r.db.QueryRow(
		`INSERT INTO users (email, username, display_name, password_hash)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, email, username, display_name, avatar_url, password_hash, created_at`,
		email, username, displayName, passwordHash,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *PostgresRepository) GetUserByEmail(email string) (*LocalUser, error) {
	u := &LocalUser{}
	err := r.db.QueryRow(
		`SELECT id, email, username, display_name, avatar_url, password_hash, created_at
		 FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *PostgresRepository) GetUserByID(id uuid.UUID) (*LocalUser, error) {
	u := &LocalUser{}
	err := r.db.QueryRow(
		`SELECT id, email, username, display_name, avatar_url, password_hash, created_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *PostgresRepository) CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.Exec(
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	return err
}

func (r *PostgresRepository) GetRefreshToken(tokenHash string) (*StoredRefreshToken, error) {
	t := &StoredRefreshToken{}
	err := r.db.QueryRow(
		`SELECT id, user_id, token_hash, expires_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`, tokenHash,
	).Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *PostgresRepository) DeleteRefreshToken(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM refresh_tokens WHERE id = $1`, id)
	return err
}
