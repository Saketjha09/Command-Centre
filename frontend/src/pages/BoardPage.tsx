import { KanbanBoard } from '../components/kanban/KanbanBoard'
import { useAuth } from '../hooks/useAuth'

export function BoardPage() {
  const { name } = useAuth()

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#0f1117' }}>
      {/* Global app header */}
      <nav
        className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0"
        style={{ backgroundColor: '#0f1117' }}
      >
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-slate-200 tracking-tight">
            Command Center
          </h1>
        </div>

        {/* User chip */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-xs text-slate-400 font-medium">{name}</span>
        </div>
      </nav>

      {/* Board takes all remaining height */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  )
}
