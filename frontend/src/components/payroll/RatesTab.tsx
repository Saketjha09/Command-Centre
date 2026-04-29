import React, { useState, useMemo } from 'react';
import type { EditorRate } from '../../services/payrollService';

interface RatesTabProps {
  rates: EditorRate[];
  loading: boolean;
  error: string | null;
  updateRate: (editorId: string, contentType: string, rate: number) => Promise<void>;
}

type EditorRow = {
  editorId: string;
  editorName: string;
  rates: Record<string, number>;
};

export function RatesTab({ rates, loading, error, updateRate }: RatesTabProps) {
  const [editingCell, setEditingCell] = useState<{ editorId: string; contentType: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<Record<string, boolean>>({});

  const formatRate = (rate: number | undefined) => {
    if (rate === undefined) return '—';
    return rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const rows = useMemo(() => {
    const map = new Map<string, EditorRow>();
    for (const r of rates) {
      if (!map.has(r.editor_id)) {
        map.set(r.editor_id, {
          editorId: r.editor_id,
          editorName: r.editor_name || 'Unknown',
          rates: {},
        });
      }
      map.get(r.editor_id)!.rates[r.content_type.toLowerCase()] = r.rate;
    }
    return Array.from(map.values());
  }, [rates]);

  const handleEditClick = (editorId: string, contentType: string, currentRate: number | undefined) => {
    setEditingCell({ editorId, contentType });
    setEditValue(currentRate !== undefined ? currentRate.toString() : '');
  };

  const handleSave = async (editorId: string, contentType: string) => {
    if (!editValue) {
      setEditingCell(null);
      return;
    }
    
    const numValue = parseFloat(editValue);
    if (isNaN(numValue) || numValue < 0) {
      setEditingCell(null);
      return;
    }

    const cellKey = `${editorId}:${contentType}`;
    setSavingCell((prev) => ({ ...prev, [cellKey]: true }));
    
    try {
      await updateRate(editorId, contentType, numValue);
      setEditingCell(null);
    } catch (err) {
      setEditingCell(null);
    } finally {
      setSavingCell((prev) => ({ ...prev, [cellKey]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, editorId: string, contentType: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(editorId, contentType);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

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
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
          <span className="mt-0.5">⚠️</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold">Error</h3>
            <p className="text-xs opacity-80 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-[#2e2e2e] rounded-xl bg-[#1e1e1e] shadow-xl">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#181818] text-gray-400 font-medium border-b border-[#2e2e2e]">
            <tr>
              <th className="px-6 py-4">Editor Name</th>
              <th className="px-6 py-4">Script</th>
              <th className="px-6 py-4">Video Edit</th>
              <th className="px-6 py-4">Other</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <span className="text-2xl">💵</span>
                    <p>No editor rates configured yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.editorId} className="hover:bg-[#252525] transition-colors group">
                  <td className="px-6 py-4 font-bold text-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2e2e2e] flex items-center justify-center text-xs text-gray-400 border border-[#3e3e3e]">
                      {row.editorName.charAt(0).toUpperCase()}
                    </div>
                    {row.editorName}
                  </td>
                  
                  {(['script', 'video_edit', 'other'] as const).map((type) => {
                    const isEditing = editingCell?.editorId === row.editorId && editingCell?.contentType === type;
                    const isSaving = savingCell[`${row.editorId}:${type}`];
                    const currentRate = row.rates[type];

                    return (
                      <td key={type} className="px-6 py-4">
                        {isEditing ? (
                          <div className="relative">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSave(row.editorId, type)}
                              onKeyDown={(e) => handleKeyDown(e, row.editorId, type)}
                              className="w-24 bg-[#2e2e2e] border border-blue-500 text-gray-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
                              autoFocus
                              min="0"
                              step="0.01"
                            />
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-blue-400 transition-colors w-28 px-2 py-1.5 rounded hover:bg-[#2e2e2e] -ml-2"
                            onClick={() => handleEditClick(row.editorId, type, currentRate)}
                            title="Click to edit"
                          >
                            {isSaving ? (
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="tabular-nums">{formatRate(currentRate)}</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
