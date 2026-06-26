package ops

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const dbTimeout = 5 * time.Second

func ListTasks(ctx context.Context, pool *pgxpool.Pool, callerID, callerRole string) ([]Task, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	var query string
	var args []any

	if callerRole == "admin" || callerRole == "superadmin" {
		query = `SELECT id, brand_id, brand_name, brief, COALESCE(sheet_link,''), assignee_id, assignee_name, assignee_role,
		                created_by_id, created_by_name, status, created_at, updated_at
		         FROM ops.ops_tasks ORDER BY created_at DESC`
	} else {
		query = `SELECT id, brand_id, brand_name, brief, COALESCE(sheet_link,''), assignee_id, assignee_name, assignee_role,
		                created_by_id, created_by_name, status, created_at, updated_at
		         FROM ops.ops_tasks WHERE assignee_id = $1 ORDER BY created_at DESC`
		uid, err := uuid.Parse(callerID)
		if err != nil {
			return nil, fmt.Errorf("ops: invalid caller id: %w", err)
		}
		args = append(args, uid)
	}

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("ops: list tasks: %w", err)
	}
	defer rows.Close()

	tasks := make([]Task, 0)
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, fmt.Errorf("ops: scan task: %w", err)
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func CreateTask(ctx context.Context, pool *pgxpool.Pool, callerID, callerName string, req CreateTaskRequest) (Task, error) {
	if strings.TrimSpace(req.Brief) == "" {
		return Task{}, fmt.Errorf("brief is required")
	}
	if strings.TrimSpace(req.AssigneeID) == "" {
		return Task{}, fmt.Errorf("assignee_id is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	assigneeUID, err := uuid.Parse(req.AssigneeID)
	if err != nil {
		return Task{}, fmt.Errorf("invalid assignee_id")
	}
	callerUID, err := uuid.Parse(callerID)
	if err != nil {
		return Task{}, fmt.Errorf("invalid caller id")
	}

	var assigneeName, assigneeRole string
	err = pool.QueryRow(ctx, `SELECT name, role FROM ops.users WHERE id = $1`, assigneeUID).Scan(&assigneeName, &assigneeRole)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Task{}, fmt.Errorf("assignee not found")
		}
		return Task{}, fmt.Errorf("ops: lookup assignee: %w", err)
	}

	var brandID *uuid.UUID
	if req.BrandID != nil && *req.BrandID != "" {
		parsed, err := uuid.Parse(*req.BrandID)
		if err == nil {
			brandID = &parsed
		}
	}

	row := pool.QueryRow(ctx, `
		INSERT INTO ops.ops_tasks (brand_id, brand_name, brief, sheet_link, assignee_id, assignee_name, assignee_role, created_by_id, created_by_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, brand_id, brand_name, brief, COALESCE(sheet_link,''), assignee_id, assignee_name, assignee_role,
		          created_by_id, created_by_name, status, created_at, updated_at`,
		brandID, req.BrandName, req.Brief, req.SheetLink, assigneeUID, assigneeName, assigneeRole, callerUID, callerName,
	)

	t, err := scanTaskRow(row)
	if err != nil {
		return Task{}, fmt.Errorf("ops: create task: %w", err)
	}

	slog.Info("ops: task created", "id", t.ID, "assignee", assigneeName)
	return t, nil
}

func UpdateStatus(ctx context.Context, pool *pgxpool.Pool, taskID, callerID, callerRole string, status TaskStatus) error {
	if status != TaskStatusAssigned && status != TaskStatusInProgress && status != TaskStatusDone {
		return fmt.Errorf("invalid status: %s", status)
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	taskUID, err := uuid.Parse(taskID)
	if err != nil {
		return fmt.Errorf("invalid task id")
	}

	var assigneeID pgtype.UUID
	err = pool.QueryRow(ctx, `SELECT assignee_id FROM ops.ops_tasks WHERE id = $1`, taskUID).Scan(&assigneeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("ops: lookup task: %w", err)
	}

	if callerRole != "admin" && callerRole != "superadmin" {
		ownerID := uuid.UUID(assigneeID.Bytes).String()
		if ownerID != callerID {
			return fmt.Errorf("forbidden")
		}
	}

	tag, err := pool.Exec(ctx, `UPDATE ops.ops_tasks SET status = $1, updated_at = NOW() WHERE id = $2`, status, taskUID)
	if err != nil {
		return fmt.Errorf("ops: update status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("task not found")
	}
	return nil
}

func ListTeamMembers(ctx context.Context, pool *pgxpool.Pool) ([]TeamMember, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	rows, err := pool.Query(ctx, `SELECT id, name, role FROM ops.users WHERE role IN ('freelancer', 'admin') AND is_active = true ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("ops: list team: %w", err)
	}
	defer rows.Close()

	members := make([]TeamMember, 0)
	for rows.Next() {
		var m TeamMember
		var id pgtype.UUID
		if err := rows.Scan(&id, &m.Name, &m.Role); err != nil {
			return nil, fmt.Errorf("ops: scan member: %w", err)
		}
		m.ID = uuid.UUID(id.Bytes).String()
		members = append(members, m)
	}
	return members, rows.Err()
}

func scanTask(rows pgx.Rows) (Task, error) {
	var t Task
	var id, assigneeID, createdByID pgtype.UUID
	var brandID pgtype.UUID
	var status TaskStatus
	var createdAt, updatedAt time.Time

	if err := rows.Scan(
		&id, &brandID, &t.BrandName, &t.Brief, &t.SheetLink,
		&assigneeID, &t.AssigneeName, &t.AssigneeRole,
		&createdByID, &t.CreatedByName, &status, &createdAt, &updatedAt,
	); err != nil {
		return Task{}, err
	}

	t.ID = uuid.UUID(id.Bytes).String()
	t.AssigneeID = uuid.UUID(assigneeID.Bytes).String()
	t.CreatedByID = uuid.UUID(createdByID.Bytes).String()
	t.Status = status
	t.CreatedAt = createdAt
	t.UpdatedAt = updatedAt

	if brandID.Valid {
		s := uuid.UUID(brandID.Bytes).String()
		t.BrandID = &s
	}

	return t, nil
}

func scanTaskRow(row pgx.Row) (Task, error) {
	var t Task
	var id, assigneeID, createdByID pgtype.UUID
	var brandID pgtype.UUID
	var status TaskStatus
	var createdAt, updatedAt time.Time

	if err := row.Scan(
		&id, &brandID, &t.BrandName, &t.Brief, &t.SheetLink,
		&assigneeID, &t.AssigneeName, &t.AssigneeRole,
		&createdByID, &t.CreatedByName, &status, &createdAt, &updatedAt,
	); err != nil {
		return Task{}, err
	}

	t.ID = uuid.UUID(id.Bytes).String()
	t.AssigneeID = uuid.UUID(assigneeID.Bytes).String()
	t.CreatedByID = uuid.UUID(createdByID.Bytes).String()
	t.Status = status
	t.CreatedAt = createdAt
	t.UpdatedAt = updatedAt

	if brandID.Valid {
		s := uuid.UUID(brandID.Bytes).String()
		t.BrandID = &s
	}

	return t, nil
}
