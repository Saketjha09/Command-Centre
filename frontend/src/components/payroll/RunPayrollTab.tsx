import React, { useState, useMemo } from 'react';
import { useRunPayroll } from '../../hooks/usePayroll';
import type { EditorRate } from '../../services/payrollService';

interface RunPayrollTabProps {
  onRunCreated: () => void;
  rates: EditorRate[];
  ratesLoading: boolean;
}

export function RunPayrollTab({ onRunCreated, rates, ratesLoading }: RunPayrollTabProps) {
  const { preview, previewing, creating, error: runError, previewRun, confirmRun, clearPreview } = useRunPayroll();

  const [editorId, setEditorId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dismissedError, setDismissedError] = useState(false);

  // Deduplicate editors for the dropdown
  const editors = useMemo(() => {
    const map = new Map<string, string>();
    rates.forEach((r) => {
      if (!map.has(r.editor_id)) {
        map.set(r.editor_id, r.editor_name || 'Unknown');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rates]);

  const canPreview = Boolean(editorId && periodStart && periodEnd && !previewing && !creating);

  const handlePreview = () => {
    setDismissedError(false);
    previewRun({
      editor_id: editorId,
      period_start: periodStart,
      period_end: periodEnd
    });
  };

  const handleConfirm = async () => {
    setDismissedError(false);
    try {
      await confirmRun({
        editor_id: editorId,
        period_start: periodStart,
        period_end: periodEnd
      });
      setEditorId('');
      setPeriodStart('');
      setPeriodEnd('');
      onRunCreated();
    } catch (e) {
      // Error handled by hook, UI will display it via runError
    }
  };

  const handleClear = () => {
    setEditorId('');
    setPeriodStart('');
    setPeriodEnd('');
    setDismissedError(false);
    if (clearPreview) clearPreview();
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const displayError = !dismissedError && runError;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* SECTION 1: Form */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-100 mb-6">Run Payroll</h2>
        
        {displayError && (
          <div className="mb-6 bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold">Error</h3>
              <p className="text-xs opacity-80 mt-1">{runError}</p>
            </div>
            <button onClick={() => setDismissedError(true)} className="text-red-400 hover:text-red-300">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Editor</label>
            <select
              value={editorId}
              onChange={(e) => setEditorId(e.target.value)}
              disabled={ratesLoading || creating || previewing}
              className="w-full bg-[#2e2e2e] border border-[#3e3e3e] text-gray-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 appearance-none"
            >
              <option value="">Select an editor...</option>
              {editors.map((ed) => (
                <option key={ed.id} value={ed.id}>{ed.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              disabled={creating || previewing}
              className="w-full bg-[#2e2e2e] border border-[#3e3e3e] text-gray-400 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              disabled={creating || previewing}
              className="w-full bg-[#2e2e2e] border border-[#3e3e3e] text-gray-400 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handlePreview}
            disabled={!canPreview}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-900/20"
          >
            {previewing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Preview'
            )}
          </button>
        </div>
      </div>

      {/* SECTION 2: Preview Table */}
      {preview && (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between bg-[#181818]">
            <div>
              <h3 className="text-lg font-bold text-gray-100">Payroll Preview</h3>
              <p className="text-sm text-gray-400 mt-1">
                {preview.editor_name} • {new Date(preview.period_start).toLocaleDateString()} - {new Date(preview.period_end).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#181818] text-gray-400 font-medium border-b border-[#2e2e2e]">
                <tr>
                  <th className="px-6 py-4">Task Title</th>
                  <th className="px-6 py-4">Content Type</th>
                  <th className="px-6 py-4 text-right">Rate</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2e2e]">
                {preview.tasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No tasks found for this period.
                    </td>
                  </tr>
                ) : (
                  preview.tasks.map((task) => (
                    <tr key={task.task_id} className="hover:bg-[#252525] transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-200">{task.task_title}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#2e2e2e] text-gray-300 uppercase tracking-wider">
                          {task.content_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-gray-400">{formatCurrency(task.rate_applied)}</td>
                      <td className="px-6 py-4 text-right font-bold tabular-nums text-gray-100">{formatCurrency(task.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#181818] border-t border-[#2e2e2e]">
                <tr>
                  <td colSpan={3} className="px-6 py-5 text-right text-sm font-bold text-gray-400 uppercase tracking-wider">Total Amount</td>
                  <td className="px-6 py-5 text-right text-xl font-black text-green-400 tabular-nums">
                    {formatCurrency(preview.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-6 bg-[#181818] border-t border-[#2e2e2e] flex items-center justify-end gap-4">
            <button
              onClick={handleClear}
              disabled={creating}
              className="px-6 py-2.5 bg-transparent hover:bg-[#2e2e2e] text-gray-300 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handleConfirm}
              disabled={creating || preview.tasks.length === 0}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-900/20"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirm & Create Run'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
