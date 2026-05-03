import type { TaskSummary, TaskDetail } from '../types/task'
import type { Brand } from '../types/brand'
import type { User } from '../types/auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// All requests include credentials so the JWT HttpOnly cookie is sent.
const defaultOptions: RequestInit = { credentials: 'include' }

function getHeaders(extra: Record<string, string> = {}) {
  return { ...extra }
}

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
  const res = await fetch(`${BASE_URL}/api/v1/tasks${query}`, {
    ...defaultOptions,
    headers: getHeaders()
  })

  if (!res.ok) {
    throw new Error(`fetchTasks: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<TaskSummary[]>
}

/**
 * Get a single task by ID.
 * Maps to GET /api/v1/tasks/{id}
 */
export async function fetchTaskById(taskId: string): Promise<TaskDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}`, {
    ...defaultOptions,
    headers: getHeaders()
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body.error || res.statusText
    throw new Error(`fetchTaskById: ${res.status} ${msg}`)
  }
  return res.json() as Promise<TaskDetail>
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
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status: newStatus }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`transitionTaskStatus: ${res.status} — ${body}`)
  }
  return res.json() as Promise<TaskDetail>
}

/**
 * Create a new task.
 * Maps to POST /api/v1/tasks
 */
export async function createTask(req: {
  title: string
  description: string
  brand: string
  priority: string
  deadline?: string
  content_type: string
  assigned_to?: string
}): Promise<TaskDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks`, {
    ...defaultOptions,
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    const body = await res.text()
    throw new Error(body || `createTask: ${res.status}`)
  }
  return res.json() as Promise<TaskDetail>
}

/**
 * Assign a task to a user.
 * Maps to PATCH /api/v1/tasks/{id}/assign
 */
export async function assignTask(taskId: string, userId: string): Promise<TaskDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/assign`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user_id: userId }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`assignTask: ${res.status} — ${body}`)
  }
  return res.json() as Promise<TaskDetail>
}

/**
 * Fetch all users via GET /api/v1/users.
 */
export async function fetchUsers(): Promise<UserResponse[]> {
  const res = await fetch(`${BASE_URL}/api/v1/users`, {
    ...defaultOptions,
    headers: getHeaders()
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`fetchUsers: ${res.status} — ${body}`)
  }
  return res.json() as Promise<User[]>
}

/**
 * Create/Invite a new admin user.
 */
export async function inviteUser(data: { name: string; email: string; password?: string }): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users`, {
    ...defaultOptions,
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to invite user')
  }
  return res.json() as Promise<User>
}

/**
 * Update a user's role (Superadmin only).
 */
export async function updateUserRole(userId: string, role: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users/${userId}/role`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to update role')
  }
  return res.json() as Promise<User>
}

/**
 * Toggle user status (Superadmin only).
 */
export async function updateUserStatus(userId: string, isActive: boolean): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users/${userId}/status`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ is_active: isActive }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to update status')
  }
  return res.json() as Promise<User>
}

/**
 * Update current user's profile.
 */
export async function updateProfile(data: { name: string; email: string }): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`updateProfile: ${res.status} — ${body}`)
  }
  return res.json() as Promise<User>
}

/**
 * Fetch history for a task.
 */
export async function fetchTaskHistory(taskId: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/history`, {
    ...defaultOptions,
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`fetchTaskHistory: ${res.status}`)
  return res.json()
}

/**
 * Upload a profile avatar.
 */
export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData()
  formData.append('avatar', file)

  const res = await fetch(`${BASE_URL}/api/v1/auth/avatar`, {
    ...defaultOptions,
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`uploadAvatar: ${res.status} — ${body}`)
  }
  return res.json() as Promise<User>
}

/**
 * Search across tasks and users.
 */
export async function globalSearch(query: string): Promise<{ results: any[] }> {
  const res = await fetch(`${BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}`, {
    ...defaultOptions,
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`globalSearch: ${res.status}`)
  return res.json()
}

/**
 * Fetch global activity feed.
 */
export async function fetchGlobalActivity(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/activity`, {
    ...defaultOptions,
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`fetchGlobalActivity: ${res.status}`)
  return res.json()
}

/**
 * Brand management services.
 */
export async function fetchBrands(): Promise<Brand[]> {
  const res = await fetch(`${BASE_URL}/api/v1/brands`, {
    ...defaultOptions,
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`fetchBrands: ${res.status}`)
  return res.json()
}

export async function createBrand(data: { name: string; slug: string; hex_color: string }): Promise<Brand> {
  const res = await fetch(`${BASE_URL}/api/v1/brands`, {
    ...defaultOptions,
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`createBrand: ${res.status}`)
  return res.json()
}

export async function deleteBrand(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/brands/${id}`, {
    ...defaultOptions,
    method: 'DELETE',
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`deleteBrand: ${res.status}`)
}

/**
 * Dashboard metrics
 */
export async function fetchDashboardMetrics(): Promise<{ metrics: any[] }> {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/metrics`, {
    ...defaultOptions,
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`fetchDashboardMetrics: ${res.status}`)
  return res.json()
}