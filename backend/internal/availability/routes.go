package availability

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// RegisterRoutes wires all availability routes onto the provided mux.
//
// Route registration order matters for Go 1.22's ServeMux:
// The literal path "/api/v1/availability/today" is registered BEFORE
// the wildcard "/api/v1/availability/{userID}" to ensure Go's router
// matches the more specific literal path first. Go 1.22 gives precedence
// to non-wildcard patterns, but explicit ordering makes the intent clear.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	authOnly := middleware.Chain(
		middleware.Authenticate(cfg),
	)

	// Get today's availability — any authenticated user.
	// Admin/superadmin see all; freelancers see only their own.
	// Registered BEFORE the {userID} wildcard to prevent "today" being
	// captured as a userID.
	mux.Handle("GET /api/v1/availability/today",
		authOnly(http.HandlerFunc(HandleGetTodayAvailability(pool, cfg))))

	// Upsert availability for a specific user+date — any authenticated user.
	// Service layer enforces own-only access for freelancers.
	mux.Handle("PUT /api/v1/availability/{userID}/{date}",
		authOnly(http.HandlerFunc(HandleUpsertAvailability(pool, cfg))))

	// Get availability for a specific user (7-day lookahead) — any auth user.
	// Service layer enforces own-only access for freelancers.
	mux.Handle("GET /api/v1/availability/{userID}",
		authOnly(http.HandlerFunc(HandleGetUserAvailability(pool, cfg))))
}
