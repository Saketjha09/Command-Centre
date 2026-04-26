package auth

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/authutil"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// RegisterRoutes wires all auth handlers onto the provided mux using Go 1.22's
// method-pattern syntax. This is the only place that couples the auth domain
// to the HTTP layer — all handler logic stays in handlers.go.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	authOnly := middleware.Chain(
		Authenticate(cfg),
	)

	mux.HandleFunc("POST /api/v1/auth/logout", HandleLogout())
	mux.Handle("GET /api/v1/auth/me", authOnly(http.HandlerFunc(HandleMe(pool, cfg))))
	mux.Handle("PATCH /api/v1/auth/me", authOnly(http.HandlerFunc(HandleUpdateProfile(pool, cfg))))
	mux.Handle("POST /api/v1/auth/avatar", authOnly(http.HandlerFunc(HandleUploadAvatar(pool, cfg))))

	// Admin & Superadmin: list users.
	adminOrSuper := middleware.Chain(
		Authenticate(cfg),
		middleware.RequireRole(authutil.RoleAdmin, authutil.RoleSuperAdmin),
	)
	mux.Handle("GET /api/v1/users", adminOrSuper(http.HandlerFunc(HandleListUsers(pool, cfg))))

	// Superadmin-only: manage users.
	superAdminOnly := middleware.Chain(
		Authenticate(cfg),
		middleware.RequireRole(authutil.RoleSuperAdmin),
	)
	mux.Handle("POST /api/v1/auth/admin/users", superAdminOnly(http.HandlerFunc(HandleCreateAdminUser(pool, cfg))))
	mux.Handle("PATCH /api/v1/auth/admin/users/{id}/role", superAdminOnly(http.HandlerFunc(HandleUpdateUserRole(pool, cfg))))
	mux.Handle("PATCH /api/v1/auth/admin/users/{id}/status", superAdminOnly(http.HandlerFunc(HandleUpdateUserStatus(pool, cfg))))
}
