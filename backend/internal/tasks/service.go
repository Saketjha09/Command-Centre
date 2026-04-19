package tasks

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
)

// ErrValidation marks user-facing validation errors that are safe to
// return directly to the client in a 400 response.
var ErrValidation = errors.New("tasks: validation error")

// validBrands is the exhaustive set of accepted brand strings.
// Mirrors the ops.brand ENUM defined in 001_initial_schema.sql.
var validBrands = map[string]bool{
	"master_app":   true,
	"supernova_ai": true,
}

// validStatuses is the exhaustive set of accepted status strings.
// Mirrors the ops.task_status ENUM defined in 001_initial_schema.sql.
var validStatuses = map[string]bool{
	"brief_pending": true,
	"in_progress":   true,
	"review":        true,
	"approved":      true,
	"paid":          true,
}

// CreateTask validates the request, then persists the new task.
// claims.UserID is used as the created_by FK value (required by schema).
func CreateTask(pool *pgxpool.Pool, claims *auth.TokenClaims, req CreateTaskRequest) (TaskDetail, error) {
	if strings.TrimSpace(req.Title) == "" {
		return TaskDetail{}, fmt.Errorf("%w: title is required", ErrValidation)
	}
	if !validBrands[req.Brand] {
		return TaskDetail{}, fmt.Errorf("%w: brand must be one of: master_app, supernova_ai", ErrValidation)
	}
	return createTask(context.Background(), pool, req, claims.UserID)
}

// ListTasks returns tasks with optional brand/status filters.
// Empty string means no filter for that dimension.
func ListTasks(pool *pgxpool.Pool, brand, status string) ([]TaskSummary, error) {
	if brand != "" && !validBrands[brand] {
		return nil, fmt.Errorf("%w: brand must be one of: master_app, supernova_ai", ErrValidation)
	}
	if status != "" && !validStatuses[status] {
		return nil, fmt.Errorf("%w: status must be one of: brief_pending, in_progress, review, approved, paid", ErrValidation)
	}
	return listTasks(context.Background(), pool, brand, status)
}

// GetTask fetches a single task by string UUID.
// Returns ErrTaskNotFound (from repository) if no task matches.
func GetTask(pool *pgxpool.Pool, id string) (TaskDetail, error) {
	if strings.TrimSpace(id) == "" {
		return TaskDetail{}, fmt.Errorf("%w: task id is required", ErrValidation)
	}
	return getTaskByID(context.Background(), pool, id)
}

// AssignTask assigns userID to a task. Both taskID and userID must be non-empty.
// Surfaces ErrTaskNotFound and ErrAlreadyAssigned directly — handlers map
// these to 404 and 409 respectively.
// claims is accepted for future audit-log integration.
func AssignTask(pool *pgxpool.Pool, claims *auth.TokenClaims, taskID, userID string) (TaskDetail, error) {
	if strings.TrimSpace(taskID) == "" {
		return TaskDetail{}, fmt.Errorf("%w: task id is required", ErrValidation)
	}
	if strings.TrimSpace(userID) == "" {
		return TaskDetail{}, fmt.Errorf("%w: user_id is required", ErrValidation)
	}
	// ErrTaskNotFound and ErrAlreadyAssigned propagate unchanged.
	return assignTask(context.Background(), pool, taskID, userID)
}

// TransitionStatus validates newStatus against known values, then delegates to
// the repository which runs the state machine check and the UPDATE.
// Surfaces ErrInvalidTransition directly — handler maps to 422.
// claims is accepted for future audit-log integration.
func TransitionStatus(pool *pgxpool.Pool, claims *auth.TokenClaims, taskID, newStatus string) (TaskDetail, error) {
	if !validStatuses[newStatus] {
		return TaskDetail{}, fmt.Errorf(
			"%w: status must be one of: brief_pending, in_progress, review, approved, paid",
			ErrValidation,
		)
	}
	// ErrTaskNotFound and ErrInvalidTransition propagate unchanged.
	return transitionStatus(context.Background(), pool, taskID, newStatus)
}
