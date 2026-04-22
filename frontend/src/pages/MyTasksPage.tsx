import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchTasks } from '../services/api';
import type { TaskSummary } from '../types/task';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FreelancerAvailability } from '../components/availability/FreelancerAvailability';

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  brief_pending: { label: 'Brief Pending', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  review: { label: 'Review', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  paid: { label: 'Paid', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

export function MyTasksPage() {
  const { id: userID } = useAuth();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const myTasks = await fetchTasks(); // Backend now filters by assigned_to for freelancers
      setTasks(myTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-[#09090b]">
      {/* Availability Section */}
      <section className="p-6 border-b border-[#27272a]">
        <FreelancerAvailability userID={userID} compact />
      </section>

      {/* Tasks Section */}
      <section className="p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-[#fafafa] tracking-tight">Active Tasks</h2>
            <p className="text-[#71717a] text-xs">
              {tasks.length} mission{tasks.length !== 1 ? 's' : ''} currently in progress.
            </p>
          </div>
          <button 
            onClick={loadTasks}
            className="p-2 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-indigo-500/30 text-[#71717a] hover:text-[#fafafa] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center text-2xl mb-4 opacity-50">
              📋
            </div>
            <p className="text-[#71717a] text-sm font-medium">No tasks assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tasks.map(task => {
              const status = STATUS_DISPLAY[task.status] || { label: task.status, color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
              const deadline = task.deadline ? new Date(task.deadline) : null;
              const isOverdue = deadline && deadline < new Date() && task.status !== 'approved';

              return (
                <div
                  key={task.id}
                  className="group bg-[#18181b] rounded-2xl border border-[#27272a] p-5 hover:border-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <span className="px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[10px] font-bold text-[#71717a] uppercase tracking-widest">
                      {task.brand.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-bold text-[#fafafa] mb-4 line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
                    {task.title}
                  </h3>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#27272a]">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`} />
                      <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-[#71717a]'}`}>
                        {deadline ? (
                          isOverdue ? `Overdue: ${deadline.toLocaleDateString()}` : `Due: ${deadline.toLocaleDateString()}`
                        ) : 'No Deadline'}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-[#3f3f46]">
                      #{task.id.slice(0, 6)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
