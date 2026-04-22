package availability

import "time"

// AvailabilityRecord is a single slot entry — returned to clients.
// Maps 1:1 with a row in ops.availability.
type AvailabilityRecord struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Date        string    `json:"date"`         // YYYY-MM-DD format
	Slot        string    `json:"slot"`          // day | evening | night
	IsAvailable bool      `json:"is_available"`
	Comment     string    `json:"comment"`
	CreatedAt   time.Time `json:"created_at"`
}

// SlotInput is one slot within a bulk upsert request.
type SlotInput struct {
	Slot        string `json:"slot"`
	IsAvailable bool   `json:"is_available"`
	Comment     string `json:"comment"`
}

// UpsertAvailabilityRequest — body for PUT /api/v1/availability/{userID}/{date}.
// Allows setting all three slots for a given day in one request.
type UpsertAvailabilityRequest struct {
	Slots []SlotInput `json:"slots"`
}

// DayAvailability — response for a single day (all slots).
type DayAvailability struct {
	Date   string               `json:"date"`
	UserID string               `json:"user_id"`
	Slots  []AvailabilityRecord `json:"slots"`
}

// WeekAvailability — response for GET /api/v1/availability/{userID}.
type WeekAvailability struct {
	UserID string            `json:"user_id"`
	Days   []DayAvailability `json:"days"`
}
