import { useState, useCallback, useEffect } from 'react'
import type { TaskSummary, WSMessage } from '../../types/task'
import { TASK_STATUSES } from '../../types/task'
import { fetchTasks, transitionTaskStatus } from '../../services/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { KanbanColumn } from './KanbanColumn'

const BRAND_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'master_app', label: 'Master App' },
  { value: 'supernova_ai', label: 'Supernova AI' },
]

export function KanbanBoard() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [transitioningTaskId, setTransitioningTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadTasks = useCallback(async (brand: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchTasks(brand || undefined)
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTasks(brandFilter)
  }, [brandFilter, loadTasks])

  // ── WebSocket real-time updates ──────────────────────────────────────────────

  const handleMessage = useCallback((msg: WSMessage) => {
    setTasks(prev => {
      switch (msg.type) {
        case 'task.created': {
          // Add if it matches the current brand filter (or no filter).
          if (brandFilter && msg.payload.brand !== brandFilter) return prev
          // Avoid duplicates from optimistic + WS.
          if (prev.some(t => t.id === msg.payload.id)) return prev
          return [...prev, msg.payload]
        }
        case 'task.assigned':
        case 'task.status_changed': {
          return prev.map(t => t.id === msg.payload.id ? msg.payload : t)
        }
        default:
          return prev
      }
    })
  }, [brandFilter])

  const handleReconnect = useCallback(() => {
    // Refetch on reconnect to catch any events missed during disconnect.
    void loadTasks(brandFilter)
  }, [brandFilter, loadTasks])

  const { status: wsStatus } = useWebSocket({
    onMessage: handleMessage,
    onReconnect: handleReconnect,
    enabled: true,
  })

  // ── Drag-and-drop with optimistic UI ─────────────────────────────────────────

  const handleDrop = useCallback(async (
    taskId: string,
    fromStatus: string,
    toStatus: string,
  ) => {
    // Optimistic update — move card immediately.
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: toStatus } : t),
    )
    setTransitioningTaskId(taskId)
    setError(null)

    try {
      const updated = await transitionTaskStatus(taskId, toStatus)
      // Replace with server truth.
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: updated.status, assigned_to: updated.assigned_to }
          : t,
      ))
    } catch (err) {
      // ROLLBACK — restore original status.
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, status: fromStatus } : t),
      )
      setError(
        err instanceof Error
          ? `Move failed: ${err.message}`
          : 'Move failed — please try again',
      )
    } finally {
      setTransitioningTaskId(null)
    }
  }, [])

  // ── Group tasks by status ────────────────────────────────────────────────────

  const tasksByStatus = TASK_STATUSES.reduce<Record<string, TaskSummary[]>>(
    (acc, s) => {
      acc[s] = tasks.filter(t => t.status === s)
      return acc
    },
    {},
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#0f1117' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        {/* Brand filter */}
        <div className="flex items-center gap-2">
          {BRAND_OPTIONS.map(opt => (
            <button
              key={opt.value}
              id={`filter-${opt.value || 'all'}`}
              onClick={() => setBrandFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                ${brandFilter === opt.value
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* WS status indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            wsStatus === 'connected' ? 'bg-emerald-400' :
            wsStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
            'bg-red-500'
          }`} />
          <span className="text-xs text-slate-500 capitalize">{wsStatus}</span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2.5 rounded-lg bg-red-950/50 border border-red-800/50
          text-red-300 text-sm flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 ml-4 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Board */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span>Loading tasks…</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 h-full" style={{ width: 'max-content', minWidth: '100%' }}>
            {TASK_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status] ?? []}
                transitioningTaskId={transitioningTaskId}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
