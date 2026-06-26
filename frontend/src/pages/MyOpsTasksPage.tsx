import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchOpsTasks, updateOpsTaskStatus } from '../services/opsService'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { OpsTask, OpsTaskStatus } from '../types/ops'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function MyOpsTasksPage() {
  const { name, role } = useAuth()
  const [tasks, setTasks] = useState<OpsTask[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchOpsTasks()
      setTasks(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadTasks() }, [loadTasks])

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(() => { fetchOpsTasks().then(setTasks).catch(console.error) }, 30000)
    return () => clearInterval(interval)
  }, [])

  const counts = useMemo(() => {
    const c = { assigned: 0, in_progress: 0, done: 0 }
    tasks.forEach(t => { c[t.status]++ })
    return c
  }, [tasks])

  const handleStatusUpdate = async (taskId: string, newStatus: OpsTaskStatus) => {
    setUpdatingId(taskId)
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      await updateOpsTaskStatus(taskId, { status: newStatus })
      setFlashId(taskId)
      setTimeout(() => setFlashId(null), 1500)
    } catch (err) {
      console.error(err)
      void loadTasks()
    } finally {
      setUpdatingId(null)
    }
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#0d1117' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0d1117' }}>
      {/* Header */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #30363d' }}>
        <h2 className="text-lg font-bold" style={{ color: '#e6edf3' }}>My Tasks</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm" style={{ color: '#8b949e' }}>{name}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: '#21262d', color: '#8b949e' }}>
            {role}
          </span>
          <span className="text-sm ml-2" style={{ color: '#8b949e' }}>{today}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#1f6feb' }} />
            <span className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{counts.assigned}</span>
            <span className="text-xs" style={{ color: '#8b949e' }}>Assigned</span>
          </div>
          <span style={{ color: '#30363d' }}>·</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#d29922' }} />
            <span className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{counts.in_progress}</span>
            <span className="text-xs" style={{ color: '#8b949e' }}>In Progress</span>
          </div>
          <span style={{ color: '#30363d' }}>·</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#238636' }} />
            <span className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{counts.done}</span>
            <span className="text-xs" style={{ color: '#8b949e' }}>Done</span>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <svg className="w-12 h-12" style={{ color: '#8b949e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium" style={{ color: '#8b949e' }}>No tasks assigned to you yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {tasks.map(task => {
              const isFlashing = flashId === task.id
              return (
                <div
                  key={task.id}
                  className="rounded-xl p-5 transition-all"
                  style={{
                    background: '#161b22',
                    border: isFlashing ? '1px solid #238636' : '1px solid #30363d',
                    boxShadow: isFlashing ? '0 0 0 2px rgba(35,134,54,0.3)' : 'none',
                  }}
                >
                  {/* Top row: brand + status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium" style={{ color: '#8b949e' }}>{task.brand_name}</span>
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase"
                      style={{
                        background: task.status === 'assigned' ? '#1f6feb'
                          : task.status === 'in_progress' ? '#d29922'
                          : '#238636'
                      }}
                    >
                      {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'Assigned'}
                    </span>
                  </div>

                  {/* Brief — fully visible */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4" style={{ color: '#e6edf3' }}>
                    {task.brief}
                  </p>

                  {/* Sheet link */}
                  {task.sheet_link && (
                    <a
                      href={task.sheet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold mb-4 transition-colors"
                      style={{ background: '#21262d', color: '#1f6feb', border: '1px solid #30363d' }}
                    >
                      Open Sheet
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

                  {/* Action + time */}
                  <div className="flex items-center justify-between">
                    <div>
                      {task.status === 'assigned' && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                          disabled={updatingId === task.id}
                          className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors active:scale-95"
                          style={{ background: '#1f6feb' }}
                        >
                          {updatingId === task.id ? 'Starting...' : 'Start Working'}
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'done')}
                          disabled={updatingId === task.id}
                          className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors active:scale-95"
                          style={{ background: '#238636' }}
                        >
                          {updatingId === task.id ? 'Marking...' : 'Mark Done'}
                        </button>
                      )}
                      {task.status === 'done' && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" style={{ color: '#238636' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs font-semibold" style={{ color: '#238636' }}>Completed</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: '#8b949e' }}>{timeAgo(task.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
