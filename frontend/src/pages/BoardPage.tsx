import { useState, useCallback, useEffect } from 'react'
import type { TaskSummary, TaskStatus } from '../types/task'
import { TASK_STATUSES } from '../types/task'
import { fetchTasks, transitionTaskStatus, createTask } from '../services/api'
import { KanbanColumn } from '../components/kanban/KanbanColumn'
import { TaskDrawer } from '../components/kanban/TaskDrawer'
import { useWS } from '../context/WebSocketContext'
import { useAuth } from '../hooks/useAuth'

const BRAND_OPTIONS = [
  { value: '', label: 'All Brands' },
  { value: 'master_app', label: 'Master App' },
  { value: 'supernova_ai', label: 'Supernova AI' },
]

export function KanbanBoard() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [transitioningTaskId, setTransitioningTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [drawerInitialStatus, setDrawerInitialStatus] = useState<TaskStatus | undefined>(undefined)

  const [searchQuery, setSearchQuery] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(false)

  const { lastMessage } = useWS()
  const user = useAuth()

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

  // ── WS Message Handling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;
    
    if (lastMessage.type === 'task.reconnect' as string) {
      void loadTasks(brandFilter)
      return;
    }

    const msg = lastMessage;
    const payload = msg.payload as TaskSummary;
    setTasks(prev => {
      switch (msg.type) {
        case 'task.created': {
          if (brandFilter && payload.brand !== brandFilter) return prev
          if (prev.some(t => t.id === payload.id)) return prev
          return [...prev, payload]
        }
        case 'task.assigned':
        case 'task.status_changed': {
          return prev.map(t => t.id === payload.id ? payload : t)
        }
        default:
          return prev
      }
    })
  }, [lastMessage, brandFilter, loadTasks])

  // ── Drag-and-drop with optimistic UI ─────────────────────────────────────────

  const handleDrop = useCallback(async (
    taskId: string,
    fromStatus: string,
    toStatus: string,
  ) => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: toStatus as TaskStatus } : t),
    )
    setTransitioningTaskId(taskId)
    setError(null)

    try {
      const updated = await transitionTaskStatus(taskId, toStatus)
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: updated.status as TaskStatus, assigned_to: updated.assigned_to }
          : t,
      ))
    } catch (err) {
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, status: fromStatus as TaskStatus } : t),
      )
      setError(
        err instanceof Error
          ? `Move failed: ${err.message}`
          : 'Move failed — please try again',
      )
      setTimeout(() => setError(null), 5000)
    } finally {
      setTransitioningTaskId(null)
    }
  }, [])

  // ── Task Creation with optimistic UI ─────────────────────────────────────────

  const handleCreateTask = async (data: { title: string; description: string; brand: string; priority: string; deadline?: string; content_type: string; assigned_to?: string; status?: string }) => {
    const tempId = `temp-${Date.now()}`

    const optimisticTask: TaskSummary = {
      id: tempId,
      title: data.title,
      brand: data.brand,
      status: (data.status as TaskStatus) || 'unassigned',
      priority: (data.priority as TaskSummary['priority']) || 'medium',
      assigned_to: data.assigned_to || null,
      deadline: data.deadline || null,
      created_at: new Date().toISOString()
    }

    // Only show if it matches filter
    if (!brandFilter || brandFilter === data.brand) {
      setTasks(prev => [...prev, optimisticTask])
    }
    setIsDrawerOpen(false)

    try {
      const created = await createTask(data)
      setTasks(prev => prev.map(t => t.id === tempId ? created : t))
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId))
      setError(err instanceof Error ? `Create failed: ${err.message}` : 'Create failed')
      setTimeout(() => setError(null), 5000)
    }
  }

  const tasksByStatus = TASK_STATUSES.reduce<Record<string, TaskSummary[]>>(
    (acc, s) => {
      // client-side search & assign filter
      let filtered = tasks.filter((t) => t.status === s)
      if (searchQuery) {
        filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
      }
      if (assignedToMe && user?.id) {
        filtered = filtered.filter(t => t.assigned_to === user.id)
      }
      acc[s] = filtered
      return acc
    },
    {}
  )

  return (
    <div className="relative flex flex-col h-full bg-[#0d1117] bg-dots">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-100">Board</h2>
          <div className="px-2.5 py-0.5 rounded-full bg-[#1c2128] text-xs font-medium text-slate-400">
            {tasks.length} tasks
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#161b22] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#e6edf3] placeholder-[#7d8590] focus:outline-none focus:border-indigo-500 w-48 z-10 relative pointer-events-auto"
            />
          </div>

          {/* Assigned to me */}
          <button
            onClick={() => setAssignedToMe(!assignedToMe)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              assignedToMe
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-transparent text-[#7d8590] border-white/10 hover:text-[#e6edf3]'
            }`}
          >
            Assigned to me
          </button>

          {/* Brand Filters */}
          <div className="flex items-center gap-1 bg-[#161b22] rounded-lg p-1 border border-white/10">
            {BRAND_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBrandFilter(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  brandFilter === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-transparent text-[#7d8590] hover:text-[#e6edf3]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setSelectedTaskId(null)
              setDrawerInitialStatus(undefined)
              setIsDrawerOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all pointer-events-auto shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            New Task
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-500 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span>Loading tasks…</span>
          </div>
        ) : (
          <div className="flex gap-4 h-full w-full">
            {TASK_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status] ?? []}
                transitioningTaskId={transitioningTaskId}
                onDrop={handleDrop}
                onTaskClick={(taskId) => {
                  setSelectedTaskId(taskId)
                  setDrawerInitialStatus(undefined)
                  setIsDrawerOpen(true)
                }}
                onAdd={() => {
                  setSelectedTaskId(null)
                  setDrawerInitialStatus(status)
                  setIsDrawerOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-6 right-6 fade-in flex items-center justify-between min-w-[300px] px-4 py-3 rounded-xl bg-[#161b22] border border-red-500/20 shadow-pop text-sm font-medium z-50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="text-red-200">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-500 hover:text-slate-300 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      <TaskDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        mode={selectedTaskId ? 'view' : 'create'}
        taskId={selectedTaskId}
        initialStatus={drawerInitialStatus}
        onCreate={handleCreateTask}
        onTaskUpdated={(updated) => {
          setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
        }}
        onTaskDeleted={(deletedId) => {
          setTasks(prev => prev.filter(t => t.id !== deletedId))
          setIsDrawerOpen(false)
        }}
      />
    </div>
  )
}
