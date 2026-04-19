import type { DayAvailability, SlotInput } from '../../types/availability'
import { SlotCell } from './SlotCell'

interface DayColumnProps {
  day: DayAvailability | null   // null = no data yet for this date
  date: string                  // YYYY-MM-DD always present
  userRole: string
  onSlotChange: (
    date: string,
    slot: 'day' | 'evening' | 'night',
    value: boolean
  ) => void
  loadingSlot: string | null    // "{date}-{slot}" key or null
}

export function DayColumn({ day, date, userRole, onSlotChange, loadingSlot }: DayColumnProps) {
  // Try to parse reliably in local time without timezone shifts:
  const [y, m, d] = date.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  // Helper to find slot status
  const getSlotAvailable = (slotKey: 'day' | 'evening' | 'night') => {
    if (!day) return false
    const match = day.slots.find(s => s.slot === slotKey)
    return match ? match.is_available : false
  }

  const slots = ['day', 'evening', 'night'] as const

  return (
    <div className="flex flex-col items-center w-24 shrink-0">
      <div className="text-[11px] font-semibold text-slate-400 mb-3 text-center h-8 flex items-center uppercase tracking-widest whitespace-nowrap">
        {formattedDate}
      </div>
      {slots.map(slot => {
        // Business Rule: admin day locked
        const isLocked = userRole === 'admin' && slot === 'day'
        const isLoading = loadingSlot === `${date}-${slot}`
        const isAvailable = getSlotAvailable(slot)

        return (
          <SlotCell
            key={slot}
            slot={slot}
            isAvailable={isAvailable}
            isLocked={isLocked}
            isLoading={isLoading}
            onChange={(s, val) => onSlotChange(date, s, val)}
          />
        )
      })}
    </div>
  )
}
