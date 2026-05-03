package middleware

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/saket/command-center/backend/pkg/authutil"
)

// RequireRole returns a middleware that grants access only if the authenticated
// user's role matches at least one of the supplied roles.
//
// MUST be used downstream of Authenticate in the chain. If claims are absent
// from context (i.e., Authenticate was not applied upstream), this is a
// programming error — the middleware returns 500 and logs a warning so the
// mistake is loud and immediately visible in server logs.
//
// Usage examples:
//
//	RequireRole(authutil.RoleAdmin)
//	RequireRole(authutil.RoleSuperAdmin, authutil.RoleAdmin)
func RequireRole(roles ...authutil.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := authutil.ClaimsFromContext(r.Context())
			if !ok {
				// No claims in context means Authenticate was not in the chain.
				// This is a misconfigured middleware stack — a developer mistake,
				// not a user error. Log loudly; return 500.
				log.Printf(
					"middleware: RequireRole called without Authenticate upstream "+
						"on route %s %s — fix the middleware chain",
					r.Method, r.URL.Path,
				)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "middleware misconfiguration"})
				return
			}

			// Linear scan: role lists are small (3 values max), so no map needed.
			for _, role := range roles {
				if claims.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			// Authenticated but wrong role — forbidden.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "insufficient permissions"})
		})
	}
}
