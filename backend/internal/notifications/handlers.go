package notifications

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/internal/pkg/sheets"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// HandleListNotifications returns the most recent notifications for the authenticated user.
func HandleListNotifications(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		notifications, err := ListNotifications(r.Context(), pool, claims.UserID, 50)
		if err != nil {
			slog.Error("notifications: list failed", "error", err, "user_id", claims.UserID)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Ensure we return an empty array instead of null
		if notifications == nil {
			notifications = []Notification{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notifications)
	}
}

// HandleGetUnreadCount returns the count of unread notifications for the authenticated user.
func HandleGetUnreadCount(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		count, err := GetUnreadCount(r.Context(), pool, claims.UserID)
		if err != nil {
			slog.Error("notifications: unread count failed", "error", err, "user_id", claims.UserID)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"count": count})
	}
}

// HandleMarkAsRead marks a single notification as read.
func HandleMarkAsRead(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		idStr := r.PathValue("id")
		notifID, err := uuid.Parse(idStr)
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		err = MarkAsRead(r.Context(), pool, notifID, claims.UserID)
		if err != nil {
			// Security: Return 404 to avoid leaking existence of notifications for other users
			http.Error(w, "notification not found", http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// HandleMarkAllAsRead marks all unread notifications for the user as read.
func HandleMarkAllAsRead(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		err := MarkAllAsRead(r.Context(), pool, claims.UserID)
		if err != nil {
			slog.Error("notifications: mark all read failed", "error", err, "user_id", claims.UserID)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}



// VerifySlackSignature implements Slack's request signing verification.
// https://api.slack.com/authentication/verifying-requests-from-slack
func VerifySlackSignature(cfg *config.Config, r *http.Request) error {
	if cfg.SlackSigningSecret == "" {
		return nil // Skip if not configured (not recommended for prod)
	}

	timestamp := r.Header.Get("X-Slack-Request-Timestamp")
	signature := r.Header.Get("X-Slack-Signature")

	// 1. Check for replay attacks (5 minute window)
	t, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || time.Since(time.Unix(t, 0)) > 5*time.Minute {
		return fmt.Errorf("invalid timestamp")
	}

	// 2. Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body)) // Restore for later

	// 3. Create the base string
	baseString := fmt.Sprintf("v0:%s:%s", timestamp, string(body))

	// 4. Calculate HMAC-SHA256
	h := hmac.New(sha256.New, []byte(cfg.SlackSigningSecret))
	h.Write([]byte(baseString))
	expectedSignature := "v0=" + hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

// HandleSlackInteractive handles button clicks from Slack.
func HandleSlackInteractive(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := VerifySlackSignature(cfg, r); err != nil {
			log.Printf("notifications: invalid slack signature: %v", err)
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		payloadStr := r.FormValue("payload")
		var payload struct {
			Actions []struct {
				ActionID string `json:"action_id"`
				Value    string `json:"value"`
			} `json:"actions"`
			User struct {
				ID string `json:"id"`
			} `json:"user"`
		}

		if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
			http.Error(w, "bad payload", http.StatusBadRequest)
			return
		}

		for _, action := range payload.Actions {
			if action.ActionID == "verify_tally" {
				taskID := action.Value
				log.Printf("notifications: Slack user %s verified tally for task %s", payload.User.ID, taskID)
				
				// 1. Fetch task details for the ledger
				var (
					title         string
					brand         string
					payoutAmount float64
					userID        string
				)
				err := pool.QueryRow(r.Context(), 
					"SELECT title, brand, payout_amount, assigned_to FROM ops.tasks WHERE id = $1", 
					taskID).Scan(&title, &brand, &payoutAmount, &userID)
				
				if err != nil {
					log.Printf("notifications: failed to fetch task %s for sync: %v", taskID, err)
					http.Error(w, "internal error", http.StatusInternalServerError)
					return
				}

				// 2. Update status to approved
				_, err = pool.Exec(r.Context(), 
					"UPDATE ops.tasks SET status = 'approved', updated_at = now() WHERE id = $1", 
					taskID)
				if err != nil {
					log.Printf("notifications: failed to update task %s status: %v", taskID, err)
				}

				// 3. Dispatch Async Sync to Google Sheets
				// Row format: [Date, Task ID, Brand, Title, Amount]
				syncData := []any{
					time.Now().Format("2006-01-02"),
					taskID,
					brand,
					title,
					payoutAmount,
				}
				sheets.DispatchTallySync(pool, cfg, taskID, syncData)
			}
		}

		w.WriteHeader(http.StatusOK)
	}
}


// HandleSlackPing handles manual Slack DMs to users.
func HandleSlackPing(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		// Verify sender context (extra check)
		_, ok := auth.ClaimsFromContext(r.Context())
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
