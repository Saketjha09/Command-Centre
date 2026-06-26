package ops

import (
	"time"
)

type TaskStatus string

const (
	TaskStatusAssigned   TaskStatus = "assigned"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusDone       TaskStatus = "done"
)

type Task struct {
	ID            string     `json:"id"`
	BrandID       *string    `json:"brand_id"`
	BrandName     string     `json:"brand_name"`
	Brief         string     `json:"brief"`
	SheetLink     string     `json:"sheet_link"`
	AssigneeID    string     `json:"assignee_id"`
	AssigneeName  string     `json:"assignee_name"`
	AssigneeRole  string     `json:"assignee_role"`
	CreatedByID   string     `json:"created_by_id"`
	CreatedByName string     `json:"created_by_name"`
	Status        TaskStatus `json:"status"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type CreateTaskRequest struct {
	BrandID   *string `json:"brand_id"`
	BrandName string  `json:"brand_name"`
	Brief     string  `json:"brief"`
	SheetLink string  `json:"sheet_link"`
	AssigneeID string `json:"assignee_id"`
}

type UpdateStatusRequest struct {
	Status TaskStatus `json:"status"`
}

type TeamMember struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}
