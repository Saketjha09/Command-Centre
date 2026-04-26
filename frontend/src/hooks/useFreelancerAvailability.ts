import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { getFreelancerAvailability, saveDay as apiSaveDay } from '../services/availabilityService';
import { 
  AvailabilityRecord, 
  AvailabilitySlot, 
  FreelancerDayState, 
  SlotState, 
  SlotInput 
} from '../types/availability';

/**
 * Hook to manage a freelancer's 14-day availability state.
 */
export function useFreelancerAvailability() {
  const { user } = useAuthContext();
  const [days, setDays] = useState<FreelancerDayState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Generate 14 date strings (today + 13 days)
  const dateStrings = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Initialize/Load state from API
  const loadAvailability = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const records = await getFreelancerAvailability(user.id, 14);
      
      const newDays: FreelancerDayState[] = dateStrings.map(date => {
        const dayRecords = records.filter(r => r.date === date);
        
        const slots: FreelancerDayState['slots'] = {
          night: createSlotState('night', dayRecords),
          day: createSlotState('day', dayRecords),
          evening: createSlotState('evening', dayRecords),
        };

        return {
          date,
          slots,
          isDirty: false,
          isSaving: false,
        };
      });

      setDays(newDays);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [user, dateStrings]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // 3. toggleSlot: Flip availability and update derived status
  const toggleSlot = useCallback((date: string, slotKey: AvailabilitySlot) => {
    setDays(prev => prev.map(day => {
      if (day.date !== date) return day;
      
      const slot = day.slots[slotKey];
      if (slot.isLocked) return day;

      const nextIsAvailable = !slot.is_available;
      return {
        ...day,
        isDirty: true,
        slots: {
          ...day.slots,
          [slotKey]: {
            ...slot,
            is_available: nextIsAvailable,
            status: nextIsAvailable ? 'available' : 'offline'
          }
        }
      };
    }));
  }, []);

  // 4. updateComment: Update text with 80-char limit
  const updateComment = useCallback((date: string, slotKey: AvailabilitySlot, comment: string) => {
    setDays(prev => prev.map(day => {
      if (day.date !== date) return day;

      const slot = day.slots[slotKey];
      if (slot.isLocked) return day;

      return {
        ...day,
        isDirty: true,
        slots: {
          ...day.slots,
          [slotKey]: {
            ...slot,
            comment: comment.slice(0, 80)
          }
        }
      };
    }));
  }, []);

  // 5. saveDay: PUT to backend and clear dirty flag
  const saveDay = useCallback(async (date: string) => {
    if (!user) return;
    let daySnapshot: FreelancerDayState | undefined;
    
    setDays(prev => {
      daySnapshot = prev.find(d => d.date === date);
      return prev.map(d => 
        d.date === date ? { ...d, isSaving: true } : d
      );
    });
    
    if (!daySnapshot) return;
    setError(null);
    
    const slotInputs: SlotInput[] = 
      (['night', 'day', 'evening'] as AvailabilitySlot[])
      .map(key => ({
        slot: key,
        is_available: daySnapshot!.slots[key].is_available,
        comment: daySnapshot!.slots[key].comment,
      }));
    
    try {
      await apiSaveDay(user.id, date, slotInputs);
      setDays(prev => prev.map(d => 
        d.date === date ? 
          { ...d, isDirty: false, isSaving: false } : d
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? 
        err.message : `Failed to save ${date}`);
      setDays(prev => prev.map(d => 
        d.date === date ? { ...d, isSaving: false } : d
      ));
    }
  }, [user]);

  return {
    days,
    loading,
    error,
    toggleSlot,
    updateComment,
    saveDay
  };
}

/**
 * Helper to build SlotState from DB records or defaults.
 */
function createSlotState(slotKey: AvailabilitySlot, records: AvailabilityRecord[]): SlotState {
  const record = records.find(r => r.slot === slotKey);
  if (!record) {
    return {
      is_available: false,
      comment: '',
      status: 'unknown',
      isLocked: false
    };
  }

  return {
    is_available: record.is_available,
    comment: record.comment,
    status: record.status,
    isLocked: record.status === 'booked'
  };
}
