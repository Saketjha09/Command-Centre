export interface AvailabilityRecord {
  id: string
  user_id: string
  date: string        // YYYY-MM-DD
  slot: 'day' | 'evening' | 'night'
  is_available: boolean
  comment: string
  created_at: string
}

export interface DayAvailability {
  date: string
  user_id: string
  slots: AvailabilityRecord[]
}

export interface WeekAvailability {
  user_id: string
  days: DayAvailability[]
}

export interface SlotInput {
  slot: 'day' | 'evening' | 'night'
  is_available: boolean
  comment: string
}
