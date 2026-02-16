package channel

import (
	"time"

	"github.com/google/uuid"
)

type Channel struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateChannelRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type UpdateChannelRequest struct {
	Name     *string `json:"name"`
	Position *int    `json:"position"`
}
