interface SlotCellProps {
  slot: 'day' | 'evening' | 'night'
  isAvailable: boolean
  isLocked: boolean      // true for admin role + day slot
  isLoading: boolean
  onChange: (slot: 'day' | 'evening' | 'night', value: boolean) => void
}

export function SlotCell({ slot, isAvailable, isLocked, isLoading, onChange }: SlotCellProps) {
  if (isLocked) {
    return (
      <div 
        className="w-full h-12 rounded-lg flex items-center justify-center bg-gray-800 text-gray-600 mb-2 cursor-not-allowed shadow-inner" 
        title="Blocked: class hours 10AM–3PM"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full h-12 rounded-lg flex items-center justify-center bg-white/5 mb-2 border border-white/5 shadow-inner">
        <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const bgColor = isAvailable ? 'bg-green-900 border-green-700/50 hover:bg-green-800' : 'bg-red-900 border-red-700/50 hover:bg-red-800'
  const textColor = isAvailable ? 'text-green-300' : 'text-red-300'

  return (
    <button
      type="button"
      className={`w-full h-12 rounded-lg flex items-center justify-center mb-2 border shadow-lg transition-all duration-150 active:scale-95 ${bgColor} ${textColor}`}
      onClick={() => onChange(slot, !isAvailable)}
      aria-label={`Toggle ${slot} availability`}
    >
      {isAvailable ? (
        <svg className="w-5 h-5 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </button>
  )
}
