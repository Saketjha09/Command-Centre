import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '../LoadingSpinner';
import { fetchWeekAvailability, upsertAvailability } from '../../services/availabilityApi';
import type { WeekAvailability, SlotInput } from '../../types/availability';

const TIME_SLOTS = [
  { id: 'day', label: 'Day', time: '10 AM - 3 PM' },
  { id: 'evening', label: 'Evening', time: '5 PM - 9 PM' },
  { id: 'night', label: 'Night', time: '9 PM - 1 AM' },
] as const;

interface FreelancerAvailabilityProps {
  userID: string;
  compact?: boolean;
}

export function FreelancerAvailability({ userID, compact = false }: FreelancerAvailabilityProps) {
  const [weekData, setWeekData] = useState<WeekAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWeekAvailability(userID, 7);
      setWeekData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userID]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSlot = (date: string, slotId: string) => {
    if (!weekData) return;
    setWeekData({
      ...weekData,
      days: weekData.days.map(day => {
        if (day.date !== date) return day;
        return {
          ...day,
          slots: day.slots.map(slot => {
            if (slot.slot !== slotId) return slot;
            return { ...slot, is_available: !slot.is_available };
          })
        };
      })
    });
  };

  const handleSaveAll = async () => {
    if (!weekData) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await Promise.all(weekData.days.map(day => {
        const slots: SlotInput[] = day.slots.map(s => ({
          slot: s.slot as 'day' | 'evening' | 'night',
          is_available: s.is_available,
          comment: s.comment
        }));
        return upsertAvailability(userID, day.date, slots);
      }));
      setSuccess('All changes saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <LoadingSpinner size="lg" />
    </div>
  );

  return (
    <div className={`flex flex-col gap-6 ${compact ? '' : 'p-2'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className={`font-bold text-[#fafafa] tracking-tight ${compact ? 'text-xl' : 'text-3xl'}`}>
            Weekly Planner
          </h2>
          <p className="text-[#71717a] text-xs max-w-2xl leading-relaxed">
            Click cells to toggle your availability. Ready = Available, Busy = Unavailable.
          </p>
        </div>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#4f46e5] hover:bg-[#6366f1] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 shrink-0"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : 'Save Plan'}
        </button>
      </div>

      {(error || success) && (
        <div className={`px-4 py-2.5 rounded-xl border text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
          error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {error || success}
        </div>
      )}

      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 border-b border-[#27272a]">
            <div className="p-3 bg-[#18181b] border-r border-[#27272a] flex items-center justify-center">
               <span className="text-[9px] font-bold text-[#52525b] uppercase tracking-widest">Time</span>
            </div>
            {weekData?.days.map(day => (
              <div key={day.date} className="p-3 flex flex-col items-center justify-center border-r border-[#27272a] last:border-r-0 bg-[#18181b]">
                <span className="text-[10px] font-bold text-[#fafafa] uppercase tracking-wider">
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className="text-[9px] font-mono text-[#52525b] mt-0.5">{day.date.split('-').slice(1).join('/')}</span>
              </div>
            ))}
          </div>

          {TIME_SLOTS.map(slotMeta => (
            <div key={slotMeta.id} className="grid grid-cols-8 border-b border-[#27272a] last:border-b-0">
              <div className="p-3 bg-[#18181b] border-r border-[#27272a] flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-[#fafafa] uppercase">{slotMeta.label}</span>
                <span className="text-[8px] text-[#52525b] font-medium mt-0.5 uppercase tracking-tighter">{slotMeta.time}</span>
              </div>

              {weekData?.days.map(day => {
                const slot = day.slots.find(s => s.slot === slotMeta.id) || {
                  slot: slotMeta.id,
                  is_available: true,
                  comment: ''
                };
                return (
                  <div 
                    key={`${day.date}-${slotMeta.id}`} 
                    onClick={() => toggleSlot(day.date, slotMeta.id)}
                    className={`relative p-1.5 h-16 border-r border-[#27272a] last:border-r-0 cursor-pointer transition-all group overflow-hidden ${
                      slot.is_available 
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10' 
                        : 'bg-red-500/5 hover:bg-red-500/10'
                    }`}
                  >
                    <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center gap-1 border transition-all duration-300 ${
                      slot.is_available 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                        : 'bg-red-500/10 border-red-500/20 text-red-400 opacity-60'
                    }`}>
                      {slot.is_available ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
