export type AvailabilitySlot = 'night' | 'day' | 'evening';

export type SlotStatus = 'available' | 'offline' | 'booked' | 'unknown';

export interface AvailabilityRecord {
  id: string;
  user_id: string;
  date: string;        // YYYY-MM-DD
  slot: AvailabilitySlot;
  is_available: boolean;
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

export interface SlotInput {
  slot: AvailabilitySlot;
  is_available: boolean;
  comment: string;
}

export interface SlotState {
  is_available: boolean;
  comment: string;
  status: SlotStatus;     // from DB or derived
  isLocked: boolean;      // true = task assigned, cannot change
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
