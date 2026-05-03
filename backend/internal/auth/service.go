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
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/saket/command-center/backend/pkg/authutil"
	"github.com/saket/command-center/backend/pkg/config"
)

// ErrValidation wraps user-facing validation errors that are safe
// to return directly to the client in a 400 response.
var ErrValidation = errors.New("validation error")

// Register validates the request, hashes the password with bcrypt cost 12,
// persists the user, and returns a client-safe UserResponse.
// Note: Role is hardcoded to RoleFreelancer for security.
func Register(ctx context.Context, pool *pgxpool.Pool, cfg *config.Config, req RegisterRequest) (UserResponse, error) {
	// 1. Presence validation — role is no longer in the request.
	if strings.TrimSpace(req.Name) == "" ||
		strings.TrimSpace(req.Email) == "" ||
		strings.TrimSpace(req.Password) == "" {
		return UserResponse{}, fmt.Errorf("%w: name, email, and password are required", ErrValidation)
	}

	// 2. Hash password. Cost 12: strong enough, not a DoS vector.
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return UserResponse{}, fmt.Errorf("auth: hash password: %w", err)
	}

	// 3. Persist — Role is forced to freelancer.
	row, err := CreateUser(ctx, pool, req.Name, req.Email, authutil.RoleFreelancer, string(hash))
	if err != nil {
		return UserResponse{}, err
	}

	// 4. Explicit field mapping — no reflection, no accidental field leaks.
	return userRowToResponse(row), nil
}

// CreateAdminUser allows an existing superadmin to create other admin users.
// NOTE: Hardcoded to RoleAdmin only as per security policy.
func CreateAdminUser(ctx context.Context, pool *pgxpool.Pool, actorID uuid.UUID, name, email, password string) (UserResponse, error) {
	// 1. Presence validation.
	if strings.TrimSpace(name) == "" ||
		strings.TrimSpace(email) == "" ||
		strings.TrimSpace(password) == "" {
		return UserResponse{}, fmt.Errorf("%w: name, email, and password are required", ErrValidation)
	}

	// 2. Hash password.
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return UserResponse{}, fmt.Errorf("auth: hash password: %w", err)
	}

	// 3. Persist — forced to RoleAdmin.
	row, err := CreateUser(ctx, pool, name, email, authutil.RoleAdmin, string(hash))
	if err != nil {
		return UserResponse{}, err
	}

	// 4. Audit log — record who created this admin.
	_ = CreateAuthAuditLog(ctx, pool, actorID, "CREATE_ADMIN", row.ID, map[string]any{
		"email": row.Email,
		"role":  row.Role,
	})

	return userRowToResponse(row), nil
}

// Login verifies credentials and returns a signed access token, a raw refresh
// token (for the cookie), and a client-safe UserResponse.
func Login(ctx context.Context, pool *pgxpool.Pool, cfg *config.Config, req LoginRequest) (string, string, UserResponse, error) {
	// 1. Fetch user — only ErrUserNotFound maps to the generic credential error.
	row, err := GetUserByEmail(ctx, pool, req.Email)
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
	claims := authutil.TokenClaims{
		UserID: row.ID.String(),
		Role:   authutil.Role(row.Role),
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

	if err := CreateSession(ctx, pool, row.ID, string(tokenHash), now.Add(7*24*time.Hour)); err != nil {
		return "", "", UserResponse{}, err
	}

	return accessToken, rawToken, userRowToResponse(row), nil
}

// ValidateAccessToken parses and verifies a JWT string, enforcing HS256 and
// returning the embedded claims. Returns an error for expired or tampered tokens.
func ValidateAccessToken(cfg *config.Config, tokenString string) (*authutil.TokenClaims, error) {
	claims := &authutil.TokenClaims{}
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
		IsActive:  row.IsActive,
		CreatedAt: row.CreatedAt,
	}
	if row.AvatarURL.Valid {
		resp.AvatarURL = &row.AvatarURL.String
	}
	return resp
}

// UpdateUserRole handles role changes by a superadmin.
func UpdateUserRole(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, role string) (UserResponse, error) {
	// Validation: role must be valid
	if role != string(authutil.RoleAdmin) && role != string(authutil.RoleFreelancer) && role != string(authutil.RoleSuperAdmin) {
		return UserResponse{}, fmt.Errorf("%w: invalid role", ErrValidation)
	}

	row, err := repoUpdateUserRole(ctx, pool, userID, role)
	if err != nil {
		return UserResponse{}, err
	}

	return userRowToResponse(row), nil
}

// UpdateUserStatus handles account activation/deactivation by a superadmin.
func UpdateUserStatus(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, isActive bool) (UserResponse, error) {
	row, err := repoUpdateUserStatus(ctx, pool, userID, isActive)
	if err != nil {
		return UserResponse{}, err
	}

	return userRowToResponse(row), nil
}
