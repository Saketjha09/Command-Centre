package availability

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/authutil"
)

// ── sentinel errors ──────────────────────────────────────────────────────────

// ErrValidation marks user-facing validation errors that are safe to return
// directly to the client in a 400 response.
var ErrValidation = errors.New("availability: validation error")

// ErrUnauthorized signals a permission check failure (403).
var ErrUnauthorized = errors.New("availability: access denied")

// ── lookup tables ────────────────────────────────────────────────────────────

// validSlots mirrors the ops.availability_slot ENUM.
var validSlots = map[string]bool{
	"day":     true,
	"evening": true,
	"night":   true,
}

// validClientStatuses are the status values a client may explicitly set.
// StatusBusyTask is excluded — it is set only by the task-assignment system.
var validClientStatuses = map[AvailabilityStatus]bool{
	StatusAvailable:  true,
	StatusBusyManual: true,
	StatusOff:        true,
}

// ── constants ────────────────────────────────────────────────────────────────

const (
	maxFutureDays   = 90  // reject dates beyond 90 days from today
	maxLookaheadDays = 30 // max window for GetUserAvailability
)

// ── service functions ────────────────────────────────────────────────────────

// UpsertAvailability validates the request, enforces authorization, then
// upserts each slot via the repository.
//
// Business rules encoded here:
//   - Freelancers can only upsert their own availability.
//   - Admins/superadmins can upsert for any user.
//   - StatusBusyTask cannot be set by any client — rejected at validation.
func UpsertAvailability(
	pool *pgxpool.Pool,
	claims *authutil.TokenClaims,
	targetUserID, dateStr string,
	req UpsertAvailabilityRequest,
) (DayAvailability, error) {

	// ── Validation ────────────────────────────────────────────────────────

	if len(req.Slots) == 0 {
		return DayAvailability{}, fmt.Errorf("%w: slots must not be empty", ErrValidation)
	}

	seen := make(map[string]bool, len(req.Slots))
	for _, s := range req.Slots {
		if !validSlots[s.Slot] {
			return DayAvailability{}, fmt.Errorf("%w: invalid slot %q, must be one of: day, evening, night", ErrValidation, s.Slot)
		}
		if seen[s.Slot] {
			return DayAvailability{}, fmt.Errorf("%w: duplicate slot %q", ErrValidation, s.Slot)
		}
		seen[s.Slot] = true
		if !validClientStatuses[s.Status] {
			return DayAvailability{}, fmt.Errorf("%w: invalid status %q for slot %q", ErrValidation, s.Status, s.Slot)
		}
	}

	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return DayAvailability{}, fmt.Errorf("%w: invalid date format, expected YYYY-MM-DD", ErrValidation)
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	if parsedDate.Before(today) {
		return DayAvailability{}, fmt.Errorf("%w: date must not be in the past", ErrValidation)
	}

	maxDate := today.AddDate(0, 0, maxFutureDays)
	if parsedDate.After(maxDate) {
		return DayAvailability{}, fmt.Errorf("%w: date must not be more than %d days in the future", ErrValidation, maxFutureDays)
	}

	// ── Authorization ─────────────────────────────────────────────────────

	if claims.Role == "freelancer" && targetUserID != claims.UserID {
		return DayAvailability{}, ErrUnauthorized
	}

	// ── Write path ────────────────────────────────────────────────────────

	records := make([]AvailabilityRecord, 0, len(req.Slots))
	for _, s := range req.Slots {
		rec, err := upsertSlot(pool, targetUserID, dateStr, s.Slot, s.Status, s.Comment)
		if err != nil {
			return DayAvailability{}, fmt.Errorf("availability: upsert slot %q: %w", s.Slot, err)
		}
		// Status is authoritative from the DB RETURNING clause.
		// No post-upsert recomputation needed.
		records = append(records, rec)
	}

	return DayAvailability{
		Date:   dateStr,
		UserID: targetUserID,
		Slots:  records,
	}, nil
}

// GetUserAvailability returns a user's availability for the given lookahead
// window. Days is clamped to [1, 30] (never errors on out-of-range).
//
// Authorization: freelancers can only read their own availability.
func GetUserAvailability(
	pool *pgxpool.Pool,
	claims *authutil.TokenClaims,
	targetUserID string,
	days int,
) (WeekAvailability, error) {

	// Clamp days to valid range — don't error.
	if days < 1 {
		days = 1
	}
	if days > maxLookaheadDays {
		days = maxLookaheadDays
	}

	// ── Authorization ─────────────────────────────────────────────────────

	if claims.Role == "freelancer" && targetUserID != claims.UserID {
		return WeekAvailability{}, ErrUnauthorized
	}

	// ── Query ─────────────────────────────────────────────────────────────

	from := time.Now().UTC().Truncate(24 * time.Hour)
	to := from.AddDate(0, 0, days-1)

	records, err := getAvailabilityForUser(pool, targetUserID, from, to)
	if err != nil {
		return WeekAvailability{}, fmt.Errorf("availability: get user: %w", err)
	}

	// ── Group by date ─────────────────────────────────────────────────────

	dayMap := make(map[string][]AvailabilityRecord)
	for _, r := range records {
		// Status is read directly from the DB column; no recomputation needed.
		dayMap[r.Date] = append(dayMap[r.Date], r)
	}

	daysList := make([]DayAvailability, 0, days)
	for i := 0; i < days; i++ {
		dateStr := from.AddDate(0, 0, i).Format("2006-01-02")

		slots := dayMap[dateStr]
		if slots == nil {
			slots = []AvailabilityRecord{}
		}

		daysList = append(daysList, DayAvailability{
			Date:   dateStr,
			UserID: targetUserID,
			Slots:  slots,
		})
	}

	return WeekAvailability{
		UserID: targetUserID,
		Days:   daysList,
	}, nil
}

