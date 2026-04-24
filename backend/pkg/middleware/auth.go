// Package middleware provides HTTP middleware for the Freelance Command Center API.
// All middleware in this package is zero-database: it reads only from the
// request context and the JWT — never from PostgreSQL.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
)

// claimsKey is an unexported struct type used as a context key.
// Using an unexported type (not a string) prevents collisions with context
// keys set by other packages that might also use the string "claims".
type claimsKey struct{}

// Authenticate returns a middleware that:
//  1. Reads the "access_token" HttpOnly cookie.
//  2. Validates the JWT via auth.ValidateAccessToken.
//  3. Stores the parsed *auth.TokenClaims on the request context.
//  4. Calls the next handler with the enriched context.
//
// The middleware is cookie-only — Authorization: Bearer headers are
// intentionally not supported.
func Authenticate(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var token string
			cookie, err := r.Cookie("access_token")
			if err == nil {
				token = cookie.Value
			} else {
				// Fallback to Authorization header
				authHeader := r.Header.Get("Authorization")
				if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
					token = authHeader[7:]
				}
			}

			if token == "" {
				// Missing credentials — unauthenticated request.
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"})
				return
			}

			claims, err := auth.ValidateAccessToken(cfg, token)
			if err != nil {
				// Token present but invalid or expired.
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid or expired token"})
				return
			}

			// Store claims on context — downstream handlers use ClaimsFromContext.
			ctx := context.WithValue(r.Context(), claimsKey{}, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext retrieves the *auth.TokenClaims stored by Authenticate
// from the provided context. Returns (claims, true) on success, (nil, false)
// if no claims are present.
//
// This is the ONLY way downstream handlers should access JWT claims.
// Never re-read the cookie. Never re-parse the JWT.
func ClaimsFromContext(ctx context.Context) (*auth.TokenClaims, bool) {
	claims, ok := ctx.Value(claimsKey{}).(*auth.TokenClaims)
	return claims, ok
}
