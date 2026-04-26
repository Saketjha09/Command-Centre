package notifications

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Broadcaster defines the interface for real-time message delivery.
// It is implemented by the WebSocket hub.
type Broadcaster interface {
	BroadcastToUser(userID, msgType string, payload interface{}) error
}

// CreateAndBroadcast persists a notification to the database and attempts to push it via WebSocket.
func CreateAndBroadcast(
	ctx context.Context,
	pool *pgxpool.Pool,
	hub Broadcaster,
	params CreateNotificationParams,
) error {
	// 1. Persist to Database
	notification, err := CreateNotification(ctx, pool, params)
	if err != nil {
		slog.Error("notifications: failed to persist",
			"error", err,
			"recipient_id", params.RecipientID,
			"type", params.Type,
		)
		return err
	}

	// 2. Broadcast via WebSocket (Best-effort)
	// We use the created Notification struct as the payload so the frontend
	// receives the ID and timestamps immediately.
	err = hub.BroadcastToUser(
		params.RecipientID.String(),
		"notification:new",
		notification,
	)
	if err != nil {
		// Log but do not return error - DB persistence was successful.
		slog.Error("notifications: websocket broadcast failed",
			"error", err,
			"recipient_id", params.RecipientID,
			"notification_id", notification.ID,
		)
	}

	return nil
}
