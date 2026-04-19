import type { WeekAvailability, DayAvailability, AvailabilityRecord, SlotInput } from '../types/availability'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const defaultOptions: RequestInit = { credentials: 'include' }

export async function fetchWeekAvailability(
  userID: string,
  days?: number
): Promise<WeekAvailability> {
  const params = new URLSearchParams()
  if (days !== undefined) params.set('days', days.toString())
  
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${BASE_URL}/api/v1/availability/${userID}/week${query}`, defaultOptions)

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] fetchWeekAvailability: ${errorText}`)
  }
  return res.json() as Promise<WeekAvailability>
}

export async function upsertAvailability(
  userID: string,
  date: string,
  slots: SlotInput[]
): Promise<DayAvailability> {
  const res = await fetch(`${BASE_URL}/api/v1/availability/${userID}/${date}`, {
    ...defaultOptions,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] upsertAvailability: ${errorText}`)
  }
  return res.json() as Promise<DayAvailability>
}

export async function fetchTodayAvailability(): Promise<AvailabilityRecord[]> {
  const res = await fetch(`${BASE_URL}/api/v1/availability/today`, defaultOptions)

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] fetchTodayAvailability: ${errorText}`)
  }
  return res.json() as Promise<AvailabilityRecord[]>
}
