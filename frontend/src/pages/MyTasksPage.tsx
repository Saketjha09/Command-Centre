import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchTasks } from '../services/api';
import { fetchTodayAvailability } from '../services/availabilityApi';
import type { TaskSummary } from '../types/task';
import type { AvailabilityRecord } from '../types/availability';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FreelancerAvailability } from '../components/availability/FreelancerAvailability';

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  brief_pending: { label: 'Brief Pending', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  review: { label: 'Review', color: 'bg-orange-50 text-orange-600 border-orange-100' },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-600 border-green-100' },
  paid: { label: 'Paid', color: 'bg-purple-50 text-purple-600 border-purple-100' },
};

interface Props {
  onNavigate: (view: string) => void
}

export function MyTasksPage({ onNavigate }: Props) {
  const { id: userID, name: userName } = useAuth();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [myTasks, todayAvail] = await Promise.all([
        fetchTasks(),
        fetchTodayAvailability()
      ]);
      setTasks(myTasks);
      setAvailability(todayAvail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status === 'in_progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const completed = tasks.filter(t => t.status === 'approved' || t.status === 'paid').length;
    return { active, review, completed };
  }, [tasks]);

  const activeMissions = tasks.filter(t => !['approved', 'paid'].includes(t.status));

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-white">
      {/* Premium Header */}
      <section className="p-10 pb-16 border-b border-gray-100 bg-gray-50/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col gap-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 mb-2">
                 <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-widest">Operator Console</span>
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Online</span>
              </div>
              <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-none">
                Welcome back, <span className="text-indigo-600">{userName.split(' ')[0]}</span>
              </h1>
              <p className="text-gray-400 text-[15px] font-medium max-w-xl leading-relaxed mt-2">
                You have <span className="text-gray-900 font-bold">{stats.active} active missions</span> and {stats.review} items awaiting approval.
              </p>
            </div>
            
            <button 
              onClick={loadData}
              className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-indigo-600 hover:text-indigo-600 transition-all active:scale-95"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest">Refresh Intelligence</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="bg-white border border-gray-200 rounded-[32px] p-8 shadow-sm flex flex-col gap-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                   <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.active}</div>
                   <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">Active Missions</div>
                </div>
             </div>
             <div className="bg-white border border-gray-200 rounded-[32px] p-8 shadow-sm flex flex-col gap-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                   <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.review}</div>
                   <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">Pending Review</div>
                </div>
             </div>
             <div className="bg-white border border-gray-200 rounded-[32px] p-8 shadow-sm flex flex-col gap-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group border-b-4 border-b-emerald-500">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                   <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.completed}</div>
                   <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">Total Deployed</div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Active Missions List */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
               <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-3">
                 <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                 Active Objectives
               </h3>
               <button 
                  onClick={() => onNavigate('board')}
                  className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-2 transition-all group"
               >
                  Tactical Board
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
               </button>
            </div>

            {isLoading && tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-gray-50/30 rounded-[40px] border-2 border-dashed border-gray-100 gap-4">
                <LoadingSpinner size="lg" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Scanning Roster...</span>
              </div>
            ) : error ? (
              <div className="p-8 rounded-[32px] bg-red-50 border border-red-100 text-red-600 text-[12px] font-black uppercase tracking-widest flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-200" />
                {error}
              </div>
            ) : activeMissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center bg-gray-50/30 rounded-[40px] border-2 border-dashed border-gray-100 group">
                <div className="w-24 h-24 rounded-[32px] bg-white border border-gray-100 flex items-center justify-center mb-8 shadow-sm group-hover:scale-105 transition-transform duration-500">
                  <svg className="w-12 h-12 text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-[22px] font-black text-gray-900 mb-3 tracking-tight">Zero Pending Tasks</h4>
                <p className="text-gray-400 text-[14px] font-medium max-w-xs leading-relaxed">System scan complete. You're currently ahead of all deadlines.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {activeMissions.map(task => {
                  const status = STATUS_DISPLAY[task.status] || { label: task.status, color: 'bg-gray-100 text-gray-500 border-gray-200' };
                  const deadline = task.deadline ? new Date(task.deadline) : null;
                  const isOverdue = deadline && deadline < new Date() && task.status !== 'approved';
                  const brandColor = task.brand === 'master_app' ? '#4f46e5' : task.brand === 'supernova_ai' ? '#10b981' : '#6b7280';

                  return (
                    <div
                      key={task.id}
                      onClick={() => onNavigate('board')}
                      className="group bg-white rounded-[32px] border border-gray-200 p-8 hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex items-center gap-8 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: brandColor }} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            {task.brand.replace('_', ' ')}
                          </span>
                          <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <h4 className="text-[20px] font-black text-gray-900 truncate group-hover:text-indigo-600 transition-colors tracking-tight">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-4 mt-4">
                           <div className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{task.content_type || 'General'}</span>
                           </div>
                           <div className="w-1 h-1 rounded-full bg-gray-200" />
                           <span className="text-[10px] font-bold text-gray-300 font-mono tracking-tighter uppercase">ID: {task.id.slice(0, 8)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-2xl border ${
                          isOverdue ? 'bg-red-50 border-red-100 text-red-500 animate-pulse' : 'bg-gray-50 border-gray-100 text-gray-500'
                        }`}>
                           {deadline ? (
                             isOverdue ? 'CRITICAL / OVERDUE' : `DUE ${deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}`
                           ) : 'OPEN DEADLINE'}
                        </span>
                      </div>

                      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Health & Live Status */}
          <div className="flex flex-col gap-10">
             {/* Planner Section */}
             <div className="bg-gray-50/50 border border-gray-100 rounded-[40px] p-10 flex flex-col gap-8 shadow-sm">
                <div className="flex flex-col gap-2">
                   <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-[0.2em]">Operational Status</h3>
                   <p className="text-[12px] font-medium text-gray-400 leading-relaxed">Configure your availability for upcoming missions.</p>
                </div>
                <FreelancerAvailability userID={userID} compact />
                <button 
                  onClick={() => onNavigate('availability')}
                  className="w-full py-4 rounded-2xl bg-white border border-gray-200 text-[11px] font-black text-gray-900 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm active:scale-[0.98] mt-2"
                >
                   Full Schedule View
                </button>
             </div>

             {/* Live Network Section */}
             <div className="bg-white border border-gray-200 rounded-[40px] p-10 flex flex-col gap-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-[0.2em]">Live Network</h3>
                  <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-600 uppercase">Live</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-6">
                   {availability.length === 0 ? (
                     <p className="text-[11px] text-gray-400 font-medium italic">Scanning for team activity...</p>
                   ) : availability.filter(r => r.user_id !== userID).slice(0, 5).map(record => (
                     <div key={record.id} className="flex items-center gap-4 group">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[11px] font-black text-gray-400">
                             {record.user_id.slice(0, 2).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${record.is_available ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        </div>
                        <div className="flex flex-col gap-0.5">
                           <span className="text-[12px] font-black text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-[120px]">User #{record.user_id.slice(0,4)}</span>
                           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{record.is_available ? 'Available Now' : 'Occupied'}</span>
                        </div>
                     </div>
                   ))}
                </div>

                <div className="pt-6 border-t border-gray-50">
                   <p className="text-[10px] text-gray-400 leading-relaxed italic">"Synchronized team effort is the key to mission success."</p>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
