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

const STATUS_ACCENT: Record<string, string> = {
  brief_pending: 'border-t-zinc-500',
  in_progress: 'border-t-indigo-500',
  review: 'border-t-amber-500',
  approved: 'border-t-emerald-500',
  paid: 'border-t-blue-500',
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

  const accentColor = STATUS_ACCENT[status] || 'border-t-zinc-500'

  return (
    <div
      className={`flex-1 min-w-[280px] flex flex-col max-h-full rounded-2xl bg-[#18181b]/50 transition-all duration-150 border border-[#27272a] border-t-2 ${accentColor} ${
        isDragOver ? 'bg-[#27272a]/50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] tracking-widest uppercase font-bold text-[#71717a]">
            {STATUS_LABELS[status] ?? status}
          </span>
          <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] border border-[#3f3f46]">
            {tasks.length}
          </span>
        </div>
        <button 
          onClick={onAdd} 
          className="text-[#71717a] hover:text-[#fafafa] hover:bg-[#27272a] p-1.5 rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-2 overflow-y-auto px-2 py-2 flex-1 min-h-[100px]">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isTransitioning={transitioningTaskId === task.id}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
      </div>
    </div>
  )
}
