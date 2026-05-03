// Package auth contains the auth domain: models, repository, service, and handlers.
// It is the single source of truth for authentication and session management.
package auth

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// UserRow is the internal DB row struct. Contains sensitive fields.
// NEVER serialize this to JSON. NEVER embed in a response type.
// Use userRowToResponse() (service.go) to produce a client-safe value.
type UserRow struct {
	ID             uuid.UUID
	Name           string
	Email          string
	HashedPassword string // bcrypt hash — never leaves the server
	Role           string
	SlackUserID    pgtype.Text // nullable TEXT column
	AvatarURL      pgtype.Text // New: avatar image path
	IsActive       bool        // New: account status
	CreatedAt      time.Time
}

// UserResponse is the ONLY struct returned to clients.
type UserResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// RegisterRequest is the body for POST /api/v1/auth/register.
type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest is the body for POST /api/v1/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// TokenClaims has been moved to pkg/authutil to break import cycles.
