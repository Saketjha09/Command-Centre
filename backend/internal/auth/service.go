package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/saket/command-center/backend/pkg/config"
)

// ErrValidation wraps user-facing validation errors that are safe
// to return directly to the client in a 400 response.
var ErrValidation = errors.New("validation error")

// validRoles is the exhaustive set of accepted role strings.
// Any value not in this map is rejected by Register.
var validRoles = map[string]struct{}{
	"superadmin": {},
	"admin":      {},
	"freelancer": {},
}

// Register validates the request, hashes the password with bcrypt cost 12,
// persists the user, and returns a client-safe UserResponse.
func Register(pool *pgxpool.Pool, cfg *config.Config, req RegisterRequest) (UserResponse, error) {
	// 1. Presence validation — all four fields are required.
	if strings.TrimSpace(req.Name) == "" ||
		strings.TrimSpace(req.Email) == "" ||
		strings.TrimSpace(req.Password) == "" ||
		strings.TrimSpace(req.Role) == "" {
		return UserResponse{}, fmt.Errorf("%w: name, email, password, and role are required", ErrValidation)
	}

	// 2. Role whitelist check.
	if _, ok := validRoles[req.Role]; !ok {
		return UserResponse{}, fmt.Errorf("%w: role must be one of: superadmin, admin, freelancer", ErrValidation)
	}

	// 3. Hash password. Cost 12: strong enough, not a DoS vector.
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return UserResponse{}, fmt.Errorf("auth: hash password: %w", err)
	}

	// 4. Persist — ErrEmailTaken surfaces unchanged so the handler can 409.
	row, err := CreateUser(context.Background(), pool, req, string(hash))
	if err != nil {
		return UserResponse{}, err
	}

	// 5. Explicit field mapping — no reflection, no accidental field leaks.
	return userRowToResponse(row), nil
}

// Login verifies credentials and returns a signed access token, a raw refresh
// token (for the cookie), and a client-safe UserResponse.
//
// Security invariant: BOTH "user not found" and "wrong password" return the
// same ErrInvalidCredentials so callers cannot enumerate registered emails.
func Login(pool *pgxpool.Pool, cfg *config.Config, req LoginRequest) (string, string, UserResponse, error) {
	// 1. Fetch user — only ErrUserNotFound maps to the generic credential error.
	// Any other DB error (timeout, pool exhaustion, SQL failure) is a real server
	// fault and must NOT be silenced as a 401 — it propagates as a wrapped error
	// so the handler returns a 500 and the log captures the real cause.
	row, err := GetUserByEmail(context.Background(), pool, req.Email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return "", "", UserResponse{}, ErrInvalidCredentials
		}
		return "", "", UserResponse{}, fmt.Errorf("auth: login db lookup: %w", err)
	}

	// 2. Constant-time password comparison.
	if err := bcrypt.CompareHashAndPassword([]byte(row.HashedPassword), []byte(req.Password)); err != nil {
		return "", "", UserResponse{}, ErrInvalidCredentials
	}

	// 3. Issue access token (15-minute TTL, HS256).
	now := time.Now().UTC()
	claims := TokenClaims{
		UserID: row.ID.String(),
		Role:   row.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
		},
	}
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := jwtToken.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return "", "", UserResponse{}, fmt.Errorf("auth: sign access token: %w", err)
	}

	// 4. Issue refresh token (7-day TTL).
	//    Raw token → client cookie.  bcrypt hash → database.  Never swap these.
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return "", "", UserResponse{}, fmt.Errorf("auth: generate refresh token entropy: %w", err)
	}
	rawToken := base64.URLEncoding.EncodeToString(rawBytes)

	tokenHash, err := bcrypt.GenerateFromPassword([]byte(rawToken), 12)
	if err != nil {
		return "", "", UserResponse{}, fmt.Errorf("auth: hash refresh token: %w", err)
	}

	if err := CreateSession(context.Background(), pool, row.ID, string(tokenHash), now.Add(7*24*time.Hour)); err != nil {
		return "", "", UserResponse{}, err
	}

	return accessToken, rawToken, userRowToResponse(row), nil
}

// ValidateAccessToken parses and verifies a JWT string, enforcing HS256 and
// returning the embedded claims. Returns an error for expired or tampered tokens.
func ValidateAccessToken(cfg *config.Config, tokenString string) (*TokenClaims, error) {
	claims := &TokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		// Reject any token signed with a non-HMAC algorithm (algorithm confusion attack).
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("auth: unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("auth: parse token: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("auth: token is invalid")
	}
	return claims, nil
}

// userRowToResponse converts an internal UserRow to a client-safe UserResponse.
// Explicit field-by-field mapping: no reflection, no struct embedding,
// no risk of accidentally including hashed_password or rate_multiplier.
func userRowToResponse(row UserRow) UserResponse {
	resp := UserResponse{
		ID:        row.ID.String(),
		Name:      row.Name,
		Email:     row.Email,
		Role:      row.Role,
		CreatedAt: row.CreatedAt,
	}
	if row.AvatarURL.Valid {
		resp.AvatarURL = &row.AvatarURL.String
	}
	return resp
}
