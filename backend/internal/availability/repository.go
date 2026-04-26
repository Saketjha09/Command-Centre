package availability

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNoRecords indicates no availability rows matched the query.
var ErrNoRecords = errors.New("availability: no records found")

// ── column lists ─────────────────────────────────────────────────────────────

// returnCols are used in RETURNING / SELECT clauses.
// date and slot are cast to text to avoid pgtype enum scanning.
const returnCols = "id, user_id, date::text, slot::text, is_available, COALESCE(comment, ''), created_at"

// ── scan helper ──────────────────────────────────────────────────────────────

// scanRecord scans a single row into an AvailabilityRecord.
func scanRecord(row pgx.Row) (AvailabilityRecord, error) {
	var r AvailabilityRecord
	err := row.Scan(&r.ID, &r.UserID, &r.Date, &r.Slot, &r.IsAvailable, &r.Comment, &r.CreatedAt)
	return r, err
}

// scanRecords scans multiple rows into a slice of AvailabilityRecord.
// Always returns a non-nil slice (empty, not nil) when there are no rows.
func scanRecords(rows pgx.Rows) ([]AvailabilityRecord, error) {
	records := make([]AvailabilityRecord, 0)
	for rows.Next() {
		var r AvailabilityRecord
		if err := rows.Scan(&r.ID, &r.UserID, &r.Date, &r.Slot, &r.IsAvailable, &r.Comment, &r.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, rows.Err()
}

// ── repository functions ─────────────────────────────────────────────────────

// upsertSlot inserts or updates a single availability slot.
// Uses INSERT ... ON CONFLICT DO UPDATE to guarantee atomicity —
// never DELETE + INSERT, which risks partial failures leaving gaps.
func upsertSlot(pool *pgxpool.Pool, userID, date, slot string, isAvailable bool, comment string) (AvailabilityRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO ops.availability (user_id, date, slot, is_available, comment)
		VALUES ($1, $2::date, $3::ops.availability_slot, $4, $5)
		ON CONFLICT (user_id, date, slot)
		DO UPDATE SET is_available = EXCLUDED.is_available, comment = EXCLUDED.comment
		RETURNING ` + returnCols

	row := pool.QueryRow(ctx, query, userID, date, slot, isAvailable, comment)
	return scanRecord(row)
}

// getAvailabilityForUser returns availability records for a user between
// two dates (inclusive). Returns an empty slice (not nil) when no rows match.
func getAvailabilityForUser(pool *pgxpool.Pool, userID string, from, to time.Time) ([]AvailabilityRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT ` + returnCols + `
		FROM ops.availability
		WHERE user_id = $1 AND date >= $2 AND date <= $3
		ORDER BY date ASC, slot ASC`

	rows, err := pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanRecords(rows)
}

// getAvailabilityForDate returns all slots for a single user on a specific date.
// Returns an empty slice (not nil) when no rows match.
func getAvailabilityForDate(pool *pgxpool.Pool, userID, date string) ([]AvailabilityRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT ` + returnCols + `
		FROM ops.availability
		WHERE user_id = $1 AND date = $2::date
		ORDER BY slot ASC`

	rows, err := pool.Query(ctx, query, userID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanRecords(rows)
}

// getAllAvailabilityForDate returns availability records for today.
// If filterUserID is non-empty, only that user's records are returned.
func getAllAvailabilityForDate(pool *pgxpool.Pool, date, filterUserID string) ([]AvailabilityRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT ` + returnCols + `
		FROM ops.availability
		WHERE date = $1::date`
	
	args := []any{date}
	if filterUserID != "" {
		query += ` AND user_id = $2`
		args = append(args, filterUserID)
	}

	query += ` ORDER BY user_id ASC, slot ASC`

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanRecords(rows)
}

// getBookedDates returns a map of dates (YYYY-MM-DD) on which the user
// has at least one task with status 'in_progress' or 'review'.
func getBookedDates(pool *pgxpool.Pool, userID string, from, to time.Time) (map[string]bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT DISTINCT deadline::date::text
		FROM ops.tasks
		WHERE assigned_to = $1 
		  AND deadline >= $2 AND deadline <= $3
		  AND status IN ('in_progress', 'review')`

	rows, err := pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	booked := make(map[string]bool)
	for rows.Next() {
		var date string
		if err := rows.Scan(&date); err != nil {
			return nil, err
		}
		booked[date] = true
	}
	return booked, rows.Err()
}

// deleteSlot removes a single availability slot.
func deleteSlot(pool *pgxpool.Pool, userID, date, slot string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		DELETE FROM ops.availability
		WHERE user_id = $1 AND date = $2::date AND slot = $3::ops.availability_slot`

	_, err := pool.Exec(ctx, query, userID, date, slot)
	return err
}

type AdminGridRow struct {
	UserID      string  `json:"user_id"`
	DisplayName string  `json:"display_name"`
	PhotoURL    *string `json:"photo_url"`
	Date        *string `json:"date"`
	Slot        *string `json:"slot"`
	Status      string  `json:"status"`
	Note        string  `json:"note"`
	TaskCount   int     `json:"task_count"`
}

func GetAvailabilityGridData(ctx context.Context, pool *pgxpool.Pool, from, to time.Time) ([]AdminGridRow, error) {
	query := `
		SELECT 
			u.id::text, 
			u.name AS display_name, 
			u.avatar_url AS photo_url,
			a.date::text, 
			a.slot::text, 
			CASE 
				WHEN t.task_count > 0 THEN 'booked'
				WHEN a.is_available = true THEN 'available'
				WHEN a.is_available = false THEN 'offline'
				ELSE 'unknown'
			END AS status,
			COALESCE(a.comment, '') AS note,
			COALESCE(t.task_count, 0) AS task_count
		FROM ops.users u
		LEFT JOIN ops.availability a 
			ON a.user_id = u.id 
			AND a.date BETWEEN $1 AND $2
		LEFT JOIN (
			SELECT assigned_to, deadline::date AS task_date, COUNT(*) AS task_count
			FROM ops.tasks
			WHERE status IN ('in_progress', 'review')
			GROUP BY assigned_to, deadline::date
		) t ON t.assigned_to = u.id AND t.task_date = a.date
		WHERE u.role = 'freelancer' 
			AND u.is_active = true
		ORDER BY u.name, a.date, a.slot
	`

	rows, err := pool.Query(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []AdminGridRow
	for rows.Next() {
		var r AdminGridRow
		if err := rows.Scan(
			&r.UserID, &r.DisplayName, &r.PhotoURL, 
			&r.Date, &r.Slot, &r.Status, &r.Note, &r.TaskCount,
		); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}
