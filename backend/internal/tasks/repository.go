package tasks

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/pkg/drive"
	"github.com/saket/command-center/backend/pkg/authutil"
	"github.com/saket/command-center/backend/pkg/config"
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
const detailCols = ` id, title, description, brand, status, priority, assigned_to, created_by, deadline, notification_failed, google_drive_folder_id, payout_amount, sync_failed, content_type, created_at, updated_at `

// summaryCols is the explicit column list for TaskSummary list scans.
const summaryCols = `
	t.id, t.title, t.brand, t.status, t.priority, t.assigned_to, t.deadline, t.content_type, t.created_at, u.name as assigned_to_name`

// ── write operations ──────────────────────────────────────────────────────────

// CreateTask inserts a new task with status defaulting to 'brief_pending'
// (defined at the schema level) and returns the full TaskDetail.
// created_by is required by the schema NOT NULL constraint.
// CreateTask inserts a new task and logs the creation action.
func createTask(_ context.Context, pool *pgxpool.Pool, cfg *config.Config, req CreateTaskRequest, createdBy string) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: begin create tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const q = `
		INSERT INTO ops.tasks (title, description, brand, priority, deadline, created_by, payout_amount, content_type, assigned_to)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING` + detailCols

	row := tx.QueryRow(ctx, q, req.Title, req.Description, req.Brand, req.Priority, req.Deadline, createdBy, req.PayoutAmount, req.ContentType, req.AssignedTo)
	detail, err := scanTaskDetail(row)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: create task insert: %w", err)
	}

	// Google Drive Integration: Generate folder and update task
	folderID, err := drive.EnsureTaskFolder(cfg, req.Brand, req.Title, detail.ID)
	if err != nil {
		log.Printf("tasks: warning: drive folder creation failed: %v", err)
	} else if folderID != "" {
		_, err = tx.Exec(ctx, "UPDATE ops.tasks SET google_drive_folder_id = $1 WHERE id = $2", folderID, detail.ID)
		if err != nil {
			log.Printf("tasks: warning: failed to update task with drive id: %v", err)
		}
		detail.GoogleDriveFolderID = &folderID
	}

	// Log creation
	if err := logTaskAction(ctx, tx, detail.ID, createdBy, "created", nil, nil); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: log create history: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: commit create tx: %w", err)
	}

	return detail, nil
}

// AssignTask sets the assigned_to field of a task inside a transaction.
// The transaction uses SELECT FOR UPDATE to lock the row, preventing concurrent
// double-assignment. This is the database-level enforcement required by the PRD.
//
// Returns ErrTaskNotFound if no task matches taskID.
// Returns ErrAlreadyAssigned if the task already has a non-null assigned_to.
// AssignTask sets the assigned_to field of a task inside a transaction.
func assignTask(_ context.Context, pool *pgxpool.Pool, taskID, userID, performingUserID string) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: begin assign tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const selectQ = `SELECT` + detailCols + ` FROM ops.tasks WHERE id = $1 FOR UPDATE`
	current, err := scanTaskDetail(tx.QueryRow(ctx, selectQ, taskID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { return TaskDetail{}, ErrTaskNotFound }
		return TaskDetail{}, fmt.Errorf("tasks: lock task for assign: %w", err)
	}

	const updateQ = `
		UPDATE ops.tasks
		SET assigned_to = $1, updated_at = now()
		WHERE id = $2
		RETURNING` + detailCols

	detail, err := scanTaskDetail(tx.QueryRow(ctx, updateQ, userID, taskID))
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: assign task update: %w", err)
	}

	// Log assignment
	if err := logTaskAction(ctx, tx, taskID, performingUserID, "assigned", current.AssignedTo, &userID); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: log assign history: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: commit assign tx: %w", err)
	}

	return detail, nil
}

// TransitionStatus validates the status transition via the state machine, then
// applies the update and logs the action in a transaction.
func transitionStatus(_ context.Context, pool *pgxpool.Pool, taskID, newStatus, performingUserID string) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: begin transition tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const selectQ = `SELECT` + detailCols + ` FROM ops.tasks WHERE id = $1 FOR UPDATE`
	current, err := scanTaskDetail(tx.QueryRow(ctx, selectQ, taskID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { return TaskDetail{}, ErrTaskNotFound }
		return TaskDetail{}, fmt.Errorf("tasks: lock task for status: %w", err)
	}

	if err := ValidateTransition(current.Status, newStatus); err != nil {
		return TaskDetail{}, err
	}

	const updateQ = `
		UPDATE ops.tasks
		SET status = $1, updated_at = now()
		WHERE id = $2
		RETURNING` + detailCols

	detail, err := scanTaskDetail(tx.QueryRow(ctx, updateQ, newStatus, taskID))
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: transition status update: %w", err)
	}

	// Log transition
	if err := logTaskAction(ctx, tx, taskID, performingUserID, "status_change", &current.Status, &newStatus); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: log transition history: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: commit transition tx: %w", err)
	}

	return detail, nil
}

// ── read operations ───────────────────────────────────────────────────────────

