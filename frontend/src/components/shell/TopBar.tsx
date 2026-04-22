interface TopBarProps {
  title: string
  wsStatus: 'connected' | 'connecting' | 'disconnected'
  onNewTask?: () => void
}

export function TopBar({ title, wsStatus, onNewTask }: TopBarProps) {
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  const statusDotClass =
    wsStatus === 'connected'
      ? 'bg-emerald-400 pulse-live'
      : wsStatus === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-rose-500'

  return (
    <header className="h-14 shrink-0 border-b border-[#27272a] bg-[#18181b]/95 backdrop-blur-md flex items-center px-6 gap-4 sticky top-0 z-20">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[14px] font-bold text-[#fafafa] tracking-tight">{title}</h1>
        <span className="text-[10px] text-[#71717a] font-mono">{dateLabel}</span>
      </div>

      <button
        type="button"
        onClick={() => {
           window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))
        }}
        className="ml-8 flex items-center gap-2.5 px-3 h-8 w-[280px] rounded-lg bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] hover:bg-[#18181b] transition-all text-[12px] text-[#71717a]"
      >
        <SearchIcon className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <span className="kbd !bg-[#27272a] !border-[#3f3f46] !text-[#a1a1aa]">⌘K</span>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2 px-3 h-7 rounded-lg bg-[#09090b] border border-[#27272a]">
        <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#71717a]">{wsStatus}</span>
      </div>

      <button
        type="button"
        className="relative w-8 h-8 rounded-lg border border-[#27272a] bg-[#09090b] hover:bg-[#18181b] flex items-center justify-center text-[#71717a] hover:text-[#fafafa] transition-all"
      >
        <BellIcon className="w-4 h-4" />
        <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#4f46e5] text-[9px] font-bold text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
          3
        </span>
      </button>

      <button
        type="button"
        onClick={onNewTask}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#4f46e5] hover:bg-[#6366f1] text-white text-[12px] font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        New task
        <span className="kbd ml-1 !bg-white/10 !border-white/10 !text-white/70">N</span>
      </button>
    </header>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A7 7 0 0119 11V8a7 7 0 10-14 0v3a7 7 0 01-.6 4.6L3 17h5m7 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
    </svg>
  )
}
