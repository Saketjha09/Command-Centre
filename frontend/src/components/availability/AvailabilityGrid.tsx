import { useState, useEffect, useCallback } from 'react'
import type { WeekAvailability, SlotInput } from '../../types/availability'
import { fetchWeekAvailability, upsertAvailability } from '../../services/availabilityApi'
import { DayColumn } from './DayColumn'

interface AvailabilityGridProps {
  userID: string
  userRole: string
}

function getNext7Days(): string[] {
  const dates = []
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    // format to local YYYY-MM-DD
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${year}-${month}-${day}`)
  }
  return dates
}

export function AvailabilityGrid({ userID, userRole }: AvailabilityGridProps) {
  const [weekData, setWeekData] = useState<WeekAvailability | null>(null)
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const dates = getNext7Days()
  
  useEffect(() => {
    let active = true
    setError(null)
    setWeekData(null) // Reset while fetching for UX
    
    fetchWeekAvailability(userID, 7)
      .then(data => {
        if (active) setWeekData(data)
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Unknown error occurred')
      })
      
    return () => { active = false }
  }, [userID])

  const handleSlotChange = useCallback(async (date: string, slot: 'day' | 'evening' | 'night', value: boolean) => {
    setLoadingSlot(`${date}-${slot}`)
    setError(null)
    
    try {
      const inputs: SlotInput[] = [{ slot, is_available: value }]
      const updatedDay = await upsertAvailability(userID, date, inputs)
      
      setWeekData(prev => {
        if (!prev) return { user_id: userID, days: [updatedDay] }
        
        const newDays = [...prev.days]
        const existingDayIndex = newDays.findIndex(d => d.date === date)
        if (existingDayIndex >= 0) {
          newDays[existingDayIndex] = updatedDay
        } else {
          newDays.push(updatedDay)
        }
        return { ...prev, days: newDays }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability')
    } finally {
      setLoadingSlot(null)
    }
  }, [userID])

  return (
    <div className="flex flex-col w-full max-w-[800px]">
      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-sm flex justify-between items-center shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      
      <div className="flex bg-[#1a1d27] rounded-xl border border-white/5 p-5 overflow-x-auto gap-4 shadow-xl">
        {/* Row labels */}
        <div className="flex flex-col justify-end w-20 shrink-0 pb-1">
          <div className="h-12 flex items-center justify-end pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Day</div>
          <div className="h-12 flex items-center justify-end pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Evening</div>
          <div className="h-12 flex items-center justify-end pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Night</div>
        </div>

        {dates.map(dateStr => {
          const dayData = weekData?.days.find(d => d.date === dateStr) || null
          return (
            <DayColumn
              key={dateStr}
              date={dateStr}
              day={dayData}
              userRole={userRole}
              onSlotChange={handleSlotChange}
              loadingSlot={loadingSlot}
            />
          )
        })}
      </div>
    </div>
  )
}
