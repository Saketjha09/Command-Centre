package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Package-level sentinel errors — use errors.Is() to check these in callers.
var (
	// ErrEmailTaken is returned by CreateUser when a unique_violation (23505)
	// is detected on ops.users.email.
	ErrEmailTaken = errors.New("auth: email already registered")

	// ErrUserNotFound is returned when no row matches the lookup predicate.
	ErrUserNotFound = errors.New("auth: user not found")

	// ErrInvalidCredentials is returned by the Login service on bad email/password.
	// Kept here alongside other sentinels so handlers can errors.Is() it cleanly.
	ErrInvalidCredentials = errors.New("invalid credentials")
)

const dbTimeout = 5 * time.Second

// CreateUser inserts a new user into ops.users and returns the persisted row.
// The passed context is intentionally ignored; a fresh 5-second budget derived
// from context.Background() is always used so HTTP request cancellations
// cannot abort a mid-write DB operation.
func CreateUser(_ context.Context, pool *pgxpool.Pool, req RegisterRequest, hashedPassword string) (UserRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		INSERT INTO ops.users (name, email, hashed_password, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, email, hashed_password, role, slack_user_id, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, req.Name, req.Email, hashedPassword, req.Role).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return UserRow{}, ErrEmailTaken
		}
		return UserRow{}, fmt.Errorf("auth: create user: %w", err)
	}
	return row, nil
}

// GetUserByEmail fetches a user row by email address.
// Returns ErrUserNotFound if no matching row exists.
func GetUserByEmail(_ context.Context, pool *pgxpool.Pool, email string) (UserRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		SELECT id, name, email, hashed_password, role, slack_user_id, created_at
		FROM ops.users
		WHERE email = $1`

	var row UserRow
	err := pool.QueryRow(ctx, q, email).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UserRow{}, ErrUserNotFound
		}
		return UserRow{}, fmt.Errorf("auth: get user by email: %w", err)
	}
	return row, nil
}

// GetUserByID fetches a user row by primary key UUID.
// Returns ErrUserNotFound if no matching row exists.
// Required by HandleMe which reads UserID from the JWT claims.
func GetUserByID(_ context.Context, pool *pgxpool.Pool, id uuid.UUID) (UserRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		SELECT id, name, email, hashed_password, role, slack_user_id, created_at
		FROM ops.users
		WHERE id = $1`

	var row UserRow
	err := pool.QueryRow(ctx, q, id).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UserRow{}, ErrUserNotFound
		}
		return UserRow{}, fmt.Errorf("auth: get user by id: %w", err)
	}
	return row, nil
}

// CreateSession inserts a refresh token hash into ops.sessions.
// The raw token is NEVER passed here — only the bcrypt hash.
func CreateSession(_ context.Context, pool *pgxpool.Pool, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		INSERT INTO ops.sessions (user_id, refresh_token_hash, expires_at)
		VALUES ($1, $2, $3)`

	_, err := pool.Exec(ctx, q, userID, tokenHash, expiresAt)
	if err != nil {
		return fmt.Errorf("auth: create session: %w", err)
	}
	return nil
}
