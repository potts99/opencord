package invite

import (
	"time"

	"github.com/google/uuid"
)

type Invite struct {
	ID        uuid.UUID  `json:"id"`
	Code      string     `json:"code"`
	CreatedBy uuid.UUID  `json:"createdBy"`
	ExpiresAt *time.Time `json:"expiresAt"`
	CreatedAt time.Time  `json:"createdAt"`
}

type CreateInviteRequest struct {
	ExpiresInHours *int `json:"expiresInHours"`
}
