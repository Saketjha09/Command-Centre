import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '../types/notification';
import type { WSMessage } from '../types/task';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead as apiMarkAsRead, 
  markAllAsRead as apiMarkAllAsRead 
} from '../services/notificationService';
import { useWebSocket } from './useWebSocket';

/**
 * Hook to manage in-app notifications with real-time updates and optimistic state changes.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Initial Load
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [notifs, count] = await Promise.all([
          getNotifications(),
          getUnreadCount(),
        ]);
        if (mounted) {
          setNotifications(notifs);
          setUnreadCount(count);
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  // 2. Real-time Updates via WebSocket
  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'notification:new') {
      const notif = msg.payload as Notification;
      
      // Prepend the new notification (newest first)
      setNotifications((prev) => [notif, ...prev]);
      
      // Increment unread count
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  useWebSocket({
    enabled: true,
    onMessage: handleMessage,
  });

  // 3. Mark single as read (Optimistic)
  const markAsRead = useCallback(async (id: string) => {
    // Save previous state for potential rollback
    let previousNotifications: Notification[] = [];
    let previousCount = 0;

    setNotifications((prev) => {
      previousNotifications = prev;
      return prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    });

    setUnreadCount((prev) => {
      previousCount = prev;
      const wasUnread = previousNotifications.find(n => n.id === id)?.is_read === false;
      return wasUnread ? Math.max(0, prev - 1) : prev;
    });

    try {
      await apiMarkAsRead(id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Rollback
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  }, []);

  // 4. Mark all as read (Optimistic)
  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousCount = unreadCount;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await apiMarkAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Rollback
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  }, [notifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
