import type { TaskSummary, TaskDetail } from '../types/task'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

// All requests include credentials so the JWT HttpOnly cookie is sent.
const defaultOptions: RequestInit = { credentials: 'include' }

/**
 * Fetch all tasks, optionally filtered by brand and/or status.
 * Maps to GET /api/v1/tasks?brand=&status=
 */
export async function fetchTasks(
  brand?: string,
  status?: string,
): Promise<TaskSummary[]> {
  const params = new URLSearchParams()
  if (brand) params.set('brand', brand)
  if (status) params.set('status', status)

  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${BASE_URL}/api/v1/tasks${query}`, defaultOptions)

  if (!res.ok) {
    throw new Error(`fetchTasks: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<TaskSummary[]>
}

/**
 * Transition a task to a new status.
 * Maps to PATCH /api/v1/tasks/{id}/status
 */
export async function transitionTaskStatus(
  taskId: string,
  newStatus: string,
): Promise<TaskDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/status`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`transitionTaskStatus: ${res.status} — ${body}`)
  }
  return res.json() as Promise<TaskDetail>
}
