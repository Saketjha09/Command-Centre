package payroll

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

type pgxQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func pgUUIDString(u pgtype.UUID) string {
	return uuid.UUID(u.Bytes).String()
}

func upsertEditorRate(ctx context.Context, pool *pgxpool.Pool, editorID, contentType string, rate float64) error {
	// 1. Verify editor exists and is freelancer
	const checkQ = `SELECT id FROM ops.users WHERE id = $1 AND role = 'freelancer' AND is_active = true`
	var id string
	if err := pool.QueryRow(ctx, checkQ, editorID).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrEditorNotFound
		}
		return fmt.Errorf("payroll: check editor: %w", err)
	}

	// 2. Upsert
	const upsertQ = `
		INSERT INTO ops.editor_rates (editor_id, content_type, rate, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (editor_id, content_type) 
		DO UPDATE SET rate = EXCLUDED.rate, updated_at = now()`
	
	if _, err := pool.Exec(ctx, upsertQ, editorID, contentType, rate); err != nil {
		return fmt.Errorf("payroll: upsert rate: %w", err)
	}
	return nil
}

func getEditorRates(ctx context.Context, pool *pgxpool.Pool, editorID string) ([]EditorRate, error) {
	const q = `
		SELECT editor_id, content_type::text, rate, updated_at
		FROM ops.editor_rates
		WHERE editor_id = $1
		ORDER BY content_type`
	
	rows, err := pool.Query(ctx, q, editorID)
	if err != nil {
		return nil, fmt.Errorf("payroll: get rates query: %w", err)
	}
	defer rows.Close()

	rates := make([]EditorRate, 0)
	for rows.Next() {
		var r EditorRate
		var eID pgtype.UUID
		if err := rows.Scan(&eID, &r.ContentType, &r.Rate, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("payroll: scan rate: %w", err)
		}
		r.EditorID = pgUUIDString(eID)
		rates = append(rates, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payroll: iterate rates: %w", err)
	}
	return rates, nil
}

func getAllEditorRates(ctx context.Context, pool *pgxpool.Pool) ([]EditorRate, error) {
	const q = `
		SELECT er.editor_id, u.name as editor_name, 
		       er.content_type::text, er.rate, er.updated_at
		FROM ops.editor_rates er
		JOIN ops.users u ON u.id = er.editor_id
		WHERE u.is_active = true
		ORDER BY u.name, er.content_type`

	rows, err := pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("payroll: get all rates query: %w", err)
	}
	defer rows.Close()

	rates := make([]EditorRate, 0)
	for rows.Next() {
		var r EditorRate
		var eID pgtype.UUID
		if err := rows.Scan(&eID, &r.EditorName, &r.ContentType, &r.Rate, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("payroll: scan all rates: %w", err)
		}
		r.EditorID = pgUUIDString(eID)
		rates = append(rates, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payroll: iterate all rates: %w", err)
	}
	return rates, nil
}

func fetchEligibleTasks(ctx context.Context, q pgxQuerier, editorID, periodStart, periodEnd string) ([]PayrollTask, error) {
	const sqlStr = `
		SELECT 
			t.id, t.title, t.content_type::text,
			er.rate,
			er.rate as amount
		FROM ops.tasks t
		JOIN ops.editor_rates er 
			ON er.editor_id = t.assigned_to 
			AND er.content_type = t.content_type
		WHERE t.assigned_to = $1
			AND t.status = 'done'
			AND t.deadline::date >= $2
			AND t.deadline::date <= $3
			AND NOT EXISTS (
				SELECT 1 FROM ops.payroll_run_tasks prt
				JOIN ops.payroll_runs pr ON pr.id = prt.run_id
				WHERE prt.task_id = t.id
				AND pr.editor_id = $1
			)
		ORDER BY t.deadline`
	
	rows, err := q.Query(ctx, sqlStr, editorID, periodStart, periodEnd)
	if err != nil {
		return nil, fmt.Errorf("payroll: fetch tasks query: %w", err)
	}
	defer rows.Close()

	tasks := make([]PayrollTask, 0)
	for rows.Next() {
		var t PayrollTask
		var tID pgtype.UUID
		if err := rows.Scan(&tID, &t.TaskTitle, &t.ContentType, &t.RateApplied, &t.Amount); err != nil {
			return nil, fmt.Errorf("payroll: scan task: %w", err)
		}
		t.TaskID = pgUUIDString(tID)
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payroll: iterate tasks: %w", err)
	}

	if len(tasks) == 0 {
		return nil, ErrNoEligibleTasks
	}

	return tasks, nil
}

func previewPayroll(ctx context.Context, pool *pgxpool.Pool, editorID, periodStart, periodEnd string) (PayrollRunDetail, error) {
	// 1. Fetch tasks
	tasks, err := fetchEligibleTasks(ctx, pool, editorID, periodStart, periodEnd)
	if err != nil {
		return PayrollRunDetail{}, err
	}

	// 2. Fetch editor name
	const nameQ = `SELECT name FROM ops.users WHERE id = $1`
	var editorName string
	if err := pool.QueryRow(ctx, nameQ, editorID).Scan(&editorName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PayrollRunDetail{}, ErrEditorNotFound
		}
		return PayrollRunDetail{}, fmt.Errorf("payroll: fetch editor name: %w", err)
	}

	// 3. Assemble
	var total float64
	for _, t := range tasks {
		total += t.Amount
	}

	detail := PayrollRunDetail{
		PayrollRun: PayrollRun{
			EditorID:    editorID,
			EditorName:  editorName,
			PeriodStart: periodStart,
			PeriodEnd:   periodEnd,
			TaskCount:   len(tasks),
			TotalAmount: total,
			Status:      "preview",
		},
		Tasks: tasks,
	}
	return detail, nil
}

