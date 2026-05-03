import type { DayAvailability, SlotInput } from '../../types/availability'
import { SlotCell } from './SlotCell'

interface DayColumnProps {
  day: DayAvailability | null   // null = no data yet for this date
  date: string                  // YYYY-MM-DD always present
  userRole: string
  onSlotChange: (
    date: string,
    slot: 'day' | 'evening' | 'night',
    status: 'offline' | 'available' | 'booked'
  ) => void
  loadingSlot: string | null    // "{date}-{slot}" key or null
}

export function DayColumn({ day, date, userRole, onSlotChange, loadingSlot }: DayColumnProps) {
  const [y, m, d] = date.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  const getSlotStatus = (slotKey: 'day' | 'evening' | 'night'): 'offline' | 'available' | 'booked' => {
    if (!day || !day.slots) return 'offline'
    const match = day.slots.find(s => s.slot === slotKey)
    if (!match) return 'offline'
    return match.status
  }

  const slots = ['day', 'evening', 'night'] as const

  return (
    <div className="flex flex-col items-center w-28 shrink-0">
      <div className="text-[10px] font-bold text-gray-400 mb-4 text-center h-8 flex flex-col items-center justify-center uppercase tracking-[0.2em] leading-none">
        <span className="mb-1">{formattedDate.includes(',') ? formattedDate.split(',')[0] : formattedDate}</span>
        <span className="text-gray-900 font-black">{formattedDate.includes(',') ? formattedDate.split(',')[1] : ''}</span>
      </div>
      
      <div className="flex flex-col gap-2 w-full">
        {slots.map(slot => {
          const isLocked = false // Removed hardcoded 'admin' day lock
          const isLoading = loadingSlot === `${date}-${slot}`
          const status = getSlotStatus(slot)

          return (
            <SlotCell
              key={slot}
              status={status}
              isLocked={isLocked}
              isLoading={isLoading}
              onChange={() => onSlotChange(date, slot, status)}
            />
          )
        })}
      </div>

    </div>
  )
}
