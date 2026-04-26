// Task status union — mirrors the ops.task_status ENUM in the database.
export type TaskStatus =
  | 'unassigned'
  | 'assigned'
  | 'in_progress'
  | 'in_review'
  | 'done'

// Kanban column order for rendering.
export const KANBAN_COLUMNS: TaskStatus[] = [
  'unassigned',
  'assigned',
  'in_progress',
  'in_review',
  'done',
]

// Humanized column labels.
export const STATUS_LABELS: Record<TaskStatus, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

// TaskSummary is returned in list responses — lightweight.
export interface TaskSummary {
  id: string
  title: string
  brand: string
  status: TaskStatus
  priority: TaskPriority
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
  brand: string
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  created_by: string
  deadline: string | null
  notification_failed: boolean
  created_at: string
  updated_at: string
}

// WSMessage is the shape of every message pushed over the WebSocket.
export interface WSMessage {
  type: 
    | 'task.created' 
    | 'task.assigned' 
    | 'task.status_changed' 
    | 'availability:updated'
  payload: unknown
}
