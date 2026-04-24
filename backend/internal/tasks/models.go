// Package tasks contains the tasks domain: models, state machine, repository,
// service, handlers, and routes. It is the primary operational domain of the
// Freelance Command Center.
package tasks

import "time"

// TaskSummary is returned in list responses. Lightweight — omits
// notification_failed and deadline to keep arrays compact.
type TaskSummary struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Brand          string     `json:"brand"`
	Status         string     `json:"status"`
	Priority       string     `json:"priority"`
	AssignedTo     *string    `json:"assigned_to,omitempty"`
	AssignedToName *string    `json:"assigned_to_name,omitempty"`
	Deadline       *time.Time `json:"deadline,omitempty"`
	ContentType    string     `json:"content_type"`
	CreatedAt      time.Time  `json:"created_at"`
}

// TaskDetail is returned for single-task responses. Full representation.
type TaskDetail struct {
	ID                 string     `json:"id"`
	Title              string     `json:"title"`
	Description        string     `json:"description"`
	Brand              string     `json:"brand"`
	Status             string     `json:"status"`
	Priority           string     `json:"priority"`
	AssignedTo         *string    `json:"assigned_to,omitempty"`
	CreatedBy          string     `json:"created_by"`
	Deadline           *time.Time `json:"deadline,omitempty"`
	NotificationFailed   bool       `json:"notification_failed"`
	GoogleDriveFolderID  *string    `json:"google_drive_folder_id,omitempty"`
	PayoutAmount         float64    `json:"payout_amount"`
	SyncFailed           bool       `json:"sync_failed"`
	ContentType         string     `json:"content_type"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// CreateTaskRequest is the body for POST /api/v1/tasks.
type CreateTaskRequest struct {
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Brand        string     `json:"brand"`
	Priority     string     `json:"priority"`
	Deadline     *time.Time `json:"deadline,omitempty"`
	PayoutAmount float64    `json:"payout_amount"`
	ContentType  string     `json:"content_type"`
	AssignedTo   *string    `json:"assigned_to,omitempty"`
}

// AssignTaskRequest is the body for PATCH /api/v1/tasks/{id}/assign.
type AssignTaskRequest struct {
	UserID string `json:"user_id"`
}

// TransitionRequest is the body for PATCH /api/v1/tasks/{id}/status.
type TransitionRequest struct {
	Status string `json:"status"`
}

// TaskHistoryEntry represents a single event in a task's lifecycle.
type TaskHistoryEntry struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name,omitempty"` // Joined from users table
	Action    string    `json:"action"`
	FromValue *string   `json:"from_value,omitempty"`
	ToValue   *string   `json:"to_value,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// SearchResult represents a hit in the global search.
type SearchResult struct {
	ID       string `json:"id"`
	Type     string `json:"type"` // "task" or "user"
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"` // e.g. "Brief Pending" or "Freelancer"
	Avatar   string `json:"avatar,omitempty"`
}

// SearchResponse is the body for GET /api/v1/search.
type SearchResponse struct {
	Results []SearchResult `json:"results"`
}

// DashboardMetricsResponse is the body for GET /api/v1/dashboard/metrics.
type UserMetrics struct {
	UserName string         `json:"user_name"`
	Counts   map[string]int `json:"counts"` // content_type -> count
}

type DashboardMetricsResponse struct {
	Metrics []UserMetrics `json:"metrics"`
}