func createPayrollRun(ctx context.Context, pool *pgxpool.Pool, editorID, periodStart, periodEnd, createdBy string) (PayrollRun, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return PayrollRun{}, fmt.Errorf("payroll: begin create run tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Fetch tasks inside transaction
	tasks, err := fetchEligibleTasks(ctx, tx, editorID, periodStart, periodEnd)
	if err != nil {
		return PayrollRun{}, err
	}

	var total float64
	for _, t := range tasks {
		total += t.Amount
	}

	// 2. Insert into payroll_runs
	const insertRunQ = `
		INSERT INTO ops.payroll_runs (editor_id, period_start, period_end, task_count, total_amount, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, status, created_at`
	
	var run PayrollRun
	run.EditorID = editorID
	run.PeriodStart = periodStart
	run.PeriodEnd = periodEnd
	run.TaskCount = len(tasks)
	run.TotalAmount = total

	var status pgtype.Text
	var createdAt time.Time
	var id pgtype.UUID
	if err := tx.QueryRow(ctx, insertRunQ, editorID, periodStart, periodEnd, len(tasks), total, createdBy).Scan(&id, &status, &createdAt); err != nil {
		return PayrollRun{}, fmt.Errorf("payroll: insert run: %w", err)
	}
	run.ID = pgUUIDString(id)
	run.Status = status.String
	run.CreatedAt = createdAt

	// 3. Bulk Insert into payroll_run_tasks
	rows := make([][]any, 0, len(tasks))
	for _, t := range tasks {
		tID, _ := uuid.Parse(t.TaskID)
		rows = append(rows, []any{id.Bytes, tID, t.RateApplied, t.Amount})
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"ops", "payroll_run_tasks"},
		[]string{"run_id", "task_id", "rate_applied", "amount"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return PayrollRun{}, fmt.Errorf("payroll: copy tasks: %w", err)
	}

	// 4. Commit
	if err := tx.Commit(ctx); err != nil {
		return PayrollRun{}, fmt.Errorf("payroll: commit run: %w", err)
	}

	return run, nil
}

func markPaid(ctx context.Context, pool *pgxpool.Pool, runID string) (PayrollRun, error) {
	const updateQ = `
		UPDATE ops.payroll_runs
		SET status = 'paid', paid_at = now()
		WHERE id = $1 AND status = 'pending'
		RETURNING id, editor_id, period_start::text, period_end::text, task_count, total_amount, status::text, paid_at, created_at`
	
	var r PayrollRun
	var id, editorID pgtype.UUID
	var paidAt pgtype.Timestamptz
	
	err := pool.QueryRow(ctx, updateQ, runID).Scan(
		&id, &editorID, &r.PeriodStart, &r.PeriodEnd, &r.TaskCount, &r.TotalAmount, &r.Status, &paidAt, &r.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Check if exists and status
			const checkQ = `SELECT status FROM ops.payroll_runs WHERE id = $1`
			var status string
			checkErr := pool.QueryRow(ctx, checkQ, runID).Scan(&status)
			if checkErr != nil {
				if errors.Is(checkErr, pgx.ErrNoRows) {
					return PayrollRun{}, ErrRunNotFound
				}
				return PayrollRun{}, fmt.Errorf("payroll: check run status: %w", checkErr)
			}
			if status == "paid" {
				return PayrollRun{}, ErrAlreadyPaid
			}
			// Fallback
			return PayrollRun{}, ErrRunNotFound
		}
		return PayrollRun{}, fmt.Errorf("payroll: update run status: %w", err)
	}

	r.ID = pgUUIDString(id)
	r.EditorID = pgUUIDString(editorID)
	if paidAt.Valid {
		r.PaidAt = &paidAt.Time
	}

	return r, nil
}

