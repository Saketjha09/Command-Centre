import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchWeekAvailability, upsertAvailability, fetchTodayAvailability } from '../services/availabilityApi';
import { fetchUsers } from '../services/api';
import type { WeekAvailability, AvailabilityRecord, SlotInput } from '../types/availability';

const TIME_SLOTS = [
  { id: 'day', label: 'Day', time: '9 AM - 5 PM' },
  { id: 'evening', label: 'Evening', time: '5 PM - 9 PM' },
  { id: 'night', label: 'Night', time: '9 PM - 1 AM' },
] as const;

/**
 * Freelancer View: 7-day interactive grid (7 cols x 3 rows).
 * Clicking cells toggles availability. Comments handled via unified sidebar/modal if needed,
 * but here we focus on the core grid interaction.
 */
function FreelancerAvailability({ userID }: { userID: string }) {
  const [weekData, setWeekData] = useState<WeekAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
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
      // Save all days that were modified (or just all 7 for simplicity)
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

  if (loading) return <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-8 p-8 h-full overflow-y-auto custom-scrollbar bg-[#09090b]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-[#fafafa] tracking-tight">My Availability</h1>
          <p className="text-[#71717a] text-sm max-w-2xl leading-relaxed">
            Toggle your availability for the upcoming week. Click cells to switch between Busy and Ready.
          </p>
        </div>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#6366f1] disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 shrink-0"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : 'Save Weekly Plan'}
        </button>
      </div>

      {(error || success) && (
        <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
          error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <div className="flex items-center gap-3 text-sm font-medium">
            <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
            {error || success}
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-8 border-b border-[#27272a]">
          {/* Top Left Corner */}
          <div className="p-4 bg-[#18181b] border-r border-[#27272a] flex items-center justify-center">
             <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">Slots</span>
          </div>
          {/* Day Headers */}
          {weekData?.days.map(day => (
            <div key={day.date} className="p-4 flex flex-col items-center justify-center border-r border-[#27272a] last:border-r-0 bg-[#18181b]">
              <span className="text-[11px] font-bold text-[#fafafa] uppercase tracking-wider">
                {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="text-[10px] font-mono text-[#52525b] mt-0.5">{day.date.split('-').slice(1).join('/')}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {TIME_SLOTS.map(slotMeta => (
          <div key={slotMeta.id} className="grid grid-cols-8 border-b border-[#27272a] last:border-b-0">
            {/* Slot Label Column */}
            <div className="p-4 bg-[#18181b] border-r border-[#27272a] flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-[#fafafa] uppercase">{slotMeta.label}</span>
              <span className="text-[9px] text-[#52525b] font-medium mt-1 uppercase tracking-tighter">{slotMeta.time}</span>
            </div>

            {/* Availability Cells */}
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
                  className={`relative p-2 h-24 border-r border-[#27272a] last:border-r-0 cursor-pointer transition-all group overflow-hidden ${
                    slot.is_available 
                      ? 'bg-emerald-500/5 hover:bg-emerald-500/10' 
                      : 'bg-red-500/5 hover:bg-red-500/10'
                  }`}
                >
                  <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center gap-2 border transition-all duration-300 ${
                    slot.is_available 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400 opacity-60'
                  }`}>
                    {slot.is_available ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                       {slot.is_available ? 'Ready' : 'Busy'}
                    </span>
                  </div>

                  {/* Comment Indicator */}
                  {slot.comment && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                  )}

                  {/* Toggle Indicator on Hover */}
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                     <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-[#09090b] px-2 py-1 rounded-md border border-indigo-500/20">
                        Click to Toggle
                     </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 pt-4">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/30" />
            <span className="text-xs text-[#71717a] font-medium">Available</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-red-500/20 border border-red-500/30" />
            <span className="text-xs text-[#71717a] font-medium">Unavailable</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-xs text-[#71717a] font-medium">Has Comment</span>
         </div>
      </div>
    </div>
  );
}

/**
 * Admin View: Real-time team availability grid with today's focus and lookup.
 */
function AdminAvailabilityView() {
  const [todayRecords, setTodayRecords] = useState<AvailabilityRecord[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userWeek, setUserWeek] = useState<WeekAvailability | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);

  useEffect(() => {
    Promise.all([fetchTodayAvailability(), fetchUsers()])
      .then(([records, users]) => {
        setTodayRecords(records);
        setAllUsers(users.filter(u => u.role === 'freelancer'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLookup = async (userId: string) => {
    setSelectedUser(userId);
    setLoadingWeek(true);
    try {
      const data = await fetchWeekAvailability(userId, 7);
      setUserWeek(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWeek(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-[#09090b]"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-8 p-8 h-full overflow-y-auto custom-scrollbar bg-[#09090b]">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-[#fafafa] tracking-tight">Team Visibility</h1>
        <p className="text-[#71717a] text-sm max-w-2xl leading-relaxed">
          Real-time workload and availability status across all active freelancers.
        </p>
      </div>

      {/* Today's Grid */}
      <div className="flex flex-col gap-4">
        <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.2em]">Live Today</h2>
        <div className="grid gap-3">
          {allUsers.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-[#27272a] rounded-2xl">
               <p className="text-[#71717a] text-sm font-medium">No freelancers found in roster.</p>
            </div>
          ) : allUsers.map(user => {
            const userToday = todayRecords.filter(r => r.user_id === user.id);
            return (
              <div 
                key={user.id} 
                onClick={() => handleLookup(user.id)}
                className={`group flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                  selectedUser === user.id ? 'bg-[#4f46e5]/10 border-[#4f46e5]/30' : 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {user.avatar_url ? (
                       <img src={user.avatar_url} className="w-12 h-12 rounded-lg object-cover border border-[#27272a]" />
                    ) : (
                       <div className="w-12 h-12 rounded-lg bg-[#27272a] text-[#fafafa] flex items-center justify-center font-bold text-lg border border-[#3f3f46]">
                         {user.name[0]}
                       </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#18181b] ${userToday.some(r => r.is_available) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-[#3f3f46]'}`} />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#fafafa] tracking-tight group-hover:text-[#4f46e5] transition-colors">{user.name}</div>
                    <div className="text-[10px] text-[#71717a] font-bold tracking-widest uppercase mt-0.5">{user.id.slice(0,8)}</div>
                  </div>
                </div>

                <div className="flex gap-8">
                  {TIME_SLOTS.map(slotMeta => {
                    const record = userToday.find(r => r.slot === slotMeta.id);
                    const isAvail = record?.is_available ?? true; // Default to true if no record
                    return (
                      <div key={slotMeta.id} className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">{slotMeta.label}</span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isAvail ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {isAvail ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Week Lookup */}
      {selectedUser && (
        <div className="flex flex-col gap-6 pt-8 border-t border-[#27272a] animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.2em]">Weekly Planner: {allUsers.find(u=>u.id===selectedUser)?.name}</h2>
              <button onClick={() => setSelectedUser(null)} className="text-[#71717a] hover:text-[#fafafa] text-[10px] font-bold uppercase tracking-widest bg-[#18181b] border border-[#27272a] px-3 py-1.5 rounded-lg transition-all">Close View</button>
           </div>

           {loadingWeek ? (
              <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>
           ) : (
              <div className="grid md:grid-cols-4 lg:grid-cols-7 gap-3">
                 {userWeek?.days.map(day => (
                    <div key={day.date} className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                       <div className="text-center pb-3 border-b border-[#27272a]">
                          <div className="text-[11px] font-bold text-[#fafafa] uppercase tracking-widest">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                          <div className="text-[10px] text-[#71717a] font-mono mt-0.5 uppercase">{day.date.split('-').slice(1).join('/')}</div>
                       </div>
                       <div className="flex flex-col gap-3">
                          {TIME_SLOTS.map(slotMeta => {
                             const slot = day.slots.find(s => s.slot === slotMeta.id);
                             const isAvail = slot?.is_available ?? true;
                             return (
                                <div key={slotMeta.id} className="group relative">
                                   <div className={`w-full h-10 rounded-xl flex items-center justify-center transition-all ${
                                      isAvail ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'
                                   }`}>
                                      <span className="text-[9px] font-bold uppercase tracking-widest">{slotMeta.label}</span>
                                   </div>
                                   {slot?.comment && (
                                      <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full w-48 p-3 bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                                         <p className="text-[10px] text-[#a1a1aa] leading-relaxed italic">"{slot.comment}"</p>
                                         <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-[#09090b] border-r border-b border-[#27272a]" />
                                      </div>
                                   )}
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      )}
    </div>
  );
}

export default function AvailabilityPage() {
  const { role, id: userID } = useAuth();

  if (role === 'freelancer') {
    return <FreelancerAvailability userID={userID} />;
  }

  return <AdminAvailabilityView />;
}
