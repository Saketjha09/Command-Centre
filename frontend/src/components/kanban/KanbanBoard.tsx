import { useState, useCallback, useEffect } from 'react'
import type { TaskSummary, TaskStatus } from '../../types/task'
import { TASK_STATUSES } from '../../types/task'
import { fetchTasks, transitionTaskStatus, createTask, fetchBrands } from '../../services/api'
import { KanbanColumn } from './KanbanColumn'
import { TaskListView } from './TaskListView'
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
  const [viewType, setViewType] = useState<'list' | 'board'>('list')
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
      setError(err instanceof Error ? `Move failed: ${err.message}` : 'Move failed')
      setTimeout(() => setError(null), 5000)
    } finally {
      setTransitioningTaskId(null)
    }
  }, [])

  const handleCreateTask = async (data: any) => {
    try {
      const created = await createTask(data)
      setTasks(prev => [...prev, created])
      setIsDrawerOpen(false)
    } catch (err: any) {
      setError(err.message || 'Create failed')
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (assignedToMe && user?.id && t.assigned_to !== user.id) return false
    return true
  })

  const tasksByStatus = TASK_STATUSES.reduce<Record<string, TaskSummary[]>>(
    (acc, s) => {
      acc[s] = filteredTasks.filter((t) => t.status === s)
      return acc
    },
    {}
  )

  return (
    <div className="flex flex-col h-full bg-white">
      {/* View Switcher & Filters */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center bg-gray-200/50 p-1 rounded-lg">
            <button
              onClick={() => setViewType('list')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                viewType === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              LIST
            </button>
            <button
              onClick={() => setViewType('board')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                viewType === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              BOARD
            </button>
          </div>

          <div className="flex items-center gap-1">
             <button
               onClick={() => {
                 const params = new URLSearchParams(searchParams)
                 params.delete('brand')
                 setSearchParams(params)
               }}
               className={`px-3 py-1 text-[11px] font-bold rounded-md border ${
                 !brandFilter ? 'bg-white border-gray-300 text-gray-900' : 'bg-transparent border-transparent text-gray-500 hover:text-gray-900'
               }`}
             >
               ALL
             </button>
             {brands.map(b => (
               <button
                 key={b.id}
                 onClick={() => {
                   const params = new URLSearchParams(searchParams)
                   params.set('brand', b.slug)
                   setSearchParams(params)
                 }}
                 className={`px-3 py-1 text-[11px] font-bold rounded-md border transition-all ${
                   brandFilter === b.slug ? 'bg-white border-gray-300 text-gray-900' : 'bg-transparent border-transparent text-gray-500 hover:text-gray-900'
                 }`}
               >
                 {b.name.toUpperCase()}
               </button>
             ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative">
             <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
             <input 
               type="text" 
               placeholder="Search projects..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="bg-white border border-gray-200 rounded-md pl-9 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48 transition-all"
             />
           </div>

           <button
             onClick={() => setAssignedToMe(!assignedToMe)}
             className={`px-3 py-1.5 rounded-md text-[11px] font-bold border transition-all ${
               assignedToMe ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
             }`}
           >
             MY TASKS
           </button>
        </div>
      </div>

      {/* Main Content */}
      {viewType === 'list' ? (
        <TaskListView 
          tasks={filteredTasks} 
          loading={isLoading} 
          onTaskClick={(id) => {
            setSelectedTaskId(id)
            setIsDrawerOpen(true)
          }}
        />
      ) : (
        <div className="flex-1 overflow-x-auto p-6 bg-gray-50/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="flex gap-4 h-full">
              {TASK_STATUSES.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status] || []}
                  transitioningTaskId={transitioningTaskId}
                  onDrop={handleDrop}
                  onTaskClick={(id) => {
                    setSelectedTaskId(id)
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
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 px-4 py-3 bg-red-600 text-white rounded-lg shadow-xl text-xs font-bold z-[100] animate-in slide-in-from-right-full">
          {error}
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
