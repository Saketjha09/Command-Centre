interface TopBarProps {
  title: string
  wsStatus: 'connected' | 'connecting' | 'disconnected'
  onNewTask?: () => void
  onAddMember?: () => void
  onAddBrand?: () => void
}

export function TopBar({ title, wsStatus, onNewTask, onAddMember, onAddBrand }: TopBarProps) {
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  const statusDotClass =
    wsStatus === 'connected'
      ? 'bg-emerald-500'
      : wsStatus === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-rose-500'

  return (
    <header className="h-14 shrink-0 border-b border-gray-200 bg-white flex items-center px-6 gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-[14px] font-bold text-gray-900 tracking-tight">{title}</h1>
        <div className="w-px h-4 bg-gray-200 hidden sm:block"></div>
        <span className="text-[12px] text-gray-400 font-medium hidden sm:block">{dateLabel}</span>
      </div>

      <div className="flex-1" />

      <div className="hidden sm:flex items-center gap-3">
        {onAddMember && (
          <button
            onClick={onAddMember}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-white border border-gray-200 text-gray-700 text-[12px] font-bold transition-all active:scale-95 hover:bg-gray-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Add Freelancer
          </button>
        )}
        {onAddBrand && (
          <button
            onClick={onAddBrand}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-white border border-gray-200 text-gray-700 text-[12px] font-bold transition-all active:scale-95 hover:bg-gray-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            Add Brand
          </button>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-2 px-2.5 h-7 rounded-md bg-gray-50 border border-gray-200">
        <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{wsStatus}</span>
      </div>

      <button
        type="button"
        onClick={onNewTask}
        className="flex items-center gap-2 h-9 px-4 rounded-md bg-indigo-600 text-white text-[12px] font-bold transition-all active:scale-95 hover:bg-indigo-700 shadow-sm shadow-indigo-200"
      >
        <PlusIcon className="w-4 h-4" />
        New Task
      </button>
    </header>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
    </svg>
  )
}
