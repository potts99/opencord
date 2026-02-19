package member

import (
	"database/sql"

	"github.com/google/uuid"
)

type Repository interface {
	Create(userID uuid.UUID, role string) (*Member, error)
	GetAll() ([]Member, error)
	GetByUserID(userID uuid.UUID) (*Member, error)
	UpdateRole(userID uuid.UUID, role string) (*Member, error)
	Delete(userID uuid.UUID) error
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(userID uuid.UUID, role string) (*Member, error) {
	m := &Member{}
	err := r.db.QueryRow(
		`INSERT INTO members (user_id, role) VALUES ($1, $2)
		 RETURNING id, user_id, role, joined_at`,
		userID, role,
	).Scan(&m.ID, &m.UserID, &m.Role, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	// Fetch user info
	_ = r.db.QueryRow(
		`SELECT username, display_name, avatar_url FROM users WHERE id = $1`, userID,
	).Scan(&m.Username, &m.DisplayName, &m.AvatarURL)
	return m, nil
}

func (r *PostgresRepository) GetAll() ([]Member, error) {
	rows, err := r.db.Query(
		`SELECT m.id, m.user_id, u.username, u.display_name, u.avatar_url, m.role, m.joined_at, u.last_seen_at
		 FROM members m JOIN users u ON u.id = m.user_id
		 ORDER BY m.joined_at`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.UserID, &m.Username, &m.DisplayName, &m.AvatarURL, &m.Role, &m.JoinedAt, &m.LastSeenAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *PostgresRepository) GetByUserID(userID uuid.UUID) (*Member, error) {
	m := &Member{}
	err := r.db.QueryRow(
		`SELECT m.id, m.user_id, u.username, u.display_name, u.avatar_url, m.role, m.joined_at, u.last_seen_at
		 FROM members m JOIN users u ON u.id = m.user_id
		 WHERE m.user_id = $1`,
		userID,
	).Scan(&m.ID, &m.UserID, &m.Username, &m.DisplayName, &m.AvatarURL, &m.Role, &m.JoinedAt, &m.LastSeenAt)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *PostgresRepository) UpdateRole(userID uuid.UUID, role string) (*Member, error) {
	m := &Member{}
	err := r.db.QueryRow(
		`UPDATE members SET role = $2 WHERE user_id = $1
		 RETURNING id, user_id, role, joined_at`,
		userID, role,
	).Scan(&m.ID, &m.UserID, &m.Role, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	_ = r.db.QueryRow(
		`SELECT username, display_name, avatar_url, last_seen_at FROM users WHERE id = $1`, userID,
	).Scan(&m.Username, &m.DisplayName, &m.AvatarURL, &m.LastSeenAt)
	return m, nil
}

func (r *PostgresRepository) Delete(userID uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM members WHERE user_id = $1`, userID)
	return err
}
