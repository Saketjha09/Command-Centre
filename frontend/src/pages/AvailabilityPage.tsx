import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { AvailabilityGrid } from '../components/availability/AvailabilityGrid'
import { TodayDashboard } from '../components/availability/TodayDashboard'

function AdminAvailabilityView() {
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null)
  const [inputVal, setInputVal] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputVal.trim()) {
      setSelectedUserID(inputVal.trim())
    } else {
      setSelectedUserID(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <TodayDashboard />

      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 shadow-xl max-w-4xl">
        <form onSubmit={handleSearch} className="mb-6 flex gap-3">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Enter user ID to view their week"
            className="flex-1 max-w-md bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
            required
          />
          <button 
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-600/30"
          >
            View Schedule
          </button>
        </form>

        {selectedUserID && (
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Week View: <span className="font-mono text-xs">{selectedUserID}</span>
            </h3>
            {/* Admin viewing freelancer gets freelancer role to unlock their day slot */}
            <AvailabilityGrid userID={selectedUserID} userRole="freelancer" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function AvailabilityPage() {
  const { role, id: userID } = useAuth()

  if (role === 'freelancer') {
    return (
      <div className="p-6 h-full overflow-y-auto w-full">
        <h1 className="text-xl font-bold text-slate-200 mb-6 tracking-tight">My Availability</h1>
        <AvailabilityGrid userID={userID} userRole={role} />
      </div>
    )
  }

  return <AdminAvailabilityView />
}
