import type { UserResponse, UserRole } from '../types/user';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

/**
 * Fetch all users.
 * GET /api/v1/users
 */
export async function getUsers(): Promise<UserResponse[]> {
  const res = await fetch(`${BASE_URL}/api/v1/users`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`getUsers: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data || [];
}

/**
 * Create a new admin/staff user.
 * POST /api/v1/auth/admin/users
 */
export async function createAdminUser(
  name: string,
  email: string,
  password: string,
  role: UserRole
): Promise<UserResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role }),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`createAdminUser: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<UserResponse>;
}

/**
 * Update a user's role.
 * PATCH /api/v1/auth/admin/users/${userId}/role
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`updateUserRole: ${res.status} ${res.statusText}`);
  }
}

/**
 * Update a user's account status (active/deactivated).
 * PATCH /api/v1/auth/admin/users/${userId}/status
 */
export async function updateUserStatus(userId: string, is_active: boolean): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active }),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`updateUserStatus: ${res.status} ${res.statusText}`);
  }
}
