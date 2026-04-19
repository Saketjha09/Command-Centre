package tasks

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Package-level sentinel errors for the tasks repository.
var (
	// ErrTaskNotFound is returned when no task matches the supplied ID.
	ErrTaskNotFound = errors.New("tasks: task not found")

	// ErrAlreadyAssigned is returned by AssignTask when the target task
	// already has a non-null assigned_to value. Prevents double-assignment
	// even under concurrent requests because the check runs inside a
	// SELECT FOR UPDATE transaction.
	ErrAlreadyAssigned = errors.New("tasks: task already has an assignee")
)

const dbTimeout = 5 * time.Second

// All repository functions ignore the caller-supplied context and derive their
// own 5-second budget from context.Background(). This ensures HTTP request
// cancellations cannot abort mid-write database operations.

// ── column list shared across queries ────────────────────────────────────────

// detailCols is the explicit column list for full TaskDetail scans.
// Order must match scanTaskDetail exactly.
const detailCols = `
	id, title, brand, status,
	assigned_to, created_by, deadline,
	notification_failed, created_at, updated_at`

// summaryCols is the explicit column list for TaskSummary list scans.
const summaryCols = `
	id, title, brand, status, assigned_to, deadline, created_at`

// ── write operations ──────────────────────────────────────────────────────────

// CreateTask inserts a new task with status defaulting to 'brief_pending'
// (defined at the schema level) and returns the full TaskDetail.
// created_by is required by the schema NOT NULL constraint.
func createTask(_ context.Context, pool *pgxpool.Pool, req CreateTaskRequest, createdBy string) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		INSERT INTO ops.tasks (title, brand, deadline, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING` + detailCols

	row := pool.QueryRow(ctx, q, req.Title, req.Brand, req.Deadline, createdBy)
	detail, err := scanTaskDetail(row)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: create task: %w", err)
	}
	return detail, nil
}

// AssignTask sets the assigned_to field of a task inside a transaction.
// The transaction uses SELECT FOR UPDATE to lock the row, preventing concurrent
// double-assignment. This is the database-level enforcement required by the PRD.
//
// Returns ErrTaskNotFound if no task matches taskID.
// Returns ErrAlreadyAssigned if the task already has a non-null assigned_to.
func assignTask(_ context.Context, pool *pgxpool.Pool, taskID, userID string) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: begin assign tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op after Commit

	// Step 1 — Lock the row exclusively so no concurrent assign can race us.
	const selectQ = `
		SELECT` + detailCols + `
		FROM ops.tasks
		WHERE id = $1
		FOR UPDATE`

	current, err := scanTaskDetail(tx.QueryRow(ctx, selectQ, taskID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TaskDetail{}, ErrTaskNotFound
		}
		return TaskDetail{}, fmt.Errorf("tasks: lock task for assign: %w", err)
	}

	// Step 2 — Reject if already assigned. Checked inside the lock.
	if current.AssignedTo != nil {
		return TaskDetail{}, ErrAlreadyAssigned
	}

	// Step 3 — Apply the assignment and return the updated row via RETURNING.
	const updateQ = `
		UPDATE ops.tasks
		SET assigned_to = $1, updated_at = now()
		WHERE id = $2
		RETURNING` + detailCols

	detail, err := scanTaskDetail(tx.QueryRow(ctx, updateQ, userID, taskID))
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: assign task update: %w", err)
	}

	// Step 4 — Commit.
	if err := tx.Commit(ctx); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: commit assign tx: %w", err)
	}

	return detail, nil
}

// TransitionStatus validates the status transition via the state machine, then
// applies the update. GetTaskByID is called first for a plain read — no
// transaction needed because the UPDATE itself is atomic.
func transitionStatus(_ context.Context, pool *pgxpool.Pool, taskID, newStatus string) (TaskDetail, error) {
	// Step 1 — Fetch current status with a plain read.
	current, err := getTaskByID(context.Background(), pool, taskID)
	if err != nil {
		return TaskDetail{}, err // ErrTaskNotFound propagates unchanged
	}

	// Step 2 — Validate via the pure state machine.
	if err := ValidateTransition(current.Status, newStatus); err != nil {
		return TaskDetail{}, err // ErrInvalidTransition propagates unchanged
	}

	// Step 3 — Apply and return the updated row.
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		UPDATE ops.tasks
		SET status = $1, updated_at = now()
		WHERE id = $2
		RETURNING` + detailCols

	detail, err := scanTaskDetail(pool.QueryRow(ctx, q, newStatus, taskID))
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: transition status update: %w", err)
	}
	return detail, nil
}

