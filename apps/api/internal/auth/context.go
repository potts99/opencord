package auth

import (
	"context"

	"github.com/google/uuid"
)

func SetUserContext(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, UserContextKey, userID)
}

func UserFromContext(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(UserContextKey).(uuid.UUID)
	return userID, ok
}
