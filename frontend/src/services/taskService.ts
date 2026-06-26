import type { TaskSummary, TaskDetail, TaskStatus } from '../types/task'
import { BASE_URL } from './config'

export async function getTasks(): Promise<TaskSummary[]> {
  const response = await fetch(`${BASE_URL}/api/v1/tasks`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown Error')
    throw new Error(`API Error ${response.status}: ${errorText}`)
  }

  return response.json()
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<TaskDetail> {
  const response = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown Error')
    throw new Error(`API Error ${response.status}: ${errorText}`)
  }

  return response.json()
}

export async function assignTask(taskId: string, userId: string): Promise<TaskDetail> {
  const response = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/assign`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown Error')
    throw new Error(`API Error ${response.status}: ${errorText}`)
  }

  return response.json()
}
