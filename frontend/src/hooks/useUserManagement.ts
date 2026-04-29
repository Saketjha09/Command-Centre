import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserResponse, UserRole } from '../types/user';
import * as userService from '../services/userService';

export function useUserManagement() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Track mount status to prevent updates on unmounted components
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      if (mountedRef.current) {
        setUsers(data);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(async (name: string, email: string, password: string, role: UserRole) => {
    setError(null);
    try {
      const newUser = await userService.createAdminUser(name, email, password, role);
      if (mountedRef.current) {
        setUsers((prev) => [...prev, newUser]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      if (mountedRef.current) {
        setError(msg);
      }
      // Re-throw so the UI/Modal can handle the error (e.g. keep modal open)
      throw err;
    }
  }, []);

  const updateRole = useCallback(async (userId: string, role: UserRole) => {
    setError(null);
    let rollbackUsers: UserResponse[] | null = null;

    setUsers((prev) => {
      rollbackUsers = prev; // Capture current state for potential rollback
      return prev.map((u) => (u.id === userId ? { ...u, role } : u));
    });

    try {
      await userService.updateUserRole(userId, role);
    } catch (err: unknown) {
      if (mountedRef.current && rollbackUsers) {
        setUsers(rollbackUsers);
        setError(err instanceof Error ? err.message : 'Failed to update role');
      }
    }
  }, []);

  const toggleStatus = useCallback(async (userId: string, is_active: boolean) => {
    setError(null);
    let rollbackUsers: UserResponse[] | null = null;

    setUsers((prev) => {
      rollbackUsers = prev; // Capture current state for potential rollback
      return prev.map((u) => (u.id === userId ? { ...u, is_active } : u));
    });

    try {
      await userService.updateUserStatus(userId, is_active);
    } catch (err: unknown) {
      if (mountedRef.current && rollbackUsers) {
        setUsers(rollbackUsers);
        setError(err instanceof Error ? err.message : 'Failed to update status');
      }
    }
  }, []);

  const refetch = useCallback(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    createUser,
    updateRole,
    toggleStatus,
    refetch,
  };
}
