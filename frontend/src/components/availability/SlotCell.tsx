interface SlotCellProps {
  slot: 'day' | 'evening' | 'night'
  isAvailable: boolean
  isLocked: boolean
  isLoading: boolean
  onChange: (slot: 'day' | 'evening' | 'night', value: boolean) => void
}

export function SlotCell({ slot, isAvailable, isLocked, isLoading, onChange }: SlotCellProps) {
  if (isLocked) {
    return (
      <div 
        className="w-full h-12 min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center bg-[#1c2128] border border-ink-600 mb-2 cursor-not-allowed" 
        title="Blocked: class hours 10AM–3PM"
      >
        <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm6 11V12H9v6h6z" />
        </svg>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full h-12 min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center bg-[#21262d] animate-pulse mb-2" />
    )
  }

  const bgColor = isAvailable 
    ? 'bg-emerald-900/40 border border-emerald-700/50 hover:bg-emerald-900/60' 
    : 'bg-red-900/40 border border-red-700/50 hover:bg-red-900/60'
  const textColor = isAvailable ? 'text-emerald-400' : 'text-red-400'

  return (
    <button
      type="button"
      className={`w-full h-12 min-w-[48px] min-h-[48px] rounded-lg flex items-center justify-center mb-2 transition-all duration-150 active:scale-95 ${bgColor} ${textColor}`}
      onClick={() => onChange(slot, !isAvailable)}
      aria-label={`Toggle ${slot} availability`}
    >
      {isAvailable ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </button>
  )
}
