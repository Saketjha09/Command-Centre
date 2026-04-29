package payroll

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	adminOnly := middleware.Chain(
		auth.Authenticate(cfg),
		middleware.RequireRole("superadmin", "admin"),
	)

	mux.Handle("PUT /api/v1/payroll/rates/{editorID}",
		adminOnly(http.HandlerFunc(HandleUpsertRate(pool))))
	mux.Handle("GET /api/v1/payroll/rates/{editorID}",
		adminOnly(http.HandlerFunc(HandleGetEditorRates(pool))))
	mux.Handle("GET /api/v1/payroll/rates",
		adminOnly(http.HandlerFunc(HandleGetAllRates(pool))))
	mux.Handle("POST /api/v1/payroll/preview",
		adminOnly(http.HandlerFunc(HandlePreviewPayroll(pool))))
	mux.Handle("POST /api/v1/payroll/runs",
		adminOnly(http.HandlerFunc(HandleCreatePayrollRun(pool))))
	mux.Handle("PATCH /api/v1/payroll/runs/{runID}/paid",
		adminOnly(http.HandlerFunc(HandleMarkPaid(pool))))
	mux.Handle("GET /api/v1/payroll/runs",
		adminOnly(http.HandlerFunc(HandleGetPayrollRuns(pool))))
	mux.Handle("GET /api/v1/payroll/runs/{runID}",
		adminOnly(http.HandlerFunc(HandleGetPayrollRunDetail(pool))))
}
