import type { WeekAvailability, DayAvailability, AvailabilityRecord, SlotInput } from '../types/availability'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
// Ensure API_BASE_URL has no trailing slash to prevent // path mismatches
const API_BASE_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL

const defaultOptions: RequestInit = { credentials: 'include' }

function getHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra }
  const token = localStorage.getItem('access_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function fetchWeekAvailability(
  userID: string,
  days?: number
): Promise<WeekAvailability> {
  const params = new URLSearchParams()
  if (days !== undefined) params.set('days', days.toString())
  
  const query = params.toString() ? `?${params.toString()}` : ''
  const path = userID ? `/api/v1/availability/${userID}` : `/api/v1/availability`
  const res = await fetch(`${API_BASE_URL}${path}${query}`, {
    ...defaultOptions,
    headers: getHeaders()
  })

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
  const res = await fetch(`${API_BASE_URL}/api/v1/availability/${userID}/${date}`, {
    ...defaultOptions,
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ slots }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] upsertAvailability: ${errorText}`)
  }
  return res.json() as Promise<DayAvailability>
}

export async function setAvailable(date: string, slot: string): Promise<AvailabilityRecord> {
  const res = await fetch(`${API_BASE_URL}/api/v1/availability`, {
    ...defaultOptions,
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ date, slot }),
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] setAvailable: ${errorText}`)
  }
  return res.json()
}

export async function setOffline(date: string, slot: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/availability`, {
    ...defaultOptions,
    method: 'DELETE',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ date, slot }),
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] setOffline: ${errorText}`)
  }
}

export async function fetchTodayAvailability(): Promise<AvailabilityRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/availability/today`, {
    ...defaultOptions,
    headers: getHeaders()
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] fetchTodayAvailability: ${errorText}`)
  }
  return res.json() as Promise<AvailabilityRecord[]>
}
