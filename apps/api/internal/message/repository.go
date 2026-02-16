package message

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Create(channelID, authorID uuid.UUID, content string, imageURL *string) (*Message, error)
	GetByChannel(channelID uuid.UUID, before *uuid.UUID, limit int) ([]Message, error)
	GetByID(id uuid.UUID) (*Message, error)
	Update(id uuid.UUID, content string) (*Message, error)
	Delete(id uuid.UUID) error
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(channelID, authorID uuid.UUID, content string, imageURL *string) (*Message, error) {
	msg := &Message{}
	err := r.db.QueryRow(
		`INSERT INTO messages (channel_id, author_id, content, image_url)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, channel_id, author_id, content, image_url, created_at, updated_at`,
		channelID, authorID, content, imageURL,
	).Scan(&msg.ID, &msg.ChannelID, &msg.AuthorID, &msg.Content, &msg.ImageURL, &msg.CreatedAt, &msg.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Fetch author info
	msg.Author = &Author{}
	_ = r.db.QueryRow(
		`SELECT id, username, display_name, avatar_url FROM users WHERE id = $1`, authorID,
	).Scan(&msg.Author.ID, &msg.Author.Username, &msg.Author.DisplayName, &msg.Author.AvatarURL)

	return msg, nil
}

func (r *PostgresRepository) GetByChannel(channelID uuid.UUID, before *uuid.UUID, limit int) ([]Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var rows *sql.Rows
	var err error

	if before != nil {
		rows, err = r.db.Query(
			`SELECT m.id, m.channel_id, m.author_id, m.content, m.image_url, m.created_at, m.updated_at,
			        u.id, u.username, u.display_name, u.avatar_url
			 FROM messages m
			 JOIN users u ON u.id = m.author_id
			 WHERE m.channel_id = $1 AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)
			 ORDER BY m.created_at DESC
			 LIMIT $3`,
			channelID, before, limit,
		)
	} else {
		rows, err = r.db.Query(
			`SELECT m.id, m.channel_id, m.author_id, m.content, m.image_url, m.created_at, m.updated_at,
			        u.id, u.username, u.display_name, u.avatar_url
			 FROM messages m
			 JOIN users u ON u.id = m.author_id
			 WHERE m.channel_id = $1
			 ORDER BY m.created_at DESC
			 LIMIT $2`,
			channelID, limit,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		msg.Author = &Author{}
		if err := rows.Scan(
			&msg.ID, &msg.ChannelID, &msg.AuthorID, &msg.Content, &msg.ImageURL, &msg.CreatedAt, &msg.UpdatedAt,
			&msg.Author.ID, &msg.Author.Username, &msg.Author.DisplayName, &msg.Author.AvatarURL,
		); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (r *PostgresRepository) GetByID(id uuid.UUID) (*Message, error) {
	msg := &Message{}
	err := r.db.QueryRow(
		`SELECT id, channel_id, author_id, content, image_url, created_at, updated_at
		 FROM messages WHERE id = $1`, id,
	).Scan(&msg.ID, &msg.ChannelID, &msg.AuthorID, &msg.Content, &msg.ImageURL, &msg.CreatedAt, &msg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return msg, nil
}

func (r *PostgresRepository) Update(id uuid.UUID, content string) (*Message, error) {
	msg := &Message{}
	now := time.Now()
	err := r.db.QueryRow(
		`UPDATE messages SET content = $2, updated_at = $3 WHERE id = $1
		 RETURNING id, channel_id, author_id, content, image_url, created_at, updated_at`,
		id, content, now,
	).Scan(&msg.ID, &msg.ChannelID, &msg.AuthorID, &msg.Content, &msg.ImageURL, &msg.CreatedAt, &msg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return msg, nil
}

func (r *PostgresRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM messages WHERE id = $1`, id)
	return err
}
