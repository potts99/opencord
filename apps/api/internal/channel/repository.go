package channel

import (
	"database/sql"

	"github.com/google/uuid"
)

type Repository interface {
	Create(name, channelType string) (*Channel, error)
	GetAll() ([]Channel, error)
	GetByID(id uuid.UUID) (*Channel, error)
	Update(id uuid.UUID, req UpdateChannelRequest) (*Channel, error)
	Delete(id uuid.UUID) error
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(name, channelType string) (*Channel, error) {
	if channelType == "" {
		channelType = "text"
	}
	ch := &Channel{}
	err := r.db.QueryRow(
		`INSERT INTO channels (name, type, position)
		 VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM channels))
		 RETURNING id, name, type, position, created_at`,
		name, channelType,
	).Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Position, &ch.CreatedAt)
	if err != nil {
		return nil, err
	}
	return ch, nil
}

func (r *PostgresRepository) GetAll() ([]Channel, error) {
	rows, err := r.db.Query(`SELECT id, name, type, position, created_at FROM channels ORDER BY position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Position, &ch.CreatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

func (r *PostgresRepository) GetByID(id uuid.UUID) (*Channel, error) {
	ch := &Channel{}
	err := r.db.QueryRow(
		`SELECT id, name, type, position, created_at FROM channels WHERE id = $1`, id,
	).Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Position, &ch.CreatedAt)
	if err != nil {
		return nil, err
	}
	return ch, nil
}

func (r *PostgresRepository) Update(id uuid.UUID, req UpdateChannelRequest) (*Channel, error) {
	ch := &Channel{}
	err := r.db.QueryRow(
		`UPDATE channels SET
			name = COALESCE($2, name),
			position = COALESCE($3, position)
		 WHERE id = $1
		 RETURNING id, name, type, position, created_at`,
		id, req.Name, req.Position,
	).Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Position, &ch.CreatedAt)
	if err != nil {
		return nil, err
	}
	return ch, nil
}

func (r *PostgresRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM channels WHERE id = $1`, id)
	return err
}
