import { useState, useEffect, useCallback } from 'react'
import type { WeekAvailability, SlotInput } from '../../types/availability'
import { fetchWeekAvailability, setAvailable, setOffline } from '../../services/availabilityApi'
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
        console.warn('Availability fetch warning:', err)
        if (active) {
          // If we get a 404 or empty response, it just means no schedule is set.
          // Render the blank grid gracefully instead of an error banner.
          if (err.message?.includes('404')) {
            setWeekData({ user_id: userID, days: [] })
          } else {
            setError(err instanceof Error ? err.message : 'Unknown error occurred')
          }
        }
      })
      
    return () => { active = false }
  }, [userID])

  const handleSlotChange = useCallback(async (date: string, slot: 'day' | 'evening' | 'night', status: 'offline' | 'available' | 'booked') => {
    if (status === 'booked') return

    const isCurrentlyAvailable = status === 'available'
    setLoadingSlot(`${date}-${slot}`)
    setError(null)

    // ── Optimistic Update ──────────────────────────────────────────────────
    const prevWeekData = weekData
    setWeekData(prev => {
      if (!prev) return prev
      const newDays = [...prev.days]
      const dayIdx = newDays.findIndex(d => d.date === date)
      
      const newStatus = !isCurrentlyAvailable ? 'available' : 'offline'
      const newSlotObj = { 
        id: 'temp-' + Date.now(), 
        user_id: userID, 
        date, 
        slot, 
        is_available: !isCurrentlyAvailable, 
        status: newStatus, 
        comment: '', 
        created_at: new Date().toISOString() 
      } as any

      if (dayIdx === -1) {
        newDays.push({
          date,
          user_id: userID,
          slots: [newSlotObj]
        })
      } else {
        const newSlots = [...newDays[dayIdx].slots]
        const slotIdx = newSlots.findIndex(s => s.slot === slot)
        if (slotIdx === -1) {
          newSlots.push(newSlotObj)
        } else {
          newSlots[slotIdx] = { ...newSlots[slotIdx], is_available: !isCurrentlyAvailable, status: newStatus }
        }
        newDays[dayIdx] = { ...newDays[dayIdx], slots: newSlots }
      }
      return { ...prev, days: newDays }
    })
    
    try {
      if (!isCurrentlyAvailable) {
        await setAvailable(date, slot)
      } else {
        await setOffline(date, slot)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability')
      setWeekData(prevWeekData) // Rollback
    } finally {
      setLoadingSlot(null)
    }
  }, [userID, weekData])

  return (
    <div className="flex flex-col w-full bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-red-600 text-[11px] font-black uppercase tracking-widest flex justify-between items-center animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error.includes('401') ? 'Session Expired: Please Log Out and Log In again to sync' : error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-red-800 transition-colors bg-white/50 w-5 h-5 rounded-full flex items-center justify-center border border-red-100 shadow-sm">✕</button>
        </div>
      )}
      
      <div className="flex p-8 overflow-x-auto custom-scrollbar">
        {/* Row labels */}
        <div className="flex flex-col justify-end w-32 shrink-0 pb-1">
          <div className="h-12 flex items-center justify-start text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 border-r border-gray-50 pr-4">Day</div>
          <div className="h-12 flex items-center justify-start text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 border-r border-gray-50 pr-4">Evening</div>
          <div className="h-12 flex items-center justify-start text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] border-r border-gray-50 pr-4">Night</div>
        </div>

        {/* Days Grid */}
        <div className="flex gap-4 min-w-0">
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

      {/* Grid Legend */}
      <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white border border-gray-200" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Offline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-500" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-500" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Booked (Active Task)</span>
        </div>
      </div>
    </div>
  )
}
