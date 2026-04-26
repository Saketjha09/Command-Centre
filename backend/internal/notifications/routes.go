package notifications

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// RegisterRoutes registers both Slack webhooks and in-app notification endpoints.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	// 1. Authenticated In-App Notification Routes
	authenticate := auth.Authenticate(cfg)

	mux.Handle("GET /api/v1/notifications",
		authenticate(http.HandlerFunc(HandleListNotifications(pool))))

	mux.Handle("GET /api/v1/notifications/unread-count",
		authenticate(http.HandlerFunc(HandleGetUnreadCount(pool))))

	// Go 1.22 Mux: Exact match /read-all must come BEFORE /{id}/read
	mux.Handle("PATCH /api/v1/notifications/read-all",
		authenticate(http.HandlerFunc(HandleMarkAllAsRead(pool))))

	mux.Handle("PATCH /api/v1/notifications/{id}/read",
		authenticate(http.HandlerFunc(HandleMarkAsRead(pool))))

	// 2. Slack Trigger Routes (Admin Only)
	adminOnly := middleware.RequireRole("admin", "superadmin")
	mux.Handle("POST /api/v1/notifications/slack/ping/{id}",
		authenticate(adminOnly(http.HandlerFunc(HandleSlackPing(pool, cfg)))))

	// 3. Public Slack Webhook (Secured by Signature Verification in Handler)
	mux.HandleFunc("POST /api/v1/notifications/slack/interactive", HandleSlackInteractive(pool, cfg))
}
