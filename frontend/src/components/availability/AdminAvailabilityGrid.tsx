import React, { useState } from 'react';
import { useAdminGrid } from '../../hooks/useAdminGrid';
import { SlotStatus } from '../../types/availabilityTypes';

/**
 * Helper to get status colors as defined in PRD §5a
 */
const getSlotColor = (status: SlotStatus) => {
  switch (status) {
    case 'available': return '#22c55e';
    case 'booked':    return '#f59e0b';
    case 'offline':   return '#ef4444';
    case 'unknown':
    default:          return '#6b7280';
  }
};

const formatDateShort = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' });
};

const formatDateFull = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const isToday = (dateStr: string) => {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
};

interface SelectedCell {
  editorId: string;
  date: string;
}

export function AdminAvailabilityGrid() {
  const { data, loading, error, refetch } = useAdminGrid();
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const handleCellClick = (editorId: string, date: string) => {
    if (selectedCell?.editorId === editorId && selectedCell?.date === date) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ editorId, date });
    }
  };

  if (loading) {
    return (
      <div className="w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 p-6 bg-white border border-gray-100 rounded-3xl animate-pulse">
            <div className="w-10 h-10 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-3">
              <div className="h-3 bg-gray-100 rounded w-1/4" />
              <div className="h-10 bg-gray-50 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-[32px] border border-red-100 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-900 font-bold mb-2 uppercase tracking-tight">Sync Failed</p>
        <p className="text-red-600 text-sm mb-6 max-w-xs mx-auto font-medium">{error}</p>
        <button 
          onClick={refetch}
          className="px-8 py-2.5 bg-red-600 text-white rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data || data.editors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-gray-200 rounded-[40px] bg-white text-center">
        <p className="text-gray-400 font-black text-[12px] uppercase tracking-[0.2em]">No active editors found</p>
      </div>
    );
  }

  const selectedEditor = data.editors.find(e => e.id === selectedCell?.editorId);
  const selectedDaySlots = selectedCell && selectedEditor ? selectedEditor.days[selectedCell.date] : null;

  return (
    <div className="relative w-full rounded-[32px] border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[200px] min-w-[200px] bg-white border-b border-r border-gray-100 p-6 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                Resource Name
              </th>
              {data.dates.map(date => (
                <th 
                  key={date} 
                  className={`min-w-[120px] p-6 border-b border-gray-100 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                    isToday(date) ? 'bg-indigo-50/50 text-indigo-600' : 'text-gray-400'
                  }`}
                >
                  {formatDateShort(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.editors.map(editor => (
              <tr key={editor.id} className="group hover:bg-gray-50/30 transition-colors">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/50 border-r border-gray-100 p-6 transition-colors shadow-[4px_0_12px_-4px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {editor.photo_url ? (
                        <img src={editor.photo_url} alt={editor.name} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-600 uppercase shadow-sm">
                          {editor.name[0]}
                        </div>
                      )}
                    </div>
                    <span className="text-[14px] font-bold text-gray-900 truncate max-w-[120px] tracking-tight">{editor.name}</span>
                  </div>
                </td>
                {data.dates.map(date => {
                  const daySlots = editor.days[date];
                  const isCellSelected = selectedCell?.editorId === editor.id && selectedCell?.date === date;
                  
                  return (
                    <td 
                      key={date}
                      onClick={() => handleCellClick(editor.id, date)}
                      className={`h-[100px] p-3 border-b border-gray-100 cursor-pointer transition-all relative group/cell ${
                        isToday(date) ? 'bg-indigo-50/10' : ''
                      } ${
                        isCellSelected ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-200' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex flex-col gap-2 h-full justify-center px-2">
                        {['night', 'day', 'evening'].map((slotKey) => {
                          const details = daySlots[slotKey as keyof typeof daySlots];
                          return (
                            <div key={slotKey} className="flex items-center gap-2.5">
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
                                style={{ backgroundColor: getSlotColor(details.status) }}
                              />
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest hidden sm:inline">
                                {slotKey[0]}
                              </span>
                              {details.task_count > 0 && (
                                <div className="ml-auto flex items-center justify-center bg-gray-900 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full leading-none shadow-sm tabular-nums">
                                  {details.task_count}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Popover */}
      {selectedCell && selectedEditor && selectedDaySlots && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/5 backdrop-blur-sm sm:absolute sm:bg-transparent sm:backdrop-blur-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
          <div className="w-full max-w-[320px] bg-white rounded-3xl border border-gray-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-[14px] font-black text-gray-900 uppercase tracking-tight">
                  {formatDateFull(selectedCell.date)}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {selectedEditor.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCell(null);
                }}
                className="text-gray-300 hover:text-gray-900 transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(selectedDaySlots).map(([slot, details]) => (
                <div key={slot} className="flex flex-col gap-2 p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: getSlotColor(details.status) }} />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{slot}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      details.status === 'available' ? 'bg-green-50 border-green-100 text-green-600' :
                      details.status === 'booked' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                      details.status === 'offline' ? 'bg-red-50 border-red-100 text-red-600' :
                      'bg-gray-100 border-gray-200 text-gray-400'
                    }`}>
                      {details.status}
                    </span>
                  </div>
                  
                  {details.note && (
                    <div className="mt-1 flex gap-2">
                      <svg className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                      <p className="text-[12px] text-gray-600 font-medium leading-relaxed italic">{details.note}</p>
                    </div>
                  )}

                  {details.task_count > 0 && (
                    <div className="mt-1 flex items-center gap-2 px-2 py-1 bg-gray-900 rounded-lg w-fit">
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">
                        {details.task_count} Active Task{details.task_count > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setSelectedCell(null)}
              className="w-full mt-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all active:scale-95 shadow-xl shadow-gray-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
