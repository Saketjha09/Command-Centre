import type { TaskSummary } from '../../types/task'

interface TaskCardProps {
  task: TaskSummary
  isTransitioning: boolean
  onClick: () => void
}

const BRAND_COLORS: Record<string, string> = {
  master_app: 'bg-indigo-500',
  supernova_ai: 'bg-emerald-500',
}

const PRIORITY_THEME: Record<string, { label: string, color: string, bg: string }> = {
  low: { label: 'LOW', color: 'text-slate-400', bg: 'bg-slate-50' },
  medium: { label: 'MEDIUM', color: 'text-blue-500', bg: 'bg-blue-50/50' },
  high: { label: 'HIGH', color: 'text-orange-500', bg: 'bg-orange-50/50' },
  urgent: { label: 'URGENT', color: 'text-red-500', bg: 'bg-red-50' },
}

function getDeadlineLabel(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return `${Math.abs(days)}d late`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

export function TaskCard({ task, isTransitioning, onClick }: TaskCardProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    if (isTransitioning) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.setData('fromStatus', task.status)
    e.currentTarget.classList.add('dragging')
  }

  const isOverdue = task.deadline && 
    new Date(task.deadline).getTime() < Date.now() && 
    task.status !== 'approved' && 
    task.status !== 'paid'

  const priority = PRIORITY_THEME[task.priority] || PRIORITY_THEME.medium

  return (
    <div
      draggable={!isTransitioning}
      onDragStart={handleDragStart}
      onDragEnd={e => e.currentTarget.classList.remove('dragging')}
      onClick={onClick}
      className={`
        group relative flex flex-col gap-4 p-5 bg-white border border-gray-100 transition-all duration-300 cursor-grab active:cursor-grabbing rounded-3xl shadow-sm
        ${isOverdue ? 'border-red-100 shadow-red-500/5' : 'hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5'}
        ${isTransitioning ? 'opacity-40 grayscale pointer-events-none scale-95' : 'hover:-translate-y-1 active:scale-[0.98]'}
      `}
    >
      {/* Brand Accent Bar */}
      <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-all group-hover:w-1.5 ${BRAND_COLORS[task.brand] || 'bg-gray-200'}`} />

      {/* Top Row: Brand & Priority */}
      <div className="flex items-center justify-between ml-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
          {task.brand.replace('_', ' ')}
        </span>
        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest ${priority.bg} ${priority.color}`}>
           {priority.label}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-[14px] font-bold text-gray-900 leading-tight line-clamp-2 ml-2 group-hover:text-indigo-600 transition-colors">
        {task.title}
      </h4>

      {/* Footer: Deadline & Assignee */}
      <div className="flex items-center justify-between mt-1 ml-2">
        <div className="flex items-center gap-2">
           {task.deadline ? (
             <div className="flex items-center gap-1.5">
                <svg className={`w-3 h-3 ${isOverdue ? 'text-red-500' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                   {getDeadlineLabel(task.deadline)}
                </span>
             </div>
           ) : (
             <span className="text-[10px] font-bold text-gray-200 uppercase tracking-tighter">No Deadline</span>
           )}
        </div>

        {task.assigned_to_name ? (
           <div className="flex items-center gap-2 group/assignee">
              <span className="text-[9px] font-bold text-gray-300 opacity-0 group-hover/assignee:opacity-100 transition-opacity uppercase tracking-tighter">
                 {task.assigned_to_name.split(' ')[0]}
              </span>
              <div className="w-6 h-6 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400 uppercase shadow-sm group-hover/assignee:border-indigo-200 group-hover/assignee:text-indigo-500 transition-all">
                {task.assigned_to_name[0]}
              </div>
           </div>
        ) : (
           <div className="w-6 h-6 rounded-xl border border-dashed border-gray-200 flex items-center justify-center group-hover:border-indigo-200 transition-all">
              <svg className="w-3 h-3 text-gray-200 group-hover:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
           </div>
        )}
      </div>
    </div>
  )
}
