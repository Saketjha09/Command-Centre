import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsers } from '../services/api';
import { AvailabilityGrid } from '../components/availability/AvailabilityGrid';

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
          <AvailabilityGrid userID={userID} userRole={role} />
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
