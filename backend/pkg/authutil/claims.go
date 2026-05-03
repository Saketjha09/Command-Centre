package authutil

import (
	"context"

	"github.com/golang-jwt/jwt/v5"
)

type Role string

const (
	RoleSuperAdmin Role = "superadmin"
	RoleAdmin      Role = "admin"
	RoleFreelancer Role = "freelancer"
)

// TokenClaims is the JWT payload embedded in both access tokens.
type TokenClaims struct {
	UserID string `json:"user_id"`
	Role   Role   `json:"role"`
	jwt.RegisteredClaims
}

// claimsKey is an unexported struct type used as a context key.
type claimsKey struct{}

// ClaimsFromContext retrieves the *TokenClaims stored by Authenticate
// from the provided context. Returns (claims, true) on success, (nil, false)
// if no claims are present.
func ClaimsFromContext(ctx context.Context) (*TokenClaims, bool) {
	claims, ok := ctx.Value(claimsKey{}).(*TokenClaims)
	return claims, ok
}

// ContextWithClaims returns a new context with the provided claims attached.
func ContextWithClaims(ctx context.Context, claims *TokenClaims) context.Context {
	return context.WithValue(ctx, claimsKey{}, claims)
}
