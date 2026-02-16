package user

import (
	"database/sql"

	"github.com/google/uuid"
	"github.com/opencord/api/internal/auth"
)

type Repository interface {
	GetByID(id uuid.UUID) (*User, error)
	Update(id uuid.UUID, req UpdateUserRequest) (*User, error)
	UpsertFromClaims(claims *auth.TokenClaims) error
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) GetByID(id uuid.UUID) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(
		`SELECT id, email, username, display_name, avatar_url, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *PostgresRepository) Update(id uuid.UUID, req UpdateUserRequest) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(
		`UPDATE users SET
			display_name = COALESCE($2, display_name),
			avatar_url = COALESCE($3, avatar_url)
		 WHERE id = $1
		 RETURNING id, email, username, display_name, avatar_url, created_at`,
		id, req.DisplayName, req.AvatarURL,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// UpsertFromClaims inserts or updates the local user cache from central auth JWT claims.
func (r *PostgresRepository) UpsertFromClaims(claims *auth.TokenClaims) error {
	_, err := r.db.Exec(
		`INSERT INTO users (id, username, display_name, avatar_url)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET
			username = $2,
			display_name = $3,
			avatar_url = $4,
			updated_at = NOW()`,
		claims.UserID, claims.Username, claims.DisplayName, claims.AvatarURL,
	)
	return err
}
