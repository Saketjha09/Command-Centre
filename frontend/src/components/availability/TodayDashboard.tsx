import { useEffect, useState } from 'react'
import type { AvailabilityRecord } from '../../types/availability'
import { fetchTodayAvailability } from '../../services/availabilityApi'

export function TodayDashboard() {
  const [records, setRecords] = useState<AvailabilityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchTodayAvailability()
      .then(data => {
        if (active) setRecords(data)
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load today dashboard')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  // Group by user_id
  const byUser = records.reduce<Record<string, Record<string, boolean>>>((acc, rec) => {
    if (!acc[rec.user_id]) acc[rec.user_id] = {}
    acc[rec.user_id][rec.slot] = rec.is_available
    return acc
  }, {})

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden shadow-xl max-w-4xl">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-sm font-semibold text-slate-200 tracking-tight">Today's Availability — {formattedDate}</h2>
      </div>
      
      {error && (
        <div className="m-4 px-4 py-3 text-sm text-red-300 bg-red-950/50 rounded-lg border border-red-800/50">{error}</div>
      )}

      {loading ? (
        <div className="p-4 space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-10 bg-white/5 animate-pulse rounded-lg border border-white/5" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-[10px] uppercase font-semibold tracking-widest bg-white/[0.02] text-slate-500 border-b border-white/5">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3 text-center">Day</th>
                <th className="px-5 py-3 text-center">Evening</th>
                <th className="px-5 py-3 text-center">Night</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(byUser).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-xs italic">
                    No availability submitted yet for today.
                  </td>
                </tr>
              ) : (
                Object.entries(byUser).map(([userId, slots]) => (
                  <tr key={userId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-b-0">
                    <td className="px-5 py-3.5 font-medium text-slate-300 font-mono text-xs truncate max-w-[150px]">{userId}</td>
                    {(['day', 'evening', 'night'] as const).map(slot => (
                      <td key={slot} className="px-5 py-3.5 text-center">
                        {slots[slot] === true ? (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Available" />
                        ) : slots[slot] === false ? (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Unavailable" />
                        ) : (
                          <span className="inline-block text-slate-600 font-bold" title="No record">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
