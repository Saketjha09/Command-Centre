package notifications

import (
	"time"

	"github.com/google/uuid"
)

// Notification represents an in-app alert for a user.
type Notification struct {
	ID            uuid.UUID  `json:"id"`
	RecipientID   uuid.UUID  `json:"recipient_id"`
	Type          string     `json:"type"`
	Title         string     `json:"title"`
	Message       string     `json:"message"`
	RelatedTaskID *uuid.UUID `json:"related_task_id,omitempty"`
	IsRead        bool       `json:"is_read"`
	CreatedAt     time.Time  `json:"created_at"`
}

// CreateNotificationParams holds the data needed to persist a new notification.
type CreateNotificationParams struct {
	RecipientID   uuid.UUID
	Type          string
	Title         string
	Message       string
	RelatedTaskID *uuid.UUID
}
