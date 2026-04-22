// Task status union — mirrors the ops.task_status ENUM in the database.
export type TaskStatus =
  | 'brief_pending'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'paid'

// Ordered list of statuses for column rendering.
export const TASK_STATUSES: TaskStatus[] = [
  'brief_pending',
  'in_progress',
  'review',
  'approved',
  'paid',
]

// Humanized column labels.
export const STATUS_LABELS: Record<TaskStatus, string> = {
  brief_pending: 'Brief Pending',
  in_progress: 'In Progress',
  review: 'Review',
  approved: 'Approved',
  paid: 'Paid',
}

// TaskSummary is returned in list responses — lightweight.
export interface TaskSummary {
  id: string
  title: string
  brand: 'master_app' | 'supernova_ai'
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null
  assigned_to_name?: string | null
  deadline: string | null // ISO 8601
  created_at: string
}

// TaskDetail is returned for single-task responses — full representation.
export interface TaskDetail {
  id: string
  title: string
  description: string
  brand: 'master_app' | 'supernova_ai'
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null
  created_by: string
  deadline: string | null
  notification_failed: boolean
  created_at: string
  updated_at: string
}

// WSMessage is the shape of every message pushed over the WebSocket.
export interface WSMessage {
  type: 'task.created' | 'task.assigned' | 'task.status_changed'
  payload: TaskSummary
}
