// Package tasks contains the tasks domain: models, state machine, repository,
// service, handlers, and routes. It is the primary operational domain of the
// Freelance Command Center.
package tasks

import "time"

// TaskSummary is returned in list responses. Lightweight — omits
// notification_failed and deadline to keep arrays compact.
type TaskSummary struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Brand      string     `json:"brand"`
	Status     string     `json:"status"`
	AssignedTo *string    `json:"assigned_to,omitempty"`
	Deadline   *time.Time `json:"deadline,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// TaskDetail is returned for single-task responses. Full representation.
type TaskDetail struct {
	ID                 string     `json:"id"`
	Title              string     `json:"title"`
	Brand              string     `json:"brand"`
	Status             string     `json:"status"`
	AssignedTo         *string    `json:"assigned_to,omitempty"`
	CreatedBy          string     `json:"created_by"`
	Deadline           *time.Time `json:"deadline,omitempty"`
	NotificationFailed bool       `json:"notification_failed"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// CreateTaskRequest is the body for POST /api/v1/tasks.
type CreateTaskRequest struct {
	Title    string     `json:"title"`
	Brand    string     `json:"brand"`
	Deadline *time.Time `json:"deadline,omitempty"`
}

// AssignTaskRequest is the body for PATCH /api/v1/tasks/{id}/assign.
type AssignTaskRequest struct {
	UserID string `json:"user_id"`
}

// TransitionRequest is the body for PATCH /api/v1/tasks/{id}/status.
type TransitionRequest struct {
	Status string `json:"status"`
}
