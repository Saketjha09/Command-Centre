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
const returnCols = "id, user_id, date::text, slot::text, is_available, created_at"

// ── scan helper ──────────────────────────────────────────────────────────────

// scanRecord scans a single row into an AvailabilityRecord.
func scanRecord(row pgx.Row) (AvailabilityRecord, error) {
	var r AvailabilityRecord
	err := row.Scan(&r.ID, &r.UserID, &r.Date, &r.Slot, &r.IsAvailable, &r.CreatedAt)
	return r, err
}

// scanRecords scans multiple rows into a slice of AvailabilityRecord.
// Always returns a non-nil slice (empty, not nil) when there are no rows.
func scanRecords(rows pgx.Rows) ([]AvailabilityRecord, error) {
	records := make([]AvailabilityRecord, 0)
	for rows.Next() {
		var r AvailabilityRecord
		if err := rows.Scan(&r.ID, &r.UserID, &r.Date, &r.Slot, &r.IsAvailable, &r.CreatedAt); err != nil {
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
func upsertSlot(pool *pgxpool.Pool, userID, date, slot string, isAvailable bool) (AvailabilityRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		INSERT INTO ops.availability (user_id, date, slot, is_available)
		VALUES ($1, $2::date, $3::ops.availability_slot, $4)
		ON CONFLICT (user_id, date, slot)
		DO UPDATE SET is_available = EXCLUDED.is_available
		RETURNING ` + returnCols

	row := pool.QueryRow(ctx, query, userID, date, slot, isAvailable)
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

// getAllAvailabilityForDate returns availability records for ALL users on a
// specific date. Used by the daily dashboard grid (admin-only endpoint).
// Returns an empty slice (not nil) when no rows match.
func getAllAvailabilityForDate(pool *pgxpool.Pool, date string) ([]AvailabilityRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT ` + returnCols + `
		FROM ops.availability
		WHERE date = $1::date
		ORDER BY user_id ASC, slot ASC`

	rows, err := pool.Query(ctx, query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanRecords(rows)
}
