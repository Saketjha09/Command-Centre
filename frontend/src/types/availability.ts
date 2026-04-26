export type AvailabilitySlot = 'night' | 'day' | 'evening';

// Mirrors ops.availability_status DB enum.
// 'offline' and 'booked' are removed — replaced by 'off' and 'busy_task'.
export type SlotStatus = 'available' | 'busy_manual' | 'busy_task' | 'off' | 'unknown';

// Maps 1:1 with a row returned by the backend.
// is_available has been removed — status is the canonical field.
export interface AvailabilityRecord {
  id: string;
  user_id: string;
  date: string;           // YYYY-MM-DD
  slot: AvailabilitySlot;
  status: SlotStatus;
  comment: string;
  created_at: string;
}

export interface DayAvailabilityResponse {
  date: string;
  user_id: string;
  slots: AvailabilityRecord[];
}

export interface WeekAvailability {
  user_id: string;
  days: DayAvailabilityResponse[];
}

// Sent in the PUT /api/v1/availability/{userID}/{date} request body.
// status replaces is_available — backend rejects 'busy_task' from clients.
export interface SlotInput {
  slot: AvailabilitySlot;
  status: SlotStatus;
  comment: string;
}

// Internal UI state per slot.
// is_available removed — status is the single source of truth.
export interface SlotState {
  comment: string;
  status: SlotStatus;     // from DB or derived from toggle
  isLocked: boolean;      // true = busy_task, cannot change manually
}

export interface FreelancerDayState {
  date: string;           // YYYY-MM-DD
  slots: {
    night: SlotState;
    day: SlotState;
    evening: SlotState;
  };
  isDirty: boolean;       // true = unsaved changes
  isSaving: boolean;      // true = API call in flight
}
