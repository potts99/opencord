package instance

import "database/sql"

type Repository interface {
	Get() (*InstanceInfo, error)
	Update(req UpdateInstanceRequest) (*InstanceInfo, error)
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Get() (*InstanceInfo, error) {
	info := &InstanceInfo{}
	var authServerURL *string
	err := r.db.QueryRow(
		`SELECT name, icon_url, description, registration_open, auth_server_url FROM instance_settings WHERE id = 1`,
	).Scan(&info.Name, &info.IconURL, &info.Description, &info.RegistrationOpen, &authServerURL)
	if err != nil {
		return nil, err
	}
	info.Version = "0.1.0"
	if authServerURL != nil {
		info.AuthServerURL = *authServerURL
	}
	return info, nil
}

func (r *PostgresRepository) Update(req UpdateInstanceRequest) (*InstanceInfo, error) {
	info := &InstanceInfo{}
	err := r.db.QueryRow(
		`UPDATE instance_settings SET
			name = COALESCE($1, name),
			icon_url = COALESCE($2, icon_url),
			description = COALESCE($3, description),
			registration_open = COALESCE($4, registration_open)
		 WHERE id = 1
		 RETURNING name, icon_url, description, registration_open`,
		req.Name, req.IconURL, req.Description, req.RegistrationOpen,
	).Scan(&info.Name, &info.IconURL, &info.Description, &info.RegistrationOpen)
	if err != nil {
		return nil, err
	}
	info.Version = "0.1.0"
	return info, nil
}
