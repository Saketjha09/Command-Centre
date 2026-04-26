package availability

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/internal/ws"
	"github.com/saket/command-center/backend/pkg/authutil"
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
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config, hub *ws.Hub) {
	authOnly := middleware.Chain(
		auth.Authenticate(cfg),
	)

	adminOnly := middleware.Chain(
		auth.Authenticate(cfg),
		middleware.RequireRole(authutil.RoleAdmin, authutil.RoleSuperAdmin),
	)

	// 1. Literal routes (Priority)
	mux.Handle("GET /api/v1/availability/grid",
		adminOnly(http.HandlerFunc(HandleGetAdminAvailabilityGrid(pool, cfg))))

	mux.Handle("GET /api/v1/availability/today",
		authOnly(http.HandlerFunc(HandleGetTodayAvailability(pool, cfg))))

	mux.Handle("POST /api/v1/availability",
		authOnly(http.HandlerFunc(HandleSetAvailable(pool, cfg, hub))))
	mux.Handle("DELETE /api/v1/availability",
		authOnly(http.HandlerFunc(HandleSetOffline(pool, cfg))))

	// 2. Wildcard routes
	mux.Handle("GET /api/v1/availability/{userID}",
		authOnly(http.HandlerFunc(HandleGetUserAvailability(pool, cfg))))

	mux.Handle("PUT /api/v1/availability/{userID}/{date}",
		authOnly(http.HandlerFunc(HandleUpsertAvailability(pool, cfg))))
}
