package notifications

import (
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// RegisterRoutes registers notification trigger endpoints.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	// POST /api/v1/notifications/slack/ping/{userID}
	adminOnly := middleware.RequireRole("admin", "superadmin")
	mux.Handle("POST /api/v1/notifications/slack/ping/{id}",
		middleware.Authenticate(cfg)(adminOnly(http.HandlerFunc(HandleSlackPing(pool, cfg)))))
}

// HandleSlackPing handles manual Slack DMs to users.
func HandleSlackPing(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		// Verify sender context (extra check)
		_, ok := middleware.ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Get user's slack ID from DB
		var slackID string
		err := pool.QueryRow(r.Context(), "SELECT slack_user_id FROM ops.users WHERE id = $1", id).Scan(&slackID)
		if err != nil {
			http.Error(w, "user not found", http.StatusNotFound)
			log.Printf("notifications: user %s not found: %v", id, err)
			return
		}

		if slackID == "" {
			http.Error(w, "user has no Slack ID configured", http.StatusBadRequest)
			return
		}

		// Send ping
		err = SendDM(cfg, slackID, "Your attention is requested in the Command Center.")
		if err != nil {
			log.Printf("notifications: slack ping failed for %s: %v", slackID, err)
			http.Error(w, "failed to send Slack message", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
