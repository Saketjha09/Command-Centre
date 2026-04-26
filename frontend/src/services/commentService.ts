import type { Comment } from '../types/comment';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

const defaultOptions: RequestInit = {
  credentials: 'include',
};

/**
 * Fetches all comments for a specific task.
 */
export async function getComments(taskId: string): Promise<Comment[]> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/comments`, {
    ...defaultOptions,
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`getComments: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data || [];
}

/**
 * Creates a new comment on a specific task.
 */
export async function createComment(taskId: string, body: string): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/comments`, {
    ...defaultOptions,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    throw new Error(`createComment: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}
