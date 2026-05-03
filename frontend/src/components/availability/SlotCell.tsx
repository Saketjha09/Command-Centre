interface SlotCellProps {
  status: 'offline' | 'available' | 'booked'
  isLoading: boolean
  isLocked: boolean // for class hours override
  onChange: () => void
}

export function SlotCell({ status, isLoading, isLocked, onChange }: SlotCellProps) {
  if (isLocked) {
    return (
      <div 
        className="w-full h-12 min-w-[48px] rounded-lg flex items-center justify-center bg-gray-50 border border-gray-100 mb-2 cursor-not-allowed opacity-60" 
        title="Slot Locked"
      >
        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm6 11V12H9v6h6z" />
        </svg>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full h-12 min-w-[48px] rounded-lg flex items-center justify-center bg-gray-50 animate-pulse mb-2 border border-gray-100" />
    )
  }

  if (status === 'booked') {
    return (
      <div 
        className="w-full h-12 min-w-[48px] rounded-lg flex items-center justify-center bg-indigo-100 border border-indigo-500 mb-2 shadow-sm cursor-not-allowed"
        title="Booked: User has active tasks assigned"
      >
        <svg className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  const isAvailable = status === 'available'

  return (
    <button
      type="button"
      className={`w-full h-12 min-w-[48px] rounded-lg flex items-center justify-center mb-2 transition-all duration-150 active:scale-95 border group relative cursor-pointer ${
        isAvailable 
          ? 'bg-emerald-100 border-emerald-500 text-emerald-700 shadow-sm' 
          : 'bg-white border-gray-200 text-gray-300 hover:border-gray-300'
      }`}
      onClick={onChange}
    >
      {isAvailable ? (
        <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )}
    </button>
  )
}
