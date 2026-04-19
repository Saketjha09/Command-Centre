import { useState } from 'react'
import type { TaskSummary } from '../../types/task'
import type { TaskStatus } from '../../types/task'
import { STATUS_LABELS } from '../../types/task'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: TaskSummary[]
  transitioningTaskId: string | null
  onDrop: (taskId: string, fromStatus: string, toStatus: string) => void
}

export function KanbanColumn({
  status,
  tasks,
  transitioningTaskId,
  onDrop,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear when leaving the column entirely (not a child element).
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

  return (
    <div
      className="flex flex-col shrink-0 rounded-xl transition-all duration-150"
      style={{
        width: 280,
        backgroundColor: '#1a1d27',
        border: isDragOver ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.05)',
        boxShadow: isDragOver ? '0 0 0 1px #6366f1, inset 0 0 20px rgba(99,102,241,0.05)' : undefined,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {STATUS_LABELS[status]}
        </span>
        <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
          {tasks.length}
        </span>
      </div>

      {/* Card list — scrollable */}
      <div className="flex flex-col gap-2.5 p-3 overflow-y-auto flex-1"
           style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg py-8
            border border-dashed border-white/10 text-slate-600 text-sm">
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isTransitioning={transitioningTaskId === task.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
