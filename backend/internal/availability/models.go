package availability

import "time"

// AvailabilityStatus mirrors the ops.availability_status DB enum.
// It is a distinct named type — not an alias — so the compiler enforces
// that only the defined constants are assignable without an explicit cast.
type AvailabilityStatus string

const (
	StatusAvailable  AvailabilityStatus = "available"
	StatusBusyManual AvailabilityStatus = "busy_manual"
	StatusBusyTask   AvailabilityStatus = "busy_task"
	StatusOff        AvailabilityStatus = "off"
	StatusUnknown    AvailabilityStatus = "unknown"
)

// AvailabilityRecord is a single slot entry — returned to clients.
// Maps 1:1 with a row in ops.availability.
// IsAvailable has been removed; Status is the canonical field.
type AvailabilityRecord struct {
	ID        string             `json:"id"`
	UserID    string             `json:"user_id"`
	Date      string             `json:"date"`    // YYYY-MM-DD format
	Slot      string             `json:"slot"`    // day | evening | night
	Status    AvailabilityStatus `json:"status"`  // available | busy_manual | busy_task | off | unknown
	Comment   string             `json:"comment"`
	CreatedAt time.Time          `json:"created_at"`
}

// SlotInput is one slot within a bulk upsert request.
// Status replaces the old IsAvailable bool — callers must send a valid
// AvailabilityStatus value. busy_task is set by the system, not clients.
type SlotInput struct {
	Slot    string             `json:"slot"`
	Status  AvailabilityStatus `json:"status"`  // available | busy_manual | off
	Comment string             `json:"comment"`
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

// AdminGridResponse — response for GET /api/v1/availability/grid.
type AdminGridResponse struct {
	Dates   []string           `json:"dates"`
	Editors []EditorGridDetail `json:"editors"`
}

// EditorGridDetail — part of AdminGridResponse.
type EditorGridDetail struct {
	ID       string                              `json:"id"`
	Name     string                              `json:"name"`
	PhotoURL *string                             `json:"photo_url"`
	Days     map[string]map[string]SlotGridDetail `json:"days"` // date -> slot -> details
}

// SlotGridDetail — part of EditorGridDetail.
type SlotGridDetail struct {
	Status    string `json:"status"`
	Note      string `json:"note"`
	TaskCount int    `json:"task_count"`
}
