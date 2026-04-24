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
          <h2 className={`font-bold text-gray-900 tracking-tight ${compact ? 'text-xl' : 'text-3xl'}`}>
            Weekly Planner
          </h2>
          <p className="text-gray-400 text-xs font-medium max-w-2xl leading-relaxed">
            Click cells to toggle your availability. Ready = Available, Busy = Unavailable.
          </p>
        </div>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95 shrink-0"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Save Weekly Plan
            </>
          )}
        </button>
      </div>

      {(error || success) && (
        <div className={`px-4 py-3 rounded-2xl border text-[11px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300 ${
          error ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
        }`}>
          <div className="flex items-center gap-3">
             <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
             {error || success}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 border-b border-gray-100">
            <div className="p-4 bg-gray-50/50 border-r border-gray-100 flex items-center justify-center">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Time Slots</span>
            </div>
            {weekData?.days.map(day => (
              <div key={day.date} className="p-4 flex flex-col items-center justify-center border-r border-gray-100 last:border-r-0 bg-gray-50/50">
                <span className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{day.date.split('-').slice(1).join('/')}</span>
              </div>
            ))}
          </div>

          {TIME_SLOTS.map(slotMeta => (
            <div key={slotMeta.id} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
              <div className="p-4 bg-gray-50/50 border-r border-gray-100 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">{slotMeta.label}</span>
                <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{slotMeta.time}</span>
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
                    className={`relative p-2 h-20 border-r border-gray-100 last:border-r-0 cursor-pointer transition-all group overflow-hidden ${
                      slot.is_available 
                        ? 'bg-emerald-50/5 hover:bg-emerald-50/20' 
                        : 'bg-red-50/5 hover:bg-red-50/20'
                    }`}
                  >
                    <div className={`w-full h-full rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all duration-300 ${
                      slot.is_available 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                        : 'bg-red-50 border-red-100 text-red-500 opacity-40'
                    }`}>
                      {slot.is_available ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                      )}
                      <span className="text-[9px] font-black uppercase tracking-widest">{slot.is_available ? 'READY' : 'BUSY'}</span>
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
