import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsers } from '../services/api';
import { AvailabilityGrid } from '../components/availability/AvailabilityGrid';
import { fetchWeekAvailability, upsertAvailability } from '../services/availabilityApi';
import type { WeekAvailability } from '../types/availability';

const TIME_SLOTS = [
  { id: 'day', label: 'Day', time: '9 AM - 5 PM' },
  { id: 'evening', label: 'Evening', time: '5 PM - 9 PM' },
  { id: 'night', label: 'Night', time: '9 PM - 1 AM' },
] as const;

function FreelancerAvailability({ userID }: { userID: string }) {
  const [userWeek, setUserWeek] = useState<WeekAvailability | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [editedSlots, setEditedSlots] = useState<Record<string, Record<string, boolean>>>({});
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoadingWeek(true);
    try {
      const data = await fetchWeekAvailability(userID, 7);
      setUserWeek(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWeek(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userID]);

  const handleSlotClick = (date: string, slotId: string, currentAvail: boolean) => {
    setEditedSlots(prev => {
      const dayEdits = prev[date] || {};
      const newAvail = dayEdits[slotId] !== undefined ? !dayEdits[slotId] : !currentAvail;
      return { ...prev, [date]: { ...dayEdits, [slotId]: newAvail } };
    });
    setSuccessMsg('');
  };

  const handleSaveSlots = async () => {
    setIsSavingSlots(true);
    setSuccessMsg('');
    try {
      for (const [date, slotsObj] of Object.entries(editedSlots)) {
        const slotsArray = Object.entries(slotsObj).map(([slotId, isAvail]) => ({
          slot: slotId,
          is_available: isAvail
        }));
        if (slotsArray.length > 0) {
          await upsertAvailability(userID, date, slotsArray);
        }
      }
      await loadData();
      setEditedSlots({});
      setSuccessMsg('Availability successfully updated.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSlots(false);
    }
  };

  if (loadingWeek) {
    return <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid md:grid-cols-4 lg:grid-cols-7 gap-4 overflow-x-auto">
        {userWeek?.days.map(day => (
          <div key={day.date} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
            <div className="text-center pb-3 border-b border-gray-50">
              <div className="text-[12px] font-bold text-gray-900 uppercase tracking-widest">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{day.date.split('-').slice(1).join('/')}</div>
            </div>
            <div className="flex flex-col gap-2">
              {TIME_SLOTS.map(slotMeta => {
                const slot = day.slots.find(s => s.slot === slotMeta.id);
                const originalAvail = slot?.is_available ?? true;
                const isEdited = editedSlots[day.date]?.[slotMeta.id];
                const isAvail = isEdited !== undefined ? isEdited : originalAvail;

                return (
                  <div 
                    key={slotMeta.id} 
                    className="group relative cursor-pointer"
                    onClick={() => handleSlotClick(day.date, slotMeta.id, originalAvail)}
                  >
                    <div className={`w-full h-10 rounded-lg flex items-center justify-center transition-all border ${
                      isAvail ? 'bg-green-50/50 text-green-600 border-green-100 hover:bg-green-100/50' : 'bg-red-50/50 text-red-500 border-red-100 hover:bg-red-100/50'
                    }`}>
                      <span className="text-[9px] font-bold uppercase tracking-widest">{slotMeta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {(Object.keys(editedSlots).length > 0 || successMsg) && (
        <div className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="text-[13px] font-bold text-green-600">{successMsg}</div>
          {Object.keys(editedSlots).length > 0 && (
            <button 
              onClick={handleSaveSlots}
              disabled={isSavingSlots}
              className="px-6 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              {isSavingSlots ? <LoadingSpinner size="sm" /> : null}
              Save Changes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AvailabilityPage() {
  const { role, id: userID } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(role !== 'freelancer');

  useEffect(() => {
    if (role !== 'freelancer') {
      fetchUsers()
        .then(u => setUsers(u.filter((user: any) => user.role === 'freelancer')))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [role]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (role === 'freelancer') {
    return (
      <div className="flex flex-col gap-10 p-10 h-full overflow-y-auto custom-scrollbar bg-gray-50/20">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Availability</h1>
          <p className="text-gray-400 text-[13px] font-bold uppercase tracking-widest leading-relaxed">
            Operational Schedule for the Next 7 Days
          </p>
        </div>
        <div className="max-w-4xl">
          <FreelancerAvailability userID={userID} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-10 h-full overflow-y-auto custom-scrollbar bg-gray-50/20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Team Visibility</h1>
        <p className="text-gray-400 text-[13px] font-bold uppercase tracking-widest leading-relaxed">
          Real-time roster status across all active freelancers.
        </p>
      </div>

      <div className="flex flex-col gap-12">
        {users.map(user => (
          <div key={user.id} className="flex flex-col gap-6">
            <div className="flex items-center gap-4 px-2">
              <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center font-black text-gray-900 shadow-sm uppercase">
                {user.name[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-black text-gray-900 tracking-tight">{user.name}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active Roster</span>
              </div>
            </div>
            <div className="max-w-4xl">
              <AvailabilityGrid userID={user.id} userRole={role} />
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="p-20 text-center border-2 border-dashed border-gray-200 rounded-[40px] bg-white">
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No active freelancers found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
