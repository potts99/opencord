package keys

import (
	"time"

	"github.com/google/uuid"
)

type DeviceKey struct {
	UserID      uuid.UUID `json:"userId"`
	DeviceID    string    `json:"deviceId"`
	IdentityKey string    `json:"identityKey"`
	SigningKey   string    `json:"signingKey"`
	CreatedAt   time.Time `json:"createdAt"`
}

type OneTimeKey struct {
	ID       uuid.UUID `json:"id"`
	UserID   uuid.UUID `json:"userId"`
	DeviceID string    `json:"deviceId"`
	KeyID    string    `json:"keyId"`
	Key      string    `json:"key"`
}

type UploadKeysRequest struct {
	DeviceID    string `json:"deviceId"`
	IdentityKey string `json:"identityKey"`
	SigningKey   string `json:"signingKey"`
	OneTimeKeys []struct {
		KeyID string `json:"keyId"`
		Key   string `json:"key"`
	} `json:"oneTimeKeys"`
}

type QueryKeysRequest struct {
	UserID string `json:"userId"`
}

type ClaimKeysRequest struct {
	UserID   string `json:"userId"`
	DeviceID string `json:"deviceId"`
}
