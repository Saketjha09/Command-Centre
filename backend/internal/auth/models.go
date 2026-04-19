// Package auth contains the auth domain: models, repository, service, and handlers.
// It is the single source of truth for authentication and session management.
package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
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
	HashedPassword string   // bcrypt hash — never leaves the server
	Role           string
	SlackUserID    pgtype.Text // nullable TEXT column
	CreatedAt      time.Time
}

// UserResponse is the ONLY struct returned to clients.
// Intentionally omits: hashed_password, rate_multiplier, slack_user_id.
type UserResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// RegisterRequest is the body for POST /api/v1/auth/register.
type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// LoginRequest is the body for POST /api/v1/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// TokenClaims is the JWT payload embedded in both access tokens.
type TokenClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}
