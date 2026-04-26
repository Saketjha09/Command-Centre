import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification } from '../../types/notification';

/**
 * Helper to format relative time strings.
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;

  const diffInDays = Math.floor(diffInSeconds / 86400);
  if (diffInDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const displayCount = unreadCount > 9 ? '9+' : unreadCount;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full border-2 border-white transform translate-x-1/2 -translate-y-1/2">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] max-h-[480px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-[9999] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              // Loading Skeleton
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-gray-50 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              // Empty State
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              // Notifications List
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`relative p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 group ${
                    !n.is_read ? 'bg-blue-50/20' : 'bg-white'
                  }`}
                >
                  {/* Left Border for Unread */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors ${
                      !n.is_read ? 'bg-blue-600' : 'bg-transparent'
                    }`}
                  />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={`text-sm ${
                          !n.is_read ? 'font-bold text-gray-900' : 'font-normal text-gray-700'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {!loading && unreadCount > 0 && (
            <div className="p-2 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                className="w-full py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