func getPayrollRuns(ctx context.Context, pool *pgxpool.Pool, editorID string) ([]PayrollRun, error) {
	q := `
		SELECT pr.id, pr.editor_id, u.name as editor_name,
		       pr.period_start::text, pr.period_end::text,
		       pr.task_count, pr.total_amount,
		       pr.status::text, pr.paid_at, pr.created_at
		FROM ops.payroll_runs pr
		JOIN ops.users u ON u.id = pr.editor_id`
	
	var args []any
	if editorID != "" {
		q += ` WHERE pr.editor_id = $1`
		args = append(args, editorID)
	}
	q += ` ORDER BY pr.created_at DESC`

	rows, err := pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("payroll: get runs query: %w", err)
	}
	defer rows.Close()

	runs := make([]PayrollRun, 0)
	for rows.Next() {
		var r PayrollRun
		var id, eID pgtype.UUID
		var paidAt pgtype.Timestamptz
		if err := rows.Scan(&id, &eID, &r.EditorName, &r.PeriodStart, &r.PeriodEnd, &r.TaskCount, &r.TotalAmount, &r.Status, &paidAt, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("payroll: scan run: %w", err)
		}
		r.ID = pgUUIDString(id)
		r.EditorID = pgUUIDString(eID)
		if paidAt.Valid {
			r.PaidAt = &paidAt.Time
		}
		runs = append(runs, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payroll: iterate runs: %w", err)
	}
	return runs, nil
}

func getPayrollRunDetail(ctx context.Context, pool *pgxpool.Pool, runID string) (PayrollRunDetail, error) {
	// 1. Fetch PayrollRun
	const runQ = `
		SELECT pr.id, pr.editor_id, u.name as editor_name,
		       pr.period_start::text, pr.period_end::text,
		       pr.task_count, pr.total_amount,
		       pr.status::text, pr.paid_at, pr.created_at
		FROM ops.payroll_runs pr
		JOIN ops.users u ON u.id = pr.editor_id
		WHERE pr.id = $1`
	
	var r PayrollRun
	var id, eID pgtype.UUID
	var paidAt pgtype.Timestamptz
	err := pool.QueryRow(ctx, runQ, runID).Scan(
		&id, &eID, &r.EditorName, &r.PeriodStart, &r.PeriodEnd, &r.TaskCount, &r.TotalAmount, &r.Status, &paidAt, &r.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PayrollRunDetail{}, ErrRunNotFound
		}
		return PayrollRunDetail{}, fmt.Errorf("payroll: get detail run: %w", err)
	}
	r.ID = pgUUIDString(id)
	r.EditorID = pgUUIDString(eID)
	if paidAt.Valid {
		r.PaidAt = &paidAt.Time
	}

	// 2. Fetch tasks
	const taskQ = `
		SELECT t.id, t.title, t.content_type::text,
		       prt.rate_applied, prt.amount
		FROM ops.payroll_run_tasks prt
		JOIN ops.tasks t ON t.id = prt.task_id
		WHERE prt.run_id = $1
		ORDER BY t.deadline`
	
	rows, err := pool.Query(ctx, taskQ, runID)
	if err != nil {
		return PayrollRunDetail{}, fmt.Errorf("payroll: get detail tasks query: %w", err)
	}
	defer rows.Close()

	tasks := make([]PayrollTask, 0)
	for rows.Next() {
		var t PayrollTask
		var tID pgtype.UUID
		if err := rows.Scan(&tID, &t.TaskTitle, &t.ContentType, &t.RateApplied, &t.Amount); err != nil {
			return PayrollRunDetail{}, fmt.Errorf("payroll: scan detail task: %w", err)
		}
		t.TaskID = pgUUIDString(tID)
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return PayrollRunDetail{}, fmt.Errorf("payroll: iterate detail tasks: %w", err)
	}

	return PayrollRunDetail{
		PayrollRun: r,
		Tasks:      tasks,
	}, nil
}
