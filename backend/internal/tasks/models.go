package tasks

import "time"

// TaskStatus defines the restricted set of values for a task's lifecycle stage.
type TaskStatus string

const (
	TaskStatusUnassigned TaskStatus = "unassigned"
	TaskStatusAssigned   TaskStatus = "assigned"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusInReview   TaskStatus = "in_review"
	TaskStatusDone       TaskStatus = "done"
)

// TaskSummary is returned in list responses.
type TaskSummary struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Brand          string     `json:"brand"`
	Status         TaskStatus `json:"status"`
	Priority       string     `json:"priority"`
	AssignedTo     *string    `json:"assigned_to,omitempty"`
	AssignedToName *string    `json:"assigned_to_name,omitempty"`
	Deadline       *time.Time `json:"deadline,omitempty"`
	ContentType    string     `json:"content_type"`
	CreatedAt      time.Time  `json:"created_at"`
}

// TaskDetail is returned for single-task responses.
type TaskDetail struct {
	ID                 string     `json:"id"`
	Title              string     `json:"title"`
	Description        string     `json:"description"`
	Brand              string     `json:"brand"`
	Status             TaskStatus `json:"status"`
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
	Status TaskStatus `json:"status"`
}

// TaskHistoryEntry represents a single event in a task's lifecycle.
type TaskHistoryEntry struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name,omitempty"`
	Action    string    `json:"action"`
	FromValue *string   `json:"from_value,omitempty"`
	ToValue   *string   `json:"to_value,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// SearchResult represents a hit in the global search.
type SearchResult struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"` // e.g. "Unassigned"
	Avatar   string `json:"avatar,omitempty"`
}

// SearchResponse is the body for GET /api/v1/search.
type SearchResponse struct {
	Results []SearchResult `json:"results"`
}

type UserMetrics struct {
	UserName string         `json:"user_name"`
	Counts   map[string]int `json:"counts"`
}

type DashboardMetricsResponse struct {
	Metrics []UserMetrics `json:"metrics"`
}

// Comment represents a single message left on a task.
type Comment struct {
	ID         string    `json:"id"`
	TaskID     string    `json:"task_id"`
	AuthorID   string    `json:"author_id"`
	AuthorName string    `json:"author_name"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"created_at"`
}
