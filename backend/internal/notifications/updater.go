package notifications

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// MarkNotificationFailed is the ONLY write path in the entire codebase that
// sets notification_failed = true on a task. It is called by dispatcher
// goroutines when an external API call (Slack, etc.) fails.
//
// Centralising this here prevents scattered UPDATE statements that could
// drift out of sync with the schema.
func MarkNotificationFailed(pool *pgxpool.Pool, taskID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := pool.Exec(ctx, `
		UPDATE ops.tasks
		SET notification_failed = true, updated_at = now()
		WHERE id = $1`,
		taskID,
	)
	return err
}
