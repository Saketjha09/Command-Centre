import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchTasks } from '../services/api';
import type { TaskSummary } from '../types/task';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FreelancerAvailability } from '../components/availability/FreelancerAvailability';
import { TaskListView } from '../components/kanban/TaskListView';

interface Props {
  onNavigate: (view: string) => void
}

export function MyTasksPage({ onNavigate }: Props) {
  const { id: userID, name: userName } = useAuth();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const myTasks = await fetchTasks();
      setTasks(myTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objectives');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeMissions = useMemo(() => 
    tasks.filter(t => !['approved', 'paid'].includes(t.status)), 
  [tasks]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white relative overflow-hidden">
      {/* Dynamic Header - Welcome Aditya */}
      <header className="px-10 py-10 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 z-20">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
            <span>Active Missions</span>
            <span className="w-1 h-1 rounded-full bg-gray-200" />
            <span>Operational Schedule</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
            Welcome, <span className="text-indigo-600">{userName.split(' ')[0]}</span>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">System Active</span>
            </div>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Objective</span>
            <span className="text-[13px] font-bold text-gray-900">Sync with Command Centre</span>
          </div>
          <button 
            onClick={loadData}
            className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95 shadow-sm"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/20">
        <div className="max-w-[1600px] mx-auto p-10 flex flex-col gap-12">
          
          {/* Availability Management */}
          <FreelancerAvailability />

          {/* Assigned Objectives List */}
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col gap-1">
                <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Objectives</h2>
                <p className="text-[13px] text-gray-500 font-medium">Current tasks under your jurisdiction.</p>
              </div>
              <button 
                onClick={() => onNavigate('board')}
                className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-2 transition-all group"
              >
                Tactical Board
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </button>
            </div>

            <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
              <div className="overflow-x-auto">
                <TaskListView 
                  tasks={activeMissions} 
                  loading={loading}
                  onTaskClick={(task) => onNavigate(`board?task=${task.id}`)}
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="p-8 rounded-[32px] bg-red-50 border border-red-100 text-red-600 text-[12px] font-black uppercase tracking-widest flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-200" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