// GetTaskByID fetches a single task by its UUID string.
// Returns ErrTaskNotFound if no row matches.
// RBAC: If claims.Role is freelancer, the task must be assigned to them.
func getTaskByID(_ context.Context, pool *pgxpool.Pool, id string, claims *authutil.TokenClaims) (TaskDetail, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var q = `
		SELECT` + detailCols + `
		FROM ops.tasks
		WHERE id = $1`

	uuidID, err := uuid.Parse(id)
	if err != nil {
		return TaskDetail{}, fmt.Errorf("tasks: invalid uuid format: %w", err)
	}

	args := []any{uuidID}

	// RBAC: Freelancers only see their assigned tasks.
	if claims != nil && claims.Role == "freelancer" {
		q += ` AND (assigned_to = $2)`
		args = append(args, claims.UserID)
	}

	row := pool.QueryRow(ctx, q, args...)
	detail, err := scanTaskDetail(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TaskDetail{}, ErrTaskNotFound
		}
		return TaskDetail{}, fmt.Errorf("tasks: get task by id: %w", err)
	}
	return detail, nil
}

// listTasks returns tasks optionally filtered by brand and/or status.
// Pass empty strings to omit a filter. Results are ordered by created_at DESC.
// Always returns an empty slice (never nil) so the JSON response is [] not null.
func listTasks(_ context.Context, pool *pgxpool.Pool, claims *authutil.TokenClaims, brand, status string) ([]TaskSummary, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	// Cast enum columns to text for comparison so empty-string filters
	// pass through without triggering an invalid enum cast.
	q := `
		SELECT` + summaryCols + `
		FROM ops.tasks t
		LEFT JOIN ops.users u ON t.assigned_to = u.id
		WHERE ($1 = '' OR t.brand::text  = $1)
		  AND ($2 = '' OR t.status::text = $2)`

	args := []any{brand, status}

	// RBAC: Freelancers only see their assigned tasks.
	if claims != nil && claims.Role == "freelancer" {
		q += ` AND (t.assigned_to = $3)`
		args = append(args, claims.UserID)
	}

	q += ` ORDER BY t.created_at DESC`

	rows, err := pool.Query(ctx, q, args...)
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

// logTaskAction inserts a history record.
func logTaskAction(ctx context.Context, tx pgx.Tx, taskID, userID, action string, from, to *string) error {
	const q = `
		INSERT INTO ops.task_history (task_id, user_id, action, from_value, to_value)
		VALUES ($1, $2, $3, $4, $5)`
	_, err := tx.Exec(ctx, q, taskID, userID, action, from, to)
	return err
}

// listTaskHistory fetches history entries for a task, joined with user names.
func listTaskHistory(_ context.Context, pool *pgxpool.Pool, taskID string) ([]TaskHistoryEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		SELECT h.id, h.task_id, h.user_id, u.name, h.action, h.from_value, h.to_value, h.created_at
		FROM ops.task_history h
		JOIN ops.users u ON h.user_id = u.id
		WHERE h.task_id = $1
		ORDER BY h.created_at DESC`

	rows, err := pool.Query(ctx, q, taskID)
	if err != nil {
		return nil, fmt.Errorf("tasks: list history query: %w", err)
	}
	defer rows.Close()

	return scanHistoryRows(rows)
}

// listGlobalActivity fetches the latest history entries across all tasks.
// RBAC: Freelancers only see history for tasks assigned to them.
func listGlobalActivity(pool *pgxpool.Pool, claims *authutil.TokenClaims, limit int) ([]TaskHistoryEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	q := `
		SELECT h.id, h.task_id, h.user_id, u.name, h.action, h.from_value, h.to_value, h.created_at
		FROM ops.task_history h
		JOIN ops.users u ON h.user_id = u.id
		JOIN ops.tasks t ON h.task_id = t.id`
	
	args := []any{limit}
	
	if claims != nil && claims.Role == "freelancer" {
		q += ` WHERE (t.assigned_to = $2)`
		args = append(args, claims.UserID)
	}
	
	q += ` ORDER BY h.created_at DESC LIMIT $1`

	rows, err := pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("tasks: list global history query: %w", err)
	}
	defer rows.Close()

	return scanHistoryRows(rows)
}

func scanHistoryRows(rows pgx.Rows) ([]TaskHistoryEntry, error) {
	var history []TaskHistoryEntry
	for rows.Next() {
		var h TaskHistoryEntry
		var from, to pgtype.Text
		var id, tID, uID pgtype.UUID
		if err := rows.Scan(&id, &tID, &uID, &h.UserName, &h.Action, &from, &to, &h.CreatedAt); err != nil {
			return nil, fmt.Errorf("tasks: scan history: %w", err)
		}
		h.ID = pgUUIDString(id)
		h.TaskID = pgUUIDString(tID)
		h.UserID = pgUUIDString(uID)
		if from.Valid { h.FromValue = &from.String }
		if to.Valid { h.ToValue = &to.String }
		history = append(history, h)
	}
	return history, nil
}

// searchAll performs a fuzzy search across tasks (by title) and users (by name).
func searchAll(_ context.Context, pool *pgxpool.Pool, query string) ([]SearchResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	if query == "" { return []SearchResult{}, nil }
	
	// Fuzzy match with simple ILIKE %q%
	const q = `
		(
			SELECT id::text, 'task' as type, title, status as subtitle, '' as avatar
			FROM ops.tasks
			WHERE title ILIKE '%' || $1 || '%'
			LIMIT 10
		)
		UNION ALL
		(
			SELECT id::text, 'user' as type, name as title, role as subtitle, COALESCE(avatar_url, '') as avatar
			FROM ops.users
			WHERE name ILIKE '%' || $1 || '%'
			LIMIT 10
		)
		LIMIT 20`

	rows, err := pool.Query(ctx, q, query)
	if err != nil {
		return nil, fmt.Errorf("tasks: search query: %w", err)
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.ID, &r.Type, &r.Title, &r.Subtitle, &r.Avatar); err != nil {
			return nil, fmt.Errorf("tasks: scan search: %w", err)
		}
		results = append(results, r)
	}
	return results, nil
}

// getDashboardMetrics returns the total count of completed tasks grouped by user and content_type.
func getDashboardMetrics(_ context.Context, pool *pgxpool.Pool) (DashboardMetricsResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	const q = `
		SELECT u.name, t.content_type::text, COUNT(*)
		FROM ops.tasks t
		JOIN ops.users u ON t.assigned_to = u.id
		WHERE t.status = 'approved' OR t.status = 'paid'
		GROUP BY u.name, t.content_type
		ORDER BY u.name, t.content_type`

	rows, err := pool.Query(ctx, q)
	if err != nil {
		return DashboardMetricsResponse{}, fmt.Errorf("tasks: metrics query: %w", err)
	}
	defer rows.Close()

	userMap := make(map[string]UserMetrics)
	for rows.Next() {
		var name, contentType string
		var count int
		if err := rows.Scan(&name, &contentType, &count); err != nil {
			return DashboardMetricsResponse{}, fmt.Errorf("tasks: scan metrics: %w", err)
		}

		m, ok := userMap[name]
		if !ok {
			m = UserMetrics{UserName: name, Counts: make(map[string]int)}
		}
		m.Counts[contentType] = count
		userMap[name] = m
	}

	var res DashboardMetricsResponse
	for _, m := range userMap {
		res.Metrics = append(res.Metrics, m)
	}
	// If empty, return [] not null
	if res.Metrics == nil {
		res.Metrics = make([]UserMetrics, 0)
	}

	return res, nil
}

// ── scan helpers ──────────────────────────────────────────────────────────────

// scanTaskDetail scans a pgx.Row into a TaskDetail.
// Returns the raw pgx error (including pgx.ErrNoRows) so callers can
// inspect it with errors.Is before wrapping.
func scanTaskDetail(row pgx.Row) (TaskDetail, error) {
	var (
		id                 pgtype.UUID
		title              string
		description        pgtype.Text
		brand, status, priority string
		assignedTo         pgtype.UUID
		createdBy          pgtype.UUID
		deadline           pgtype.Timestamptz
		notifFailed        bool
		driveFolderID      pgtype.Text
		payoutAmount       float64
		syncFailed         bool
		contentType        pgtype.Text
		createdAt, updatedAt time.Time
	)
	if err := row.Scan(
		&id, &title, &description, &brand, &status, &priority,
		&assignedTo, &createdBy, &deadline,
		&notifFailed, &driveFolderID, &payoutAmount, &syncFailed, &contentType, &createdAt, &updatedAt,
	); err != nil {
		return TaskDetail{}, err
	}

	d := TaskDetail{
		ID:                 pgUUIDString(id),
		Title:              title,
		Description:        description.String,
		Brand:              brand,
		Status:             status,
		Priority:           priority,
		CreatedBy:          pgUUIDString(createdBy),
		NotificationFailed: notifFailed,
		PayoutAmount:       payoutAmount,
		SyncFailed:         syncFailed,
		ContentType:        contentType.String,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
	}
	if driveFolderID.Valid {
		d.GoogleDriveFolderID = &driveFolderID.String
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
		title, brand, status, priority string
		assignedTo           pgtype.UUID
		deadline             pgtype.Timestamptz
		contentType          pgtype.Text
		createdAt            time.Time
		assignedToName       pgtype.Text
	)
	if err := rows.Scan(&id, &title, &brand, &status, &priority, &assignedTo, &deadline, &contentType, &createdAt, &assignedToName); err != nil {
		return TaskSummary{}, err
	}
	s := TaskSummary{
		ID:        pgUUIDString(id),
		Title:     title,
		Brand:     brand,
		Status:    status,
		Priority:  priority,
		ContentType: contentType.String,
		CreatedAt: createdAt,
	}
	if assignedTo.Valid {
		str := pgUUIDString(assignedTo)
		s.AssignedTo = &str
	}
	if assignedToName.Valid {
		s.AssignedToName = &assignedToName.String
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
