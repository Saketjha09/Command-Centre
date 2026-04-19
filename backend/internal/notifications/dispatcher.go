package notifications

import (
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
)

// DispatchTaskAssignmentNotification fires a goroutine that sends a Slack DM
// to the assigned user. On failure it flips notification_failed = true in the DB.
//
// This function returns immediately — the goroutine result is invisible to
// the original HTTP request. The handler MUST write the HTTP response BEFORE
// calling this function (or at least not depend on its result).
func DispatchTaskAssignmentNotification(
	pool *pgxpool.Pool,
	cfg *config.Config,
	taskID, slackUserID, taskTitle, brand, deadline string,
) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("notifications: panic recovered in DispatchTaskAssignmentNotification: %v", r)
			}
		}()
		err := SendTaskAssignmentDM(cfg, slackUserID, taskTitle, brand, deadline)
		if err != nil {
			log.Printf("notifications: task assignment DM failed for task %s: %v", taskID, err)
			if dbErr := MarkNotificationFailed(pool, taskID); dbErr != nil {
				log.Printf("notifications: failed to mark notification_failed for task %s: %v", taskID, dbErr)
			}
		}
	}()
}

// DispatchStandupPing fires a goroutine that sends standup reminder DMs to
// all intern Slack IDs. There is no task ID associated, so failures are
// logged only — notification_failed is not applicable.
func DispatchStandupPing(cfg *config.Config, internSlackIDs []string) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("notifications: panic recovered in DispatchStandupPing: %v", r)
			}
		}()
		if err := SendStandupPing(cfg, internSlackIDs); err != nil {
			log.Printf("notifications: standup ping failed: %v", err)
			// No task ID to mark here — log only.
		}
	}()
}
