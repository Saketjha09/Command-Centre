import React from 'react';
import { useFreelancerAvailability } from '../../hooks/useFreelancerAvailability';
import { AvailabilitySlot, SlotStatus } from '../../types/availability';

const SLOT_CONFIG = {
  night: { label: 'Night', range: '12am – 8am' },
  day: { label: 'Day', range: '8am – 4pm' },
  evening: { label: 'Evening', range: '4pm – 12am' },
};

const STATUS_STYLES: Record<SlotStatus, string> = {
  available: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
  offline: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200',
  booked: 'bg-amber-100 text-amber-700 border-amber-200 cursor-not-allowed',
  unknown: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
};

export const FreelancerAvailability: React.FC = () => {
  const { days, loading, error, toggleSlot, updateComment, saveDay } = useFreelancerAvailability();

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <SkeletonHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Availability</h1>
        <p className="text-gray-500 mt-1">Set your availability for the next 14 days</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {days.map((day) => {
          const isToday = day.date === todayStr;
          const dateObj = new Date(day.date + 'T00:00:00');
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          const formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

          return (
            <div
              key={day.date}
              className={`relative bg-white rounded-xl border p-5 shadow-sm transition-all ${
                isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {dayName}, {formattedDate}
                  </h3>
                  {day.isDirty && (
                    <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />
                  )}
                </div>
                {isToday && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    Today
                  </span>
                )}
              </div>

              {/* Slots */}
              <div className="space-y-6">
                {(['night', 'day', 'evening'] as AvailabilitySlot[]).map((slotKey) => {
                  const slot = day.slots[slotKey];
                  const config = SLOT_CONFIG[slotKey];

                  return (
                    <div key={slotKey} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{config.label}</div>
                          <div className="text-[11px] text-gray-500 uppercase tracking-tight">{config.range}</div>
                        </div>

                        <button
                          onClick={() => toggleSlot(day.date, slotKey)}
                          disabled={slot.isLocked}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 min-w-[80px] justify-center ${
                            STATUS_STYLES[slot.status]
                          }`}
                        >
                          {slot.status === 'booked' && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                          <span className="capitalize">{slot.status}</span>
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={slot.comment}
                          onChange={(e) => updateComment(day.date, slotKey, e.target.value)}
                          disabled={slot.isLocked}
                          placeholder="Add a note... (optional)"
                          className="w-full text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 disabled:bg-gray-100 transition-all"
                        />
                        {slot.comment.length > 0 && (
                          <span className="absolute right-2 bottom-2 text-[9px] font-medium text-gray-400 bg-white/80 px-1 rounded">
                            {slot.comment.length}/80
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save Button (Only if Dirty) */}
              {day.isDirty && (
                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => saveDay(day.date)}
                    disabled={day.isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
                  >
                    {day.isSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SkeletonHeader = () => (
  <div className="animate-pulse mb-8">
    <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
    <div className="h-4 bg-gray-100 rounded w-64"></div>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-5 bg-gray-200 rounded w-40"></div>
      <div className="h-5 bg-gray-100 rounded-full w-12"></div>
    </div>
    {[1, 2, 3].map((i) => (
      <div key={i} className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="h-4 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-100 rounded w-24"></div>
          </div>
          <div className="h-8 bg-gray-100 rounded-full w-20"></div>
        </div>
        <div className="h-8 bg-gray-50 rounded-lg w-full"></div>
      </div>
    ))}
  </div>
);
