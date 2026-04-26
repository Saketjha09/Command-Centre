import React, { useState, useRef, useEffect } from 'react';
import { useTaskComments } from '../../hooks/useTaskComments';

interface TaskCommentsProps {
  taskId: string;
  darkMode?: boolean;
}

/**
 * Helper to format relative time strings.
 * Duplicated from NotificationBell.tsx as per requirements.
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

export const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, darkMode }) => {
  const { comments, loading, submitting, error, addComment } = useTaskComments(taskId);
  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever comments change or finished loading
  useEffect(() => {
    if (!loading) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!body.trim() || submitting) return;

    try {
      await addComment(body.trim());
      setBody(''); // Clear on success
    } catch {
      // Error is handled by the hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (without Shift) submits. Shift+Enter adds a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`mt-6 flex flex-col gap-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'} pt-6`}>
      <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Comments</h3>

      {/* Comment List Area */}
      <div className={`max-h-[320px] overflow-y-auto pr-2 flex flex-col gap-4 scrollbar-thin ${darkMode ? 'scrollbar-thumb-gray-700' : 'scrollbar-thumb-gray-200'}`}>
        {loading ? (
          // Skeleton Rows (3 rows with animated pulse)
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className={`h-8 w-8 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} flex-shrink-0`} />
              <div className="flex-1 flex flex-col gap-2">
                <div className={`h-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/4`} />
                <div className={`h-3 ${darkMode ? 'bg-gray-600' : 'bg-gray-100'} rounded w-full`} />
              </div>
            </div>
          ))
        ) : comments.length === 0 ? (
          // Empty State - simplified text color as per user request
          <p className="text-sm text-gray-500 py-4 italic text-center">No comments yet. Start the conversation.</p>
        ) : (
          // Data State (Oldest First)
          comments.map((c) => (
            <div key={c.id} className="flex gap-3 items-start group">
              {/* Avatar Initial */}
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 text-xs font-bold ring-2 ring-white">
                {c.author_name.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'} truncate`}>
                    {c.author_name}
                  </span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                    {formatTimeAgo(c.created_at)}
                  </span>
                </div>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} whitespace-pre-wrap break-words leading-relaxed`}>
                  {c.body}
                </p>
              </div>
            </div>
          ))
        )}
        {/* Scroll Target */}
        <div ref={scrollRef} className="h-0" />
      </div>

      {/* Input Form Area */}
      <form onSubmit={handleSubmit} className="relative mt-2">
        {/* Error Banner */}
        {error && (
          <div className={`mb-2 p-2 border rounded text-xs ${darkMode ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
            {error}
          </div>
        )}
        
        <div className="relative">
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            maxLength={500}
            className={`w-full text-sm border rounded-lg px-3 py-2 pr-16 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none ${darkMode ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-gray-50/50 hover:bg-white text-gray-900'}`}
          />
          
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            {/* Character Count */}
            {body.length > 0 && (
              <span className={`text-[10px] text-gray-400 font-medium px-1 rounded ${darkMode ? 'bg-gray-800/80' : 'bg-white/80'}`}>
                {body.length}/500
              </span>
            )}
            
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[32px] min-h-[32px]"
            >
              {submitting ? (
                // Spinner
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                // Send Icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
