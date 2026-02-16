package keys

import (
	"database/sql"

	"github.com/google/uuid"
)

type Repository interface {
	UpsertDeviceKey(userID uuid.UUID, deviceID, identityKey, signingKey string) error
	InsertOneTimeKeys(userID uuid.UUID, deviceID string, keys []struct{ KeyID, Key string }) error
	GetDeviceKeys(userID uuid.UUID) ([]DeviceKey, error)
	ClaimOneTimeKey(userID uuid.UUID, deviceID string) (*OneTimeKey, error)
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) UpsertDeviceKey(userID uuid.UUID, deviceID, identityKey, signingKey string) error {
	_, err := r.db.Exec(
		`INSERT INTO device_keys (user_id, device_id, identity_key, signing_key)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, device_id) DO UPDATE SET identity_key = $3, signing_key = $4`,
		userID, deviceID, identityKey, signingKey,
	)
	return err
}

func (r *PostgresRepository) InsertOneTimeKeys(userID uuid.UUID, deviceID string, keys []struct{ KeyID, Key string }) error {
	for _, k := range keys {
		_, err := r.db.Exec(
			`INSERT INTO one_time_keys (user_id, device_id, key_id, key) VALUES ($1, $2, $3, $4)`,
			userID, deviceID, k.KeyID, k.Key,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *PostgresRepository) GetDeviceKeys(userID uuid.UUID) ([]DeviceKey, error) {
	rows, err := r.db.Query(
		`SELECT user_id, device_id, identity_key, signing_key, created_at
		 FROM device_keys WHERE user_id = $1`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deviceKeys []DeviceKey
	for rows.Next() {
		var dk DeviceKey
		if err := rows.Scan(&dk.UserID, &dk.DeviceID, &dk.IdentityKey, &dk.SigningKey, &dk.CreatedAt); err != nil {
			return nil, err
		}
		deviceKeys = append(deviceKeys, dk)
	}
	return deviceKeys, nil
}

func (r *PostgresRepository) ClaimOneTimeKey(userID uuid.UUID, deviceID string) (*OneTimeKey, error) {
	otk := &OneTimeKey{}
	err := r.db.QueryRow(
		`UPDATE one_time_keys SET claimed = true
		 WHERE id = (
			SELECT id FROM one_time_keys
			WHERE user_id = $1 AND device_id = $2 AND claimed = false
			LIMIT 1
		 )
		 RETURNING id, user_id, device_id, key_id, key`,
		userID, deviceID,
	).Scan(&otk.ID, &otk.UserID, &otk.DeviceID, &otk.KeyID, &otk.Key)
	if err != nil {
		return nil, err
	}
	return otk, nil
}
