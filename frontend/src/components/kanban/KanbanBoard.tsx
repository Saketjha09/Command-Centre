import { useState, useCallback, useEffect } from 'react'
import type { TaskSummary, TaskStatus } from '../../types/task'
import { TASK_STATUSES } from '../../types/task'
import { fetchTasks, transitionTaskStatus, createTask, fetchBrands } from '../../services/api'
import { KanbanColumn } from './KanbanColumn'
import { TaskDrawer } from './TaskDrawer'
import { useWS } from '../../context/WebSocketContext'
import { useAuth } from '../../hooks/useAuth'
import type { Brand } from '../../types/brand'
import { useSearchParams } from 'react-router-dom'

export function KanbanBoard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const brandFilter = searchParams.get('brand') || ''
  
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [transitioningTaskId, setTransitioningTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [drawerInitialStatus, setDrawerInitialStatus] = useState<TaskStatus | undefined>(undefined)

  const [searchQuery, setSearchQuery] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(false)

  const { lastMessage } = useWS()
  const user = useAuth()

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async (brand: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const [tasksData, brandsData] = await Promise.all([
        fetchTasks(brand || undefined),
        fetchBrands()
      ])
      setTasks(tasksData)
      setBrands(brandsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData(brandFilter)
  }, [brandFilter, loadData])

  // ── WS Message Handling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;
    
    if (lastMessage.type === 'task.reconnect' as string) {
      void loadData(brandFilter)
      return;
    }

    const msg = lastMessage;
    setTasks(prev => {
      switch (msg.type) {
        case 'task.created': {
          if (brandFilter && msg.payload.brand !== brandFilter) return prev
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
  }, [lastMessage, brandFilter, loadData])

  // ── Drag-and-drop with optimistic UI ─────────────────────────────────────────

  const handleDrop = useCallback(async (
    taskId: string,
    fromStatus: string,
    toStatus: string,
  ) => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: toStatus } : t),
    )
    setTransitioningTaskId(taskId)
    setError(null)

    try {
      const updated = await transitionTaskStatus(taskId, toStatus)
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: updated.status, assigned_to: updated.assigned_to }
          : t,
      ))
    } catch (err) {
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, status: fromStatus } : t),
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

  const handleCreateTask = async (data: { title: string; brand: string; deadline?: string; status?: string }) => {
    const tempId = `temp-${Date.now()}`
    
    // Add optimistic task
    const optimisticTask: TaskSummary = {
      id: tempId,
      title: data.title,
      brand: data.brand,
      status: (data.status as any) || 'brief_pending',
      assigned_to: '',
      deadline: data.deadline || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    <div className="relative flex flex-col h-full bg-[#09090b]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-[#18181b] border-b border-[#27272a]">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#fafafa]">Board</h2>
          <div className="px-2.5 py-0.5 rounded-full bg-[#27272a] text-xs font-medium text-[#a1a1aa] border border-[#3f3f46]">
            {tasks.length} tasks
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <svg className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#09090b] border border-[#27272a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#4f46e5] w-48 z-10 relative pointer-events-auto transition-all"
            />
          </div>

          {/* Assigned to me */}
          <button
            onClick={() => setAssignedToMe(!assignedToMe)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              assignedToMe
                ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-lg shadow-indigo-500/20'
                : 'bg-transparent text-[#a1a1aa] border-[#27272a] hover:text-[#fafafa] hover:bg-[#27272a]'
            }`}
          >
            Assigned to me
          </button>

          {/* Brand Filters */}
          <div className="flex items-center gap-1 bg-[#09090b] rounded-lg p-1 border border-[#27272a] overflow-x-auto max-w-md no-scrollbar">
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.delete('brand')
                setSearchParams(params)
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                !brandFilter
                  ? 'bg-[#27272a] text-white border border-[#3f3f46]'
                  : 'bg-transparent text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
            >
              All Brands
            </button>
            {brands.map(b => (
              <button
                key={b.id}
                onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  params.set('brand', b.slug)
                  setSearchParams(params)
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  brandFilter === b.slug
                    ? 'text-white border border-white/20'
                    : 'bg-transparent text-[#a1a1aa] hover:text-[#fafafa]'
                }`}
                style={brandFilter === b.slug ? { backgroundColor: b.hex_color } : {}}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar px-6 py-6">
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
      />
    </div>
  )
}
