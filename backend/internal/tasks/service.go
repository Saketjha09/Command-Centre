package tasks

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/authutil"
	"github.com/saket/command-center/backend/pkg/config"
)

// ErrValidation marks user-facing validation errors that are safe to
// return directly to the client in a 400 response.
var ErrValidation = errors.New("tasks: validation error")

// CreateTask validates the request, then persists the new task.
// claims.UserID is used as the created_by FK value (required by schema).
func CreateTask(pool *pgxpool.Pool, cfg *config.Config, claims *authutil.TokenClaims, req CreateTaskRequest) (TaskDetail, error) {
	if strings.TrimSpace(req.Title) == "" {
		return TaskDetail{}, fmt.Errorf("%w: title is required", ErrValidation)
	}
	// We allow any brand string as it is validated against the dynamic brands table at the DB/Logic level if needed,
	// but for the tasks table it is just text now.
	return createTask(context.Background(), pool, cfg, req, claims.UserID)
}

// ListTasks returns tasks with optional brand/status filters.
// Empty string means no filter for that dimension.
func ListTasks(pool *pgxpool.Pool, claims *authutil.TokenClaims, brand, status string) ([]TaskSummary, error) {
	// Flexible brand and status filters
	return listTasks(context.Background(), pool, claims, brand, status)
}

// GetTask fetches a single task by string UUID.
// Returns ErrTaskNotFound (from repository) if no task matches.
func GetTask(pool *pgxpool.Pool, claims *authutil.TokenClaims, id string) (TaskDetail, error) {
	if strings.TrimSpace(id) == "" {
		return TaskDetail{}, fmt.Errorf("%w: task id is required", ErrValidation)
	}
	return getTaskByID(context.Background(), pool, id, claims)
}

// AssignTask assigns userID to a task. Both taskID and userID must be non-empty.
// Surfaces ErrTaskNotFound and ErrAlreadyAssigned directly — handlers map
// these to 404 and 409 respectively.
// claims is accepted for future audit-log integration.
func AssignTask(pool *pgxpool.Pool, claims *authutil.TokenClaims, taskID, userID string) (TaskDetail, error) {
	if strings.TrimSpace(taskID) == "" {
		return TaskDetail{}, fmt.Errorf("%w: task id is required", ErrValidation)
	}
	if strings.TrimSpace(userID) == "" {
		return TaskDetail{}, fmt.Errorf("%w: user_id is required", ErrValidation)
	}
	// ErrTaskNotFound and ErrAlreadyAssigned propagate unchanged.
	return assignTask(context.Background(), pool, taskID, userID, claims.UserID)
}

// TransitionStatus validates newStatus against known values, then delegates to
// the repository which runs the state machine check and the UPDATE.
// Surfaces ErrInvalidTransition and ErrForbidden directly — handler maps these
// to appropriate HTTP status codes.
// claims is accepted for ownership and role-based transition validation.
func TransitionStatus(ctx context.Context, pool *pgxpool.Pool, claims *authutil.TokenClaims, taskID, newStatus string) (TaskDetail, error) {
	// ErrTaskNotFound, ErrInvalidTransition, and ErrForbidden propagate unchanged.
	return transitionStatus(ctx, pool, taskID, newStatus, claims)
}

// ListTaskHistory returns the history entries for a task.
func ListTaskHistory(pool *pgxpool.Pool, id string) ([]TaskHistoryEntry, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("%w: task id is required", ErrValidation)
	}
	return listTaskHistory(context.Background(), pool, id)
}

// GlobalSearch performs a search across the entire application.
func GlobalSearch(pool *pgxpool.Pool, query string) ([]SearchResult, error) {
	return searchAll(context.Background(), pool, query)
}

// GetDashboardMetrics returns metrics for the dashboard.
func GetDashboardMetrics(pool *pgxpool.Pool) (DashboardMetricsResponse, error) {
	return getDashboardMetrics(context.Background(), pool)
}

// SuggestEditors returns a list of suggested editors for a task.
func SuggestEditors(pool *pgxpool.Pool, claims *authutil.TokenClaims, taskID string) ([]EditorSuggestion, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("%w: task id is required", ErrValidation)
	}
	return suggestEditors(context.Background(), pool, taskID)
}
