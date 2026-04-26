import { useState, useEffect, useCallback } from 'react';
import type { Comment } from '../types/comment';
import type { WSMessage } from '../types/task';
import { getComments, createComment } from '../services/commentService';
import { useWebSocket } from './useWebSocket';

/**
 * Manages task-specific comments with real-time WebSocket updates.
 */
export function useTaskComments(taskId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch on mount or taskId change
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getComments(taskId);
        if (mounted) setComments(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [taskId]);

  // WebSocket message handler
  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'task:comment_added') {
      const payload = msg.payload as Comment;
      // Only append if it's for this task and we don't have it yet (avoid double-adds with API response)
      if (payload.task_id === taskId) {
        setComments((prev) => {
          if (prev.some(c => c.id === payload.id)) return prev;
          return [...prev, payload];
        });
      }
    }
  }, [taskId]);

  useWebSocket({
    onMessage: handleMessage,
    enabled: true,
  });

  /**
   * Posts a new comment. No optimistic update; appends the server response on success.
   */
  const addComment = useCallback(async (body: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const newComment = await createComment(taskId, body);
      setComments((prev) => {
        if (prev.some(c => c.id === newComment.id)) return prev;
        return [...prev, newComment];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [taskId]);

  return {
    comments,
    loading,
    submitting,
    error,
    addComment,
  };
}
