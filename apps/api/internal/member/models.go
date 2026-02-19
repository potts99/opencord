package member

import (
	"time"

	"github.com/google/uuid"
)

type Member struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"userId"`
	Username    string     `json:"username"`
	DisplayName string     `json:"displayName"`
	AvatarURL   *string    `json:"avatarUrl"`
	Role        string     `json:"role"`
	JoinedAt    time.Time  `json:"joinedAt"`
	Online      bool       `json:"online"`
	LastSeenAt  *time.Time `json:"lastSeenAt"`
}

type UpdateMemberRequest struct {
	Role string `json:"role"`
}
