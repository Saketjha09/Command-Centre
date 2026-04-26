package notifications

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CreateNotification persists a new notification to the database.
func CreateNotification(ctx context.Context, pool *pgxpool.Pool, params CreateNotificationParams) (Notification, error) {
	var n Notification
	query := `
		INSERT INTO ops.notifications (recipient_id, type, title, message, related_task_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, recipient_id, type, title, message, related_task_id, is_read, created_at
	`
	err := pool.QueryRow(ctx, query,
		params.RecipientID,
		params.Type,
		params.Title,
		params.Message,
		params.RelatedTaskID,
	).Scan(
		&n.ID,
		&n.RecipientID,
		&n.Type,
		&n.Title,
		&n.Message,
		&n.RelatedTaskID,
		&n.IsRead,
		&n.CreatedAt,
	)
	if err != nil {
		return Notification{}, fmt.Errorf("failed to create notification: %w", err)
	}
	return n, nil
}

// ListNotifications retrieves the most recent notifications for a specific user.
func ListNotifications(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, limit int) ([]Notification, error) {
	query := `
		SELECT id, recipient_id, type, title, message, related_task_id, is_read, created_at
		FROM ops.notifications
		WHERE recipient_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list notifications: %w", err)
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(
			&n.ID,
			&n.RecipientID,
			&n.Type,
			&n.Title,
			&n.Message,
			&n.RelatedTaskID,
			&n.IsRead,
			&n.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		notifications = append(notifications, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	return notifications, nil
}

// MarkAsRead marks a specific notification as read, provided it belongs to the given user.
func MarkAsRead(ctx context.Context, pool *pgxpool.Pool, notificationID uuid.UUID, userID uuid.UUID) error {
	query := `
		UPDATE ops.notifications
		SET is_read = TRUE
		WHERE id = $1 AND recipient_id = $2
	`
	result, err := pool.Exec(ctx, query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("notification not found or does not belong to user")
	}

	return nil
}

// MarkAllAsRead marks all unread notifications for a user as read.
func MarkAllAsRead(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) error {
	query := `
		UPDATE ops.notifications
		SET is_read = TRUE
		WHERE recipient_id = $1 AND is_read = FALSE
	`
	_, err := pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}
	return nil
}

// GetUnreadCount returns the number of unread notifications for a specific user.
func GetUnreadCount(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int, error) {
	var count int
	query := `
		SELECT COUNT(*)
		FROM ops.notifications
		WHERE recipient_id = $1 AND is_read = FALSE
	`
	err := pool.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}
	return count, nil
}
