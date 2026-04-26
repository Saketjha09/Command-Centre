export type SlotStatus = "available" | "booked" | "offline" | "unknown";

export interface SlotDetails {
  status: SlotStatus;
  note: string;
  task_count: number;
}

export interface DaySlots {
  night: SlotDetails;
  day: SlotDetails;
  evening: SlotDetails;
}

export interface EditorAvailability {
  id: string;
  name: string;
  photo_url: string | null;
  days: Record<string, DaySlots>;
}

export interface AdminGridResponse {
  dates: string[];
  editors: EditorAvailability[];
}
