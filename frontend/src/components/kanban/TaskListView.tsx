import { useState, useMemo } from 'react'
import type { TaskSummary, TaskStatus } from '../../types/task'
import { TASK_STATUSES, STATUS_LABELS } from '../../types/task'
import { LoadingSpinner } from '../LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'
import { updateTaskStatus } from '../../services/taskService'

interface Props {
  tasks: TaskSummary[]
  loading: boolean
  onTaskClick: (taskId: string) => void
  freelancerMode?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  unassigned: 'bg-slate-400',
  assigned: 'bg-indigo-500',
  in_progress: 'bg-blue-600',
  in_review: 'bg-orange-500',
  done: 'bg-emerald-500',
}

const PRIORITY_FLAGS: Record<string, { color: string }> = {
  high: { color: 'text-yellow-500' },
  medium: { color: 'text-blue-500' },
  low: { color: 'text-gray-400' },
}

export function TaskListView({ tasks, loading, onTaskClick, freelancerMode }: Props) {
  const { id: currentUserId } = useAuth()
  const [advancing, setAdvancing] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    return TASK_STATUSES.reduce((acc, status) => ({ ...acc, [status]: true }), {})
  })

  const groupedTasks = useMemo(() => {
    return TASK_STATUSES.reduce((acc, status) => {
      acc[status] = tasks.filter(t => t.status === status)
      return acc
    }, {} as Record<string, TaskSummary[]>)
  }, [tasks])

  const toggleGroup = (status: string) => {
    setExpandedGroups(prev => ({ ...prev, [status]: !prev[status] }))
  }

  const getAdvanceAction = (task: TaskSummary, userId: string): { label: string, nextStatus: TaskStatus } | null => {
    if (task.assigned_to !== userId) return null
    if (task.status === 'assigned') {
      return { label: 'Start Work', nextStatus: 'in_progress' }
    }
    if (task.status === 'in_progress') {
      return { label: 'Submit for Review', nextStatus: 'in_review' }
    }
    return null
  }

  const handleAdvance = async (e: React.MouseEvent, taskId: string, nextStatus: TaskStatus) => {
    e.stopPropagation()
    setAdvancing(prev => ({ ...prev, [taskId]: true }))
    try {
      await updateTaskStatus(taskId, nextStatus)
      // tasks will update via WS event task:status_changed
    } catch (err) {
      console.error('Failed to advance task:', err)
    } finally {
      setAdvancing(prev => ({ ...prev, [taskId]: false }))
    }
  }

  const getDateStatus = (deadline: string | null) => {
    if (!deadline) return { text: '', color: 'text-gray-400' }
    const date = new Date(deadline)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const taskDate = new Date(date)
    taskDate.setHours(0, 0, 0, 0)

    const diff = taskDate.getTime() - today.getTime()
    const days = diff / (1000 * 60 * 60 * 24)

    if (days < 0) return { text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: 'text-red-500' }
    if (days === 0) return { text: 'Today', color: 'text-orange-600' }
    return { text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: 'text-gray-500' }
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-white h-full">
      <div className="min-w-[1000px] p-6">
        {/* Table Header */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="w-8"></div>
          <div className="flex-1 text-xs text-gray-400 font-medium uppercase tracking-wider">Name</div>
          <div className="w-32 text-xs text-gray-400 font-medium uppercase tracking-wider">Assignee</div>
          <div className="w-32 text-xs text-gray-400 font-medium uppercase tracking-wider">Due date</div>
          <div className="w-32 text-xs text-gray-400 font-medium uppercase tracking-wider">Priority</div>
          <div className="w-40 text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Status / Action</div>
          <div className="w-24 text-xs text-gray-400 font-medium uppercase tracking-wider text-right pr-4">Comments</div>
        </div>

        {/* Groups */}
        {TASK_STATUSES.map(status => {
          const groupTasks = groupedTasks[status] || []
          const isExpanded = expandedGroups[status]
          const statusColor = STATUS_COLORS[status] || 'bg-blue-600'
          
          return (
            <div key={status} className="mt-6">
              {/* Group Header */}
              <div className="flex items-center gap-2 px-2 py-1 mb-1">
                <button 
                  onClick={() => toggleGroup(status)}
                  className={`p-0.5 hover:bg-gray-100 rounded transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className={`${statusColor} text-white px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded-sm shadow-sm min-w-[80px] text-center`}>
                  {STATUS_LABELS[status as TaskStatus]}
                </div>
                <span className="text-xs text-gray-400 font-medium ml-2">
                  {groupTasks.length} {groupTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              {/* Group Rows */}
              {isExpanded && (
                <div className="flex flex-col">
                  {groupTasks.map(task => {
                    const dateInfo = getDateStatus(task.deadline)
                    const advanceAction = getAdvanceAction(task, currentUserId)
                    const isAdvancing = advancing[task.id]
                    
                    return (
                      <div 
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className="flex items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group/row"
                      >
                        <div className="w-8 flex items-center justify-center">
                          <div className={`w-2 h-2 rounded-full ${statusColor} opacity-80`} />
                        </div>
                        
                        <div className="flex-1 flex items-center min-w-0 pr-4 relative">
                          <span className="text-sm text-gray-700 font-medium truncate">
                            {task.title}
                          </span>
                          
                          {/* Hover Actions */}
                          {!freelancerMode && (
                            <div className="ml-4 flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600" title="Add subtask">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                              </button>
                              <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600" title="Edit tags">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                              </button>
                              <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600" title="Edit name">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="w-32 flex items-center">
                          {task.assigned_to_name ? (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white shadow-sm" title={task.assigned_to_name}>
                              {task.assigned_to_name[0].toUpperCase()}
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                            </div>
                          )}
                        </div>

                        <div className={`w-32 text-sm font-medium ${dateInfo.color}`}>
                          {dateInfo.text || '--'}
                        </div>

                        <div className="w-32 flex items-center">
                          <div className={`flex items-center gap-1.5 ${PRIORITY_FLAGS[task.priority]?.color || 'text-gray-400'}`}>
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M4 2v20h2V14h11l2-3-2-3H6V2H4z" />
                            </svg>
                            <span className="text-xs font-medium capitalize">{task.priority}</span>
                          </div>
                        </div>

                        <div className="w-40 flex justify-center">
                          {isAdvancing ? (
                            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 animate-pulse">
                              <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              PROCESSING...
                            </div>
                          ) : freelancerMode ? (
                            <div className="flex items-center justify-center w-full">
                              {task.status === 'assigned' && (
                                <button
                                  onClick={(e) => handleAdvance(e, task.id, 'in_progress')}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
                                >
                                  Start Work
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </button>
                              )}
                              {task.status === 'in_progress' && (
                                <button
                                  onClick={(e) => handleAdvance(e, task.id, 'in_review')}
                                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
                                >
                                  Submit Review
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </button>
                              )}
                              {!['assigned', 'in_progress'].includes(task.status) && (
                                <div className={`${statusColor} text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-sm shadow-sm min-w-[80px] text-center opacity-50`}>
                                  {STATUS_LABELS[task.status as TaskStatus] || task.status}
                                </div>
                              )}
                            </div>
                          ) : advanceAction ? (
                            <button
                              onClick={(e) => handleAdvance(e, task.id, advanceAction.nextStatus)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >
                              {advanceAction.label}
                            </button>
                          ) : (
                            <div className={`${statusColor} text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-sm shadow-sm min-w-[80px] text-center`}>
                              {STATUS_LABELS[task.status as TaskStatus] || task.status}
                            </div>
                          )}
                        </div>

                        <div className="w-24 flex items-center justify-end pr-4">
                          <div className="flex items-center gap-1 text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Add Task Button */}
                  {!freelancerMode && (
                    <button className="flex items-center gap-2 px-6 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors text-xs font-medium border-b border-gray-100">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                      Add Task
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}
