import { useState } from 'react'
import type { TaskSummary, TaskStatus } from '../../types/task'
import { STATUS_LABELS } from '../../types/task'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: TaskSummary[]
  transitioningTaskId: string | null
  onDrop: (taskId: string, fromStatus: string, toStatus: string) => void
  onTaskClick: (taskId: string) => void
  onAdd: () => void
}

const STATUS_THEME: Record<TaskStatus, { bg: string, text: string, border: string, ring: string }> = {
  unassigned: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', ring: 'ring-slate-400/10' },
  assigned: { bg: 'bg-blue-50/50', text: 'text-blue-600', border: 'border-blue-100', ring: 'ring-blue-500/10' },
  in_progress: { bg: 'bg-indigo-50/50', text: 'text-indigo-600', border: 'border-indigo-100', ring: 'ring-indigo-500/10' },
  in_review: { bg: 'bg-amber-50/50', text: 'text-amber-600', border: 'border-amber-100', ring: 'ring-amber-500/10' },
  done: { bg: 'bg-emerald-50/50', text: 'text-emerald-600', border: 'border-emerald-100', ring: 'ring-emerald-500/10' },
}

export function KanbanColumn({
  status,
  tasks,
  transitioningTaskId,
  onDrop,
  onTaskClick,
  onAdd,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const taskId = e.dataTransfer.getData('taskId')
    const fromStatus = e.dataTransfer.getData('fromStatus')
    if (taskId && fromStatus && fromStatus !== status) {
      onDrop(taskId, fromStatus, status)
    }
  }

  const theme = STATUS_THEME[status] || STATUS_THEME.unassigned

  return (
    <div
      className={`flex-1 min-w-[320px] flex flex-col max-h-full rounded-3xl bg-gray-50/50 border border-gray-100 transition-all duration-300 ${
        isDragOver ? 'bg-indigo-50/30 border-indigo-200 ring-4 ring-indigo-500/5 shadow-inner scale-[1.01]' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm ${theme.bg} ${theme.border}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${theme.text.replace('text-', 'bg-')}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${theme.text}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <span className="text-[10px] font-bold tabular-nums text-gray-400">
            {tasks.length}
          </span>
        </div>
        <button 
          onClick={onAdd} 
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all active:scale-90"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4 flex-1 min-h-[150px] custom-scrollbar">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isTransitioning={transitioningTaskId === task.id}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
        {tasks.length === 0 && !isDragOver && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-20 grayscale scale-95 transition-all">
             <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Empty Section</span>
          </div>
        )}
      </div>
    </div>
  )
}
