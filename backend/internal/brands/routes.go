package brands

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	// Brands are viewable by any authenticated user
	mux.Handle("GET /api/v1/brands",
		auth.Authenticate(cfg)(HandleListBrands(pool)))

	// Only admin/superadmin can create or delete brands
	adminOnly := middleware.RequireRole("admin", "superadmin")
	
	mux.Handle("POST /api/v1/brands",
		auth.Authenticate(cfg)(adminOnly(HandleCreateBrand(pool))))

	mux.Handle("DELETE /api/v1/brands/{id}",
		auth.Authenticate(cfg)(adminOnly(HandleDeleteBrand(pool))))
}
