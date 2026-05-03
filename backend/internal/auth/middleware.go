package auth

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/saket/command-center/backend/pkg/authutil"
	"github.com/saket/command-center/backend/pkg/config"
)

// Authenticate returns a middleware that:
//  1. Reads the "access_token" HttpOnly cookie or Authorization header.
//  2. Validates the JWT via ValidateAccessToken.
//  3. Stores the parsed *TokenClaims on the request context.
//  4. Calls the next handler with the enriched context.
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
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"})
				return
			}

			claims, err := ValidateAccessToken(cfg, token)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid or expired token"})
				return
			}

			// Store claims on context — downstream handlers use ClaimsFromContext.
			ctx := authutil.ContextWithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext retrieves the *TokenClaims stored by Authenticate
// from the provided context. Returns (claims, true) on success, (nil, false)
// if no claims are present.
func ClaimsFromContext(ctx context.Context) (*authutil.TokenClaims, bool) {
	return authutil.ClaimsFromContext(ctx)
}
