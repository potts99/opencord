package database

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
)

func Connect(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	return db, nil
}

func RunMigrations(db *sql.DB, migrationsPath string) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}
	m, err := migrate.NewWithDatabaseInstance(
		"file://"+migrationsPath,
		"postgres", driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}

	err = m.Up()
	if err == nil || err == migrate.ErrNoChange {
		log.Println("migrations applied successfully")
		return nil
	}

	// If the database is in a dirty state (previous migration failed mid-way),
	// force back to the last clean version and retry.
	if version, dirty, verr := m.Version(); verr == nil && dirty {
		log.Printf("dirty migration detected at version %d, forcing to version %d and retrying", version, version-1)
		if ferr := m.Force(int(version) - 1); ferr != nil {
			return fmt.Errorf("failed to force migration version: %w", ferr)
		}
		if err = m.Up(); err != nil && err != migrate.ErrNoChange {
			return fmt.Errorf("migration retry failed: %w", err)
		}
		log.Println("migrations applied successfully after dirty state recovery")
		return nil
	}

	return fmt.Errorf("migration failed: %w", err)
}
