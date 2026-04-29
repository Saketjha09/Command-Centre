package payroll

import (
	"errors"
	"time"
)

var (
	ErrEditorNotFound  = errors.New("payroll: editor not found")
	ErrRateNotSet      = errors.New("payroll: rate not set for content type")
	ErrRunNotFound     = errors.New("payroll: run not found")
	ErrAlreadyPaid     = errors.New("payroll: run already marked paid")
	ErrNoEligibleTasks = errors.New("payroll: no eligible tasks in period")
)

type EditorRate struct {
	EditorID    string    `json:"editor_id"`
	EditorName  string    `json:"editor_name,omitempty"`
	ContentType string    `json:"content_type"`
	Rate        float64   `json:"rate"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PayrollTask struct {
	TaskID      string  `json:"task_id"`
	TaskTitle   string  `json:"task_title"`
	ContentType string  `json:"content_type"`
	RateApplied float64 `json:"rate_applied"`
	Amount      float64 `json:"amount"`
}

type PayrollRun struct {
	ID          string     `json:"id"`
	EditorID    string     `json:"editor_id"`
	EditorName  string     `json:"editor_name"`
	PeriodStart string     `json:"period_start"` // YYYY-MM-DD
	PeriodEnd   string     `json:"period_end"`   // YYYY-MM-DD
	TaskCount   int        `json:"task_count"`
	TotalAmount float64    `json:"total_amount"`
	Status      string     `json:"status"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type PayrollRunDetail struct {
	PayrollRun
	Tasks []PayrollTask `json:"tasks"`
}

type UpsertRateRequest struct {
	ContentType string  `json:"content_type"`
	Rate        float64 `json:"rate"`
}

type RunPayrollRequest struct {
	EditorID    string `json:"editor_id"`
	PeriodStart string `json:"period_start"` // YYYY-MM-DD
	PeriodEnd   string `json:"period_end"`   // YYYY-MM-DD
}