// GetTodayAllUsers returns availability records for today.
// Admin/superadmin see all; freelancers see only their own.
func GetTodayAllUsers(pool *pgxpool.Pool, claims *authutil.TokenClaims) ([]AvailabilityRecord, error) {
	today := time.Now().UTC().Format("2006-01-02")

	var filterUserID string
	if claims.Role == "freelancer" {
		filterUserID = claims.UserID
	}

	records, err := getAllAvailabilityForDate(pool, today, filterUserID)
	if err != nil {
		return nil, fmt.Errorf("availability: get today all: %w", err)
	}

	// Status is read directly from the DB column — no per-record recomputation needed.
	return records, nil
}

// ToggleRequest — body for POST/DELETE /api/v1/availability
type ToggleRequest struct {
	Date string `json:"date"`
	Slot string `json:"slot"`
}

// SetSlotAvailable marks a slot as available for the calling user.
func SetSlotAvailable(pool *pgxpool.Pool, claims *authutil.TokenClaims, date, slot string) (AvailabilityRecord, error) {
	userID := claims.UserID

	if !validSlots[slot] {
		return AvailabilityRecord{}, fmt.Errorf("%w: invalid slot %q", ErrValidation, slot)
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return AvailabilityRecord{}, fmt.Errorf("%w: invalid date format", ErrValidation)
	}

	return upsertSlot(pool, userID, date, slot, StatusAvailable, "")
}

// SetSlotOffline marks a slot as explicitly offline for the calling user.
// This upserts status='off' rather than deleting the row, preserving the
// distinction between 'off' (explicitly unavailable) and 'unknown' (no row set).
func SetSlotOffline(pool *pgxpool.Pool, claims *authutil.TokenClaims, date, slot string) (AvailabilityRecord, error) {
	userID := claims.UserID

	if !validSlots[slot] {
		return AvailabilityRecord{}, fmt.Errorf("%w: invalid slot %q", ErrValidation, slot)
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return AvailabilityRecord{}, fmt.Errorf("%w: invalid date format", ErrValidation)
	}

	return upsertSlot(pool, userID, date, slot, StatusOff, "")
}

// GetAdminAvailabilityGrid builds the 14-day exhaustive slot matrix for all
// active freelancers, used by the admin availability grid UI.
func GetAdminAvailabilityGrid(ctx context.Context, pool *pgxpool.Pool, today time.Time) (AdminGridResponse, error) {
	from := today.Truncate(24 * time.Hour)
	to := from.AddDate(0, 0, 13)

	rows, err := GetAvailabilityGridData(ctx, pool, from, to)
	if err != nil {
		return AdminGridResponse{}, err
	}

	// 1. Generate the 14 date strings
	dateStrings := make([]string, 14)
	for i := 0; i < 14; i++ {
		dateStrings[i] = from.AddDate(0, 0, i).Format("2006-01-02")
	}

	// 2. Group flat rows by UserID
	type userOrder struct {
		id    string
		name  string
		photo *string
	}
	var order []userOrder
	userMap := make(map[string]map[string]map[string]SlotGridDetail)
	seenUsers := make(map[string]bool)

	for _, row := range rows {
		if !seenUsers[row.UserID] {
			seenUsers[row.UserID] = true
			order = append(order, userOrder{row.UserID, row.DisplayName, row.PhotoURL})
			userMap[row.UserID] = make(map[string]map[string]SlotGridDetail)
		}

		if row.Date != nil && row.Slot != nil {
			if userMap[row.UserID][*row.Date] == nil {
				userMap[row.UserID][*row.Date] = make(map[string]SlotGridDetail)
			}
			userMap[row.UserID][*row.Date][*row.Slot] = SlotGridDetail{
				Status:    row.Status,
				Note:      row.Note,
				TaskCount: row.TaskCount,
			}
		}
	}

	// 3. Build the exhaustive matrix — every user x date x slot combination
	editors := make([]EditorGridDetail, 0, len(order))
	slots := []string{"night", "day", "evening"}

	for _, u := range order {
		editorDays := make(map[string]map[string]SlotGridDetail)

		for _, dateStr := range dateStrings {
			daySlots := make(map[string]SlotGridDetail)
			for _, s := range slots {
				if detail, ok := userMap[u.id][dateStr][s]; ok {
					daySlots[s] = detail
				} else {
					daySlots[s] = SlotGridDetail{
						Status:    string(StatusUnknown),
						Note:      "",
						TaskCount: 0,
					}
				}
			}
			editorDays[dateStr] = daySlots
		}

		editors = append(editors, EditorGridDetail{
			ID:       u.id,
			Name:     u.name,
			PhotoURL: u.photo,
			Days:     editorDays,
		})
	}

	return AdminGridResponse{
		Dates:   dateStrings,
		Editors: editors,
	}, nil
}
