package cron

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/notifications"
	"github.com/saket/command-center/backend/internal/tasks"
)

// StartSLAWatcher launches a blocking loop that ticks hourly to evaluate SLA
// deadlines. It should be run in a background goroutine and will exit when ctx is canceled.
func StartSLAWatcher(ctx context.Context, pool *pgxpool.Pool, hub notifications.Broadcaster) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runSLACheck(ctx, pool, hub)
		}
	}
}

func runSLACheck(ctx context.Context, pool *pgxpool.Pool, hub notifications.Broadcaster) {
	atRiskTasks, err := tasks.FetchSLAAtRiskTasks(ctx, pool)
	if err != nil {
		slog.Error("cron: failed to fetch SLA at-risk tasks", "error", err)
		return
	}

	for _, task := range atRiskTasks {
		// a. Parse task.CreatedBy as uuid.UUID
		recipientUUID, err := uuid.Parse(task.CreatedBy)
		if err != nil {
			slog.Error("cron: failed to parse task created_by UUID", "error", err, "task_id", task.ID)
			continue
		}

		// b. Parse task.ID as uuid.UUID
		taskUUID, err := uuid.Parse(task.ID)
		if err != nil {
			slog.Error("cron: failed to parse task ID UUID", "error", err, "task_id", task.ID)
			continue
		}

		// c. Call notifs.CreateAndBroadcast
		params := notifications.CreateNotificationParams{
			RecipientID:   recipientUUID,
			Type:          "sla_warning",
			Title:         "Task deadline approaching",
			Message:       fmt.Sprintf("%q is due in less than 24 hours", task.Title),
			RelatedTaskID: &taskUUID,
		}

		if err := notifications.CreateAndBroadcast(ctx, pool, hub, params); err != nil {
			// e. Log any errors with slog.Error — do not abort the loop
			slog.Error("cron: failed to broadcast SLA alert", "error", err, "task_id", task.ID)
			continue
		}

		// d. If CreateAndBroadcast succeeds: call tasks.MarkSLAAlerted
		if err := tasks.MarkSLAAlerted(ctx, pool, task.ID); err != nil {
			slog.Error("cron: failed to mark SLA alerted", "error", err, "task_id", task.ID)
			continue
		}
	}
}
