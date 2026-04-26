import type { Notification } from '../types/notification';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

const defaultOptions: RequestInit = {
  credentials: 'include',
};

/**
 * Fetches the most recent 50 notifications for the authenticated user.
 */
export async function getNotifications(): Promise<Notification[]> {
  const res = await fetch(`${BASE_URL}/api/v1/notifications`, {
    ...defaultOptions,
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`getNotifications: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data || [];
}

/**
 * Fetches the count of unread notifications for the authenticated user.
 */
export async function getUnreadCount(): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/v1/notifications/unread-count`, {
    ...defaultOptions,
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`getUnreadCount: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.count ?? 0;
}

/**
 * Marks a specific notification as read.
 */
export async function markAsRead(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/notifications/${id}/read`, {
    ...defaultOptions,
    method: 'PATCH',
  });

  if (!res.ok) {
    throw new Error(`markAsRead: ${res.status} ${res.statusText}`);
  }
}

/**
 * Marks all unread notifications for the user as read.
 */
export async function markAllAsRead(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/notifications/read-all`, {
    ...defaultOptions,
    method: 'PATCH',
  });

  if (!res.ok) {
    throw new Error(`markAllAsRead: ${res.status} ${res.statusText}`);
  }
}
