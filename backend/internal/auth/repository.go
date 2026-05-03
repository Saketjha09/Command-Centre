package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/pkg/authutil"
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
func CreateUser(ctx context.Context, pool *pgxpool.Pool, name, email string, role authutil.Role, hashedPassword string) (UserRow, error) {
	const q = `
		INSERT INTO ops.users (name, email, hashed_password, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, name, email, hashedPassword, string(role)).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		err = pool.QueryRow(ctx, q, name, email, hashedPassword, string(role)).
			Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
				&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
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
func GetUserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (UserRow, error) {
	const q = `
		SELECT id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at
		FROM ops.users
		WHERE email = $1`

	var row UserRow
	err := pool.QueryRow(ctx, q, email).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		err = pool.QueryRow(ctx, q, email).
			Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
				&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
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
func GetUserByID(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (UserRow, error) {
	const q = `
		SELECT id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at
		FROM ops.users
		WHERE id = $1`

	var row UserRow
	err := pool.QueryRow(ctx, q, id).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil && isTransientDBConnectionError(err) {
		time.Sleep(150 * time.Millisecond)
		err = pool.QueryRow(ctx, q, id).
			Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
				&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
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
func CreateSession(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
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
func ListUsers(ctx context.Context, pool *pgxpool.Pool) ([]UserRow, error) {
	const q = `
		SELECT id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at
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
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt); err != nil {
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
func UpdateUser(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, name, email string) (UserRow, error) {
	const q = `
		UPDATE ops.users
		SET name = $2, email = $3
		WHERE id = $1
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, userID, name, email).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil {
		return UserRow{}, fmt.Errorf("auth: update user: %w", err)
	}
	return row, nil
}

// UpdateUserAvatar updates the avatar URL for a user.
func UpdateUserAvatar(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, avatarURL string) (UserRow, error) {
	const q = `
		UPDATE ops.users
		SET avatar_url = $2
		WHERE id = $1
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, userID, avatarURL).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil {
		return UserRow{}, fmt.Errorf("auth: update user avatar: %w", err)
	}
	return row, nil
}

// CreateAuthAuditLog inserts an audit record for an auth action.
func CreateAuthAuditLog(ctx context.Context, pool *pgxpool.Pool, actorID uuid.UUID, action string, targetID uuid.UUID, metadata map[string]any) error {
	const q = `
		INSERT INTO ops.auth_audit_logs (actor_id, action, target_id, metadata)
		VALUES ($1, $2, $3, $4)`

	metaJSON, _ := json.Marshal(metadata)
	_, err := pool.Exec(ctx, q, actorID, action, targetID, metaJSON)
	if err != nil {
		return fmt.Errorf("auth: create audit log: %w", err)
	}
	return nil
}

// repoUpdateUserRole updates the role of a user.
func repoUpdateUserRole(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, role string) (UserRow, error) {
	const q = `
		UPDATE ops.users
		SET role = $2
		WHERE id = $1
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, userID, role).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil {
		return UserRow{}, fmt.Errorf("auth: update user role: %w", err)
	}
	return row, nil
}

// repoUpdateUserStatus toggles the is_active status of a user.
func repoUpdateUserStatus(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, isActive bool) (UserRow, error) {
	const q = `
		UPDATE ops.users
		SET is_active = $2
		WHERE id = $1
		RETURNING id, name, email, hashed_password, role, slack_user_id, avatar_url, is_active, created_at`

	var row UserRow
	err := pool.QueryRow(ctx, q, userID, isActive).
		Scan(&row.ID, &row.Name, &row.Email, &row.HashedPassword,
			&row.Role, &row.SlackUserID, &row.AvatarURL, &row.IsActive, &row.CreatedAt)
	if err != nil {
		return UserRow{}, fmt.Errorf("auth: update user status: %w", err)
	}
	return row, nil
}
