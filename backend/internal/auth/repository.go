package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

// isTransientDBConnectionError identifies short-lived DB connectivity failures
// where a single retry is often enough after a container/network blip.
func isTransientDBConnectionError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "failed to connect") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "database system is starting up")
}

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
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, req.Name, req.Email, hashedPassword, req.Role).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		err = pool.QueryRow(ctx, q, req.Name, req.Email, hashedPassword, req.Role).
			Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
				&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	}
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
		SELECT id, name, email, hashed_password, role, slack_user_id, avatar_url, created_at
		FROM ops.users
		WHERE email = $1`

	var row UserRow
	err := pool.QueryRow(ctx, q, email).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		err = pool.QueryRow(ctx, q, email).
			Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
				&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	}
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
		SELECT id, name, email, hashed_password, role, slack_user_id, avatar_url, created_at
		FROM ops.users
		WHERE id = $1`

	var row UserRow
	err := pool.QueryRow(ctx, q, id).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		err = pool.QueryRow(ctx, q, id).
			Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
				&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	}
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
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		_, err = pool.Exec(ctx, q, userID, tokenHash, expiresAt)
	}
	if err != nil {
		return fmt.Errorf("auth: create session: %w", err)
	}
	return nil
}

// ListUsers fetches all active users.
func ListUsers(_ context.Context, pool *pgxpool.Pool) ([]UserRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		SELECT id, name, email, hashed_password, role, slack_user_id, avatar_url, created_at
		FROM ops.users
		ORDER BY name ASC`

	rows, err := pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("auth: list users: %w", err)
	}
	defer rows.Close()

	var users []UserRow
	for rows.Next() {
		var row UserRow
		if err := rows.Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt); err != nil {
			return nil, fmt.Errorf("auth: scan user row: %w", err)
		}
		users = append(users, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("auth: rows loop error: %w", err)
	}

	return users, nil
}

// UpdateUser updates specific fields for a user.
func UpdateUser(_ context.Context, pool *pgxpool.Pool, userID uuid.UUID, name, email string) (UserRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		UPDATE ops.users
		SET name = $2, email = $3
		WHERE id = $1
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, userID, name, email).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	if err != nil {
		return UserRow{}, fmt.Errorf("auth: update user: %w", err)
	}
	return row, nil
}

// UpdateUserAvatar updates the avatar URL for a user.
func UpdateUserAvatar(_ context.Context, pool *pgxpool.Pool, userID uuid.UUID, avatarURL string) (UserRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		UPDATE ops.users
		SET avatar_url = $2
		WHERE id = $1
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, userID, avatarURL).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.CreatedAt)
	if err != nil {
		return UserRow{}, fmt.Errorf("auth: update user avatar: %w", err)
	}
	return row, nil
}
