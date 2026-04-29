import React, { useState } from 'react';
import type { PayrollRun, PayrollRunDetail } from '../../services/payrollService';

interface HistoryTabProps {
  runs: PayrollRun[];
  expandedRunId: string | null;
  runDetails: Record<string, PayrollRunDetail>;
  markingPaid: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  loadRuns: () => Promise<void>;
  toggleExpand: (runId: string) => Promise<void>;
  markAsPaid: (runId: string) => Promise<void>;
}

export function HistoryTab({
  runs,
  expandedRunId,
  runDetails,
  markingPaid,
  loading,
  error: historyError,
  toggleExpand,
  markAsPaid
}: HistoryTabProps) {
  
  const [dismissedError, setDismissedError] = useState(false);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  // For full ISO timestamps (created_at, paid_at)
  const formatTimestamp = (iso: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(iso));
  };

  // For bare YYYY-MM-DD date strings (period_start, period_end)
  const formatDateOnly = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(dateStr + 'T00:00:00'));
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    
    // Only show year on the start date if it's a cross-year period
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    
    const startStr = new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', 
      month: 'short',
      year: sameYear ? undefined : 'numeric'
    }).format(startDate);
    
    const endStr = new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    }).format(endDate);
    
    return `${startStr} – ${endStr}`;
  };

  const displayError = !dismissedError && historyError;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto border border-[#2e2e2e] rounded-xl bg-[#1e1e1e]">
          <div className="h-12 bg-[#181818] border-b border-[#2e2e2e]" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-[#2e2e2e] animate-pulse flex items-center px-6 gap-4">
              <div className="w-10 h-10 rounded-full bg-[#2e2e2e]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#2e2e2e] rounded w-1/4" />
                <div className="h-3 bg-[#2e2e2e] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayError && (
        <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
          <span className="mt-0.5">⚠️</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold">Error</h3>
            <p className="text-xs opacity-80 mt-1">{historyError}</p>
          </div>
          <button onClick={() => setDismissedError(true)} className="text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-[#2e2e2e] rounded-xl bg-[#1e1e1e] shadow-xl">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#181818] text-gray-400 font-medium border-b border-[#2e2e2e]">
            <tr>
              <th className="px-6 py-4">Editor</th>
              <th className="px-6 py-4">Period</th>
              <th className="px-6 py-4 text-center">Tasks</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e]">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <span className="text-2xl">🕒</span>
                    <p>No payroll runs yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const isExpanded = expandedRunId === run.id;
                const isMarking = markingPaid[run.id];
                const detail = runDetails[run.id];

                return (
                  <React.Fragment key={run.id}>
                    <tr 
                      className={`hover:bg-[#252525] transition-colors cursor-pointer group ${isExpanded ? 'bg-[#222222]' : ''}`}
                      onClick={() => toggleExpand(run.id)}
                    >
                      <td className="px-6 py-4 font-bold text-gray-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2e2e2e] flex items-center justify-center text-xs text-gray-400 border border-[#3e3e3e]">
                          {run.editor_name.charAt(0).toUpperCase()}
                        </div>
                        {run.editor_name}
                      </td>
                      <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{formatPeriod(run.period_start, run.period_end)}</td>
                      <td className="px-6 py-4 text-center tabular-nums text-gray-400">{run.task_count}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-100 tabular-nums">{formatCurrency(run.total_amount)}</td>
                      <td className="px-6 py-4">
                        {run.status === 'paid' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-900/30 text-green-400 border border-green-800/50 uppercase tracking-wider">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-yellow-900/30 text-yellow-400 border border-yellow-800/50 uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 tabular-nums whitespace-nowrap">{formatTimestamp(run.created_at)}</td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {run.status === 'pending' ? (
                          <button
                            onClick={() => markAsPaid(run.id)}
                            disabled={isMarking}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2e2e2e] hover:bg-green-900/30 text-gray-200 hover:text-green-400 text-xs font-bold rounded border border-[#3e3e3e] hover:border-green-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                          >
                            {isMarking ? (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              'Mark Paid'
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500 whitespace-nowrap font-medium">
                            {run.paid_at ? formatTimestamp(run.paid_at) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="bg-[#1a1a1a]">
                        <td colSpan={7} className="p-0 border-b border-[#2e2e2e]">
                          <div className="p-6 bg-[#141414] shadow-inner border-y border-[#000000]">
                            {!detail ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (
                              <div className="max-w-4xl mx-auto bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg overflow-hidden shadow-lg">
                                <table className="w-full text-left text-sm text-gray-300">
                                  <thead className="bg-[#181818] border-b border-[#2e2e2e]">
                                    <tr>
                                      <th className="px-4 py-3 font-medium text-gray-400">Task Title</th>
                                      <th className="px-4 py-3 font-medium text-gray-400">Content Type</th>
                                      <th className="px-4 py-3 font-medium text-gray-400 text-right">Rate</th>
                                      <th className="px-4 py-3 font-medium text-gray-400 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#2e2e2e]">
                                    {detail.tasks.map((t) => (
                                      <tr key={t.task_id} className="hover:bg-[#252525]">
                                        <td className="px-4 py-3 text-gray-200">{t.task_title}</td>
                                        <td className="px-4 py-3">
                                          <span className="text-[10px] uppercase tracking-wider bg-[#2e2e2e] px-1.5 py-0.5 rounded text-gray-400">
                                            {t.content_type.replace('_', ' ')}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-gray-400">{formatCurrency(t.rate_applied)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-gray-200 font-medium">{formatCurrency(t.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-[#181818] border-t border-[#2e2e2e]">
                                    <tr>
                                      <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Total</td>
                                      <td className="px-4 py-3 text-right text-gray-100 font-black tabular-nums">{formatCurrency(detail.total_amount)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
