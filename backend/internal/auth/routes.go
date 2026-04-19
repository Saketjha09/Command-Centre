package auth

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
)

// RegisterRoutes wires all auth handlers onto the provided mux using Go 1.22's
// method-pattern syntax. This is the only place that couples the auth domain
// to the HTTP layer — all handler logic stays in handlers.go.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	mux.HandleFunc("POST /api/v1/auth/logout",   HandleLogout())
	mux.HandleFunc("GET /api/v1/auth/me",        HandleMe(pool, cfg))
}