// ── read operations ───────────────────────────────────────────────────────────

// GetTaskByID fetches a single task by its UUID string.
// Returns ErrTaskNotFound if no row matches.
func getTaskByID(_ context.Context, pool *pgxpool.Pool, id string) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		SELECT` + detailCols + `
		FROM ops.tasks
		WHERE id = $1`

	detail, err := scanTaskDetail(pool.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TaskDetail{}, ErrTaskNotFound
		}
		return TaskDetail{}, fmt.Errorf("tasks: get task by id: %w", err)
	}
	return detail, nil
}

// ListTasks returns tasks optionally filtered by brand and/or status.
// Pass empty strings to omit a filter. Results are ordered by created_at DESC.
// Always returns an empty slice (never nil) so the JSON response is [] not null.
func listTasks(_ context.Context, pool *pgxpool.Pool, brand, status string) ([]TaskSummary, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	// Cast enum columns to text for comparison so empty-string filters
	// pass through without triggering an invalid enum cast.
	const q = `
		SELECT` + summaryCols + `
		FROM ops.tasks
		WHERE ($1 = '' OR brand::text  = $1)
		  AND ($2 = '' OR status::text = $2)
		ORDER BY created_at DESC`

	rows, err := pool.Query(ctx, q, brand, status)
	if err != nil {
		return nil, fmt.Errorf("tasks: list tasks query: %w", err)
	}
	defer rows.Close()

	result := make([]TaskSummary, 0)
	for rows.Next() {
		s, err := scanTaskSummary(rows)
		if err != nil {
			return nil, fmt.Errorf("tasks: scan task summary: %w", err)
		}
		result = append(result, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("tasks: list tasks rows: %w", err)
	}
	return result, nil
}

// ── scan helpers ──────────────────────────────────────────────────────────────

// scanTaskDetail scans a pgx.Row into a TaskDetail.
// Returns the raw pgx error (including pgx.ErrNoRows) so callers can
// inspect it with errors.Is before wrapping.
func scanTaskDetail(row pgx.Row) (TaskDetail, error) {
	var (
		id                 pgtype.UUID
		title, brand, status string
		assignedTo         pgtype.UUID
		createdBy          pgtype.UUID
		deadline           pgtype.Timestamptz
		notifFailed        bool
		createdAt, updatedAt time.Time
	)
	if err := row.Scan(
		&id, &title, &brand, &status,
		&assignedTo, &createdBy, &deadline,
		&notifFailed, &createdAt, &updatedAt,
	); err != nil {
		return TaskDetail{}, err
	}

	d := TaskDetail{
		ID:                 pgUUIDString(id),
		Title:              title,
		Brand:              brand,
		Status:             status,
		CreatedBy:          pgUUIDString(createdBy),
		NotificationFailed: notifFailed,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
	}
	if assignedTo.Valid {
		s := pgUUIDString(assignedTo)
		d.AssignedTo = &s
	}
	if deadline.Valid {
		t := deadline.Time
		d.Deadline = &t
	}
	return d, nil
}

// scanTaskSummary scans a pgx.Rows iteration into a TaskSummary.
func scanTaskSummary(rows pgx.Rows) (TaskSummary, error) {
	var (
		id                   pgtype.UUID
		title, brand, status string
		assignedTo           pgtype.UUID
		deadline             pgtype.Timestamptz
		createdAt            time.Time
	)
	if err := rows.Scan(&id, &title, &brand, &status, &assignedTo, &deadline, &createdAt); err != nil {
		return TaskSummary{}, err
	}
	s := TaskSummary{
		ID:        pgUUIDString(id),
		Title:     title,
		Brand:     brand,
		Status:    status,
		CreatedAt: createdAt,
	}
	if assignedTo.Valid {
		str := pgUUIDString(assignedTo)
		s.AssignedTo = &str
	}
	if deadline.Valid {
		t := deadline.Time
		s.Deadline = &t
	}
	return s, nil
}

// pgUUIDString converts a pgtype.UUID to its canonical hyphenated string.
func pgUUIDString(u pgtype.UUID) string {
	return uuid.UUID(u.Bytes).String()
}
