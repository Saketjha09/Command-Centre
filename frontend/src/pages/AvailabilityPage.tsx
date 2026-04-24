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

  if (loading) return <div className="h-full flex items-center justify-center bg-white"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-10 p-10 h-full overflow-y-auto custom-scrollbar bg-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Availability</h1>
          <p className="text-gray-400 text-[13px] font-medium max-w-2xl leading-relaxed">
            Toggle your availability for the upcoming week. Click cells to switch between Busy and Ready.
          </p>
        </div>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[13px] font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95 shrink-0"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : 'Save Weekly Plan'}
        </button>
      </div>

      {(error || success) && (
        <div className={`p-4 rounded-xl border fade-in ${
          error ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-600'
        }`}>
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest">
            <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'}`} />
            {error || success}
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-8 border-b border-gray-100">
          <div className="p-5 bg-gray-50/50 border-r border-gray-100 flex items-center justify-center">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Slots</span>
          </div>
          {weekData?.days.map(day => (
            <div key={day.date} className="p-5 flex flex-col items-center justify-center border-r border-gray-100 last:border-r-0 bg-gray-50/50">
              <span className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">
                {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{day.date.split('-').slice(1).join('/')}</span>
            </div>
          ))}
        </div>

        {TIME_SLOTS.map(slotMeta => (
          <div key={slotMeta.id} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
            <div className="p-5 bg-gray-50/50 border-r border-gray-100 flex flex-col items-center justify-center text-center">
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
                  className={`relative p-2.5 h-28 border-r border-gray-100 last:border-r-0 cursor-pointer transition-all group overflow-hidden ${
                    slot.is_available 
                      ? 'bg-green-50/10 hover:bg-green-50/30' 
                      : 'bg-red-50/10 hover:bg-red-50/30'
                  }`}
                >
                  <div className={`w-full h-full rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all duration-300 ${
                    slot.is_available 
                      ? 'bg-green-50 border-green-100 text-green-600' 
                      : 'bg-red-50 border-red-100 text-red-500 opacity-50'
                  }`}>
                    {slot.is_available ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                       {slot.is_available ? 'Ready' : 'Busy'}
                    </span>
                  </div>

                  {slot.comment && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600 shadow-sm" />
                  )}

                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                     <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-white px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                        Toggle
                     </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-10">
         <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-green-50 border border-green-100" />
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Available</span>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-red-50 border border-red-100" />
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Unavailable</span>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-600" />
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Modified / Comment</span>
         </div>
      </div>
    </div>
  );
}

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
    } catch (err) { console.error(err); }
    finally { setLoadingWeek(false); }
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-white"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-10 p-10 h-full overflow-y-auto custom-scrollbar bg-white">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Team Visibility</h1>
        <p className="text-gray-400 text-[13px] font-medium max-w-2xl leading-relaxed">
          Real-time workload and availability status across all active freelancers.
        </p>
      </div>

      {/* Today's Grid */}
      <div className="flex flex-col gap-5">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Live Today</h2>
        <div className="grid gap-4">
          {allUsers.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-100 rounded-3xl">
               <p className="text-gray-400 text-sm font-medium">No freelancers found in roster.</p>
            </div>
          ) : allUsers.map(user => {
            const userToday = todayRecords.filter(r => r.user_id === user.id);
            const isAnyAvail = userToday.some(r => r.is_available);
            return (
              <div 
                key={user.id} 
                onClick={() => handleLookup(user.id)}
                className={`group flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer shadow-sm ${
                  selectedUser === user.id ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center font-bold text-gray-700 text-lg">
                      {user.name[0]}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isAnyAvail ? 'bg-green-500' : 'bg-gray-200'}`} />
                  </div>
                  <div>
                    <div className="text-[16px] font-bold text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors">{user.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Freelancer</div>
                  </div>
                </div>

                <div className="flex gap-10">
                  {TIME_SLOTS.map(slotMeta => {
                    const record = userToday.find(r => r.slot === slotMeta.id);
                    const isAvail = record?.is_available ?? true;
                    return (
                      <div key={slotMeta.id} className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{slotMeta.label}</span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                          isAvail ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'
                        }`}>
                          {isAvail ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
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
        <div className="flex flex-col gap-8 pt-10 border-t border-gray-100 fade-in">
           <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Weekly Planner</h2>
                <span className="text-lg font-bold text-gray-900">{allUsers.find(u=>u.id===selectedUser)?.name}</span>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-900 text-[11px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-xl transition-all">Close Viewer</button>
           </div>

           {loadingWeek ? (
              <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>
           ) : (
              <div className="grid md:grid-cols-4 lg:grid-cols-7 gap-4">
                 {userWeek?.days.map(day => (
                    <div key={day.date} className="bg-white border border-gray-200 rounded-3xl p-5 flex flex-col gap-5 shadow-sm">
                       <div className="text-center pb-4 border-b border-gray-50">
                          <div className="text-[12px] font-bold text-gray-900 uppercase tracking-widest">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                          <div className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{day.date.split('-').slice(1).join('/')}</div>
                       </div>
                       <div className="flex flex-col gap-3">
                          {TIME_SLOTS.map(slotMeta => {
                             const slot = day.slots.find(s => s.slot === slotMeta.id);
                             const isAvail = slot?.is_available ?? true;
                             return (
                                <div key={slotMeta.id} className="group relative">
                                   <div className={`w-full h-11 rounded-xl flex items-center justify-center transition-all border ${
                                      isAvail ? 'bg-green-50/50 text-green-600 border-green-100' : 'bg-red-50/50 text-red-500 border-red-100'
                                   }`}>
                                      <span className="text-[10px] font-bold uppercase tracking-widest">{slotMeta.label}</span>
                                   </div>
                                   {slot?.comment && (
                                      <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full w-56 p-4 bg-white border border-gray-200 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                                         <p className="text-[11px] text-gray-600 leading-relaxed font-medium">"{slot.comment}"</p>
                                         <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-white border-r border-b border-gray-200" />
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
  if (role === 'freelancer') return <FreelancerAvailability userID={userID} />;
  return <AdminAvailabilityView />;
}
