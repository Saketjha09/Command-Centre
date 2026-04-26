import { useState, useEffect, useCallback, useMemo } from 'react'
import type { TaskSummary, TaskStatus } from '../types/task'
import { KANBAN_COLUMNS } from '../types/task'
import { getTasks, updateTaskStatus } from '../services/taskService'
import { useWebSocket } from './useWebSocket'

export type TaskColumns = Record<TaskStatus, TaskSummary[]>

export function useTaskBoard() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const groupTasks = useCallback((taskList: TaskSummary[]): TaskColumns => {
    const cols = KANBAN_COLUMNS.reduce((acc, col) => {
      acc[col] = []
      return acc
    }, {} as TaskColumns)

    taskList.forEach((task) => {
      if (cols[task.status]) {
        cols[task.status].push(task)
      }
    })

    return cols
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTasks()
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  const silentRefetch = useCallback(async () => {
    setIsSyncing(true)
    try {
      const data = await getTasks()
      setTasks(data)
      setError(null)
    } catch {
      // Fail silently for background sync
    } finally {
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useWebSocket({
    enabled: true,
    onMessage: useCallback((msg) => {
      if (msg.type === 'task.status_changed' || msg.type === 'task.assigned') {
        silentRefetch()
      }
    }, [silentRefetch]),
  })

  const moveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    let previousTasks: TaskSummary[] = []
    
    setTasks((current) => {
      previousTasks = current
      return current.map((t) => 
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    })

    try {
      await updateTaskStatus(taskId, newStatus)
      setError(null)
    } catch (err) {
      setTasks(previousTasks)
      setError(err instanceof Error ? err.message : 'Failed to update task status')
    }
  }, [])

  const columns = useMemo(() => groupTasks(tasks), [tasks, groupTasks])

  return {
    columns,
    loading,
    error,
    isSyncing,
    moveTask,
    refetch: fetchData,
  }
}
