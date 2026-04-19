import type { TaskSummary } from '../../types/task'

interface TaskCardProps {
  task: TaskSummary
  isTransitioning: boolean
}

/** Formats a deadline ISO string as "Dec 31" */
function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Returns urgency class based on how close the deadline is. */
function deadlineClass(iso: string): string {
  const now = new Date()
  const deadline = new Date(iso)
  const diffMs = deadline.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return 'text-red-400'
  if (diffDays <= 3) return 'text-amber-400'
  return 'text-slate-500'
}

const BRAND_STYLES: Record<string, string> = {
  master_app: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  supernova_ai: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
}

const BRAND_LABELS: Record<string, string> = {
  master_app: 'Master App',
  supernova_ai: 'Supernova AI',
}

export function TaskCard({ task, isTransitioning }: TaskCardProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    if (isTransitioning) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.setData('fromStatus', task.status)
  }

  return (
    <div
      draggable={!isTransitioning}
      onDragStart={handleDragStart}
      role="button"
      aria-label={`Task: ${task.title}`}
      className="group rounded-lg p-3.5 cursor-grab active:cursor-grabbing
        border border-white/5 shadow-lg
        transition-all duration-150 ease-in-out
        hover:-translate-y-0.5 hover:shadow-indigo-900/30 hover:border-white/10"
      style={{
        backgroundColor: '#242736',
        opacity: isTransitioning ? 0.5 : 1,
        pointerEvents: isTransitioning ? 'none' : undefined,
      }}
    >
      {/* Brand badge */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${BRAND_STYLES[task.brand] ?? ''}`}>
          {BRAND_LABELS[task.brand] ?? task.brand}
        </span>

        {/* Assigned avatar placeholder */}
        {task.assigned_to ? (
          <div
            className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center
              text-[10px] font-bold text-white ring-2 ring-[#242736]"
            title={`Assigned: ${task.assigned_to.slice(0, 8)}`}
          >
            {task.assigned_to.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border border-dashed border-slate-600" title="Unassigned" />
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-200 leading-snug mb-2 line-clamp-2">
        {task.title}
      </p>

      {/* Deadline */}
      {task.deadline && (
        <div className={`flex items-center gap-1 text-xs ${deadlineClass(task.deadline)}`}>
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDeadline(task.deadline)}</span>
        </div>
      )}

      {/* Transitioning spinner overlay */}
      {isTransitioning && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-[10px] text-indigo-400">Moving…</span>
        </div>
      )}
    </div>
  )
}
