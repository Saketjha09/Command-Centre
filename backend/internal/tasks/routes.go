package tasks

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// RegisterRoutes wires all task routes onto the provided mux.
// Two middleware chains are built here:
//   - authOnly: any valid JWT (freelancers can read tasks)
//   - adminOnly: valid JWT + superadmin or admin role (mutations)
//
// hub is forwarded only to mutating handlers that need to broadcast WS events.
// Read-only handlers receive no hub.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config, hub WSBroadcaster) {
	authOnly := middleware.Chain(
		middleware.Authenticate(cfg),
	)
	adminOnly := middleware.Chain(
		middleware.Authenticate(cfg),
		middleware.RequireRole("superadmin", "admin"),
	)

	// Create a task — admin and superadmin only.
	mux.Handle("POST /api/v1/tasks",
		adminOnly(http.HandlerFunc(HandleCreateTask(pool, cfg, hub))))

	// List all tasks — any authenticated user.
	mux.Handle("GET /api/v1/tasks",
		authOnly(http.HandlerFunc(HandleListTasks(pool, cfg))))

	// Get a single task — any authenticated user.
	mux.Handle("GET /api/v1/tasks/{id}",
		authOnly(http.HandlerFunc(HandleGetTask(pool, cfg))))

	// Assign a task to a user — admin and superadmin only.
	mux.Handle("PATCH /api/v1/tasks/{id}/assign",
		adminOnly(http.HandlerFunc(HandleAssignTask(pool, cfg, hub))))

	// Transition task status — admin and superadmin only.
	mux.Handle("PATCH /api/v1/tasks/{id}/status",
		adminOnly(http.HandlerFunc(HandleTransitionStatus(pool, cfg, hub))))
}

