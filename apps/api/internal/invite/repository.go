package invite

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Create(createdBy uuid.UUID, expiresAt *time.Time) (*Invite, error)
	GetAll() ([]Invite, error)
	GetByCode(code string) (*Invite, error)
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(createdBy uuid.UUID, expiresAt *time.Time) (*Invite, error) {
	code := generateCode()
	inv := &Invite{}
	err := r.db.QueryRow(
		`INSERT INTO invites (code, created_by, expires_at) VALUES ($1, $2, $3)
		 RETURNING id, code, created_by, expires_at, created_at`,
		code, createdBy, expiresAt,
	).Scan(&inv.ID, &inv.Code, &inv.CreatedBy, &inv.ExpiresAt, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func (r *PostgresRepository) GetAll() ([]Invite, error) {
	rows, err := r.db.Query(
		`SELECT id, code, created_by, expires_at, created_at FROM invites ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.ID, &inv.Code, &inv.CreatedBy, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invites = append(invites, inv)
	}
	return invites, nil
}

func (r *PostgresRepository) GetByCode(code string) (*Invite, error) {
	inv := &Invite{}
	err := r.db.QueryRow(
		`SELECT id, code, created_by, expires_at, created_at FROM invites WHERE code = $1`,
		code,
	).Scan(&inv.ID, &inv.Code, &inv.CreatedBy, &inv.ExpiresAt, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func generateCode() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)[:12]
}
