package message

import (
	"time"

	"github.com/google/uuid"
)

type Message struct {
	ID        uuid.UUID  `json:"id"`
	ChannelID uuid.UUID  `json:"channelId"`
	AuthorID  uuid.UUID  `json:"authorId"`
	Content   string     `json:"content"`
	ImageURL  *string    `json:"imageUrl"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt *time.Time `json:"updatedAt"`
	Author    *Author    `json:"author,omitempty"`
}

type Author struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	AvatarURL   *string   `json:"avatarUrl"`
}

type CreateMessageRequest struct {
	Content  string  `json:"content"`
	ImageURL *string `json:"imageUrl"`
}

type UpdateMessageRequest struct {
	Content string `json:"content"`
}
