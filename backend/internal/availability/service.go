package availability

import (
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
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

// ── constants ────────────────────────────────────────────────────────────────

const (
	maxFutureDays   = 90  // reject dates beyond 90 days from today
	maxLookaheadDays = 30 // max window for GetUserAvailability
)

// ── service functions ────────────────────────────────────────────────────────

// UpsertAvailability validates the request, enforces authorization and the
// admin day-slot override rule, then upserts each slot via the repository.
//
// Business rules encoded here:
//   - Freelancers can only upsert their own availability.
//   - Admins/superadmins can upsert for any user.
//   - When claims.Role == "admin" and a "day" slot is included, IsAvailable
//     is forced to false (10 AM – 3 PM intern class block).
//   - Superadmins are exempt from the day-slot override.
func UpsertAvailability(
	pool *pgxpool.Pool,
	claims *auth.TokenClaims,
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
		isAvail := s.IsAvailable

		// Intern/admin day-slot override: 10 AM – 3 PM class block.
		// Superadmins are exempt — they manage the system, not content.
		if claims.Role == "admin" && s.Slot == "day" {
			isAvail = false
		}

		rec, err := upsertSlot(pool, targetUserID, dateStr, s.Slot, isAvail, s.Comment)
		if err != nil {
			return DayAvailability{}, fmt.Errorf("availability: upsert slot %q: %w", s.Slot, err)
		}
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
	claims *auth.TokenClaims,
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
	dateOrder := make([]string, 0)
	for _, r := range records {
		if _, exists := dayMap[r.Date]; !exists {
			dateOrder = append(dateOrder, r.Date)
		}
		dayMap[r.Date] = append(dayMap[r.Date], r)
	}

	daysList := make([]DayAvailability, 0, len(dateOrder))
	for _, d := range dateOrder {
		daysList = append(daysList, DayAvailability{
			Date:   d,
			UserID: targetUserID,
			Slots:  dayMap[d],
		})
	}

	return WeekAvailability{
		UserID: targetUserID,
		Days:   daysList,
	}, nil
}

// GetTodayAllUsers returns availability records for today.
// Admin/superadmin see all; freelancers see only their own.
func GetTodayAllUsers(pool *pgxpool.Pool, claims *auth.TokenClaims) ([]AvailabilityRecord, error) {
	today := time.Now().UTC().Format("2006-01-02")
	
	var filterUserID string
	if claims.Role == "freelancer" {
		filterUserID = claims.UserID
	}

	records, err := getAllAvailabilityForDate(pool, today, filterUserID)
	if err != nil {
		return nil, fmt.Errorf("availability: get today all: %w", err)
	}
	return records, nil
}
