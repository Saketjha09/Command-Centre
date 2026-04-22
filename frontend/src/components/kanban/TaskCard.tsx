import type { TaskSummary } from '../../types/task'

interface TaskCardProps {
  task: TaskSummary
  isTransitioning: boolean
  onClick: () => void
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-[#27272a] text-[#a1a1aa] border-[#3f3f46]',
  medium: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  urgent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

function getDeadlineLabel(deadline: string): string {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return `${Math.abs(days)}d late`
  if (days === 0) return 'Today'
  return `${days}d`
}

export function TaskCard({ task, isTransitioning, onClick }: TaskCardProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    if (isTransitioning) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.setData('fromStatus', task.status)
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('dragging')
      }
    }, 0)
  }

  const isOverdue = task.deadline && 
    new Date(task.deadline).getTime() < Date.now() && 
    task.status !== 'approved' && 
    task.status !== 'paid'

  return (
    <div
      draggable={!isTransitioning}
      onDragStart={handleDragStart}
      onDragEnd={e => e.currentTarget.classList.remove('dragging')}
      onClick={onClick}
      className={`
        group relative flex flex-col gap-2.5 p-3.5 bg-[#18181b] rounded-xl border transition-all duration-300 cursor-grab active:cursor-grabbing shadow-sm
        ${isOverdue ? 'border-rose-500/30 bg-rose-500/[0.02]' : 'border-[#27272a] hover:border-indigo-500/30'}
        ${isTransitioning ? 'opacity-40 grayscale pointer-events-none' : 'hover:bg-[#1c1c1f] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/5'}
      `}
    >
      {/* Top Row: Brand & Priority */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[9px] font-bold text-[#71717a] uppercase tracking-wider">
            {task.brand.replace('_', ' ')}
          </span>
        </div>
        <div className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
           {task.priority}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-bold text-[#fafafa] leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
        {task.title}
      </h4>

      {/* Footer: Deadline & Assignee */}
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex items-center gap-2">
           {task.deadline ? (
             <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight ${isOverdue ? 'text-rose-400' : 'text-[#52525b]'}`}>
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {getDeadlineLabel(task.deadline)}
             </div>
           ) : (
             <div className="text-[10px] font-bold text-[#27272a] uppercase">No date</div>
           )}
        </div>

        {task.assigned_to_name ? (
           <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-[#52525b] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">{task.assigned_to_name.split(' ')[0]}</span>
              <div className="w-6 h-6 rounded-full bg-indigo-600 border border-indigo-500 flex items-center justify-center text-[9px] font-black text-white uppercase shadow-lg shadow-indigo-500/20">
                {task.assigned_to_name[0]}
              </div>
           </div>
        ) : (
           <div className="w-6 h-6 rounded-full border border-dashed border-[#27272a] flex items-center justify-center">
              <svg className="w-3 h-3 text-[#3f3f46]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
           </div>
        )}
      </div>

      {/* Pulse for Overdue */}
      {isOverdue && <div className="absolute inset-0 rounded-xl border border-rose-500/20 animate-pulse pointer-events-none" />}
    </div>
  )
}
