import React, { useState, useMemo } from 'react';
import type { UserResponse, UserRole } from '../../types/user';

interface UserTableProps {
  users: UserResponse[];
  currentUserId: string;
  onRoleChange: (userId: string, role: UserRole) => Promise<void>;
  onToggleStatus: (userId: string, is_active: boolean) => Promise<void>;
  loading?: boolean;
}

/**
 * Generates a consistent HSL color based on a string (user name).
 */
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
};

/**
 * Formats ISO date string to "12 Jan 2025"
 */
const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
};

export function UserTable({ users, currentUserId, onRoleChange, onToggleStatus, loading }: UserTableProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'freelancer'>('all');
  
  // Local loading states for mutation feedback
  const [roleUpdating, setRoleUpdating] = useState<Record<string, boolean>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  // Client-side filtering logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setRoleUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      await onRoleChange(userId, role);
    } finally {
      setRoleUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    setStatusUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      await onToggleStatus(userId, !isActive);
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg animate-pulse w-full max-w-md" />
        <div className="overflow-x-auto border border-[#2e2e2e] rounded-xl bg-[#1e1e1e]">
          <div className="h-12 bg-[#181818] border-b border-[#2e2e2e]" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-[#2e2e2e] animate-pulse flex items-center px-6 gap-4">
              <div className="w-10 h-10 rounded-full bg-[#2e2e2e]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#2e2e2e] rounded w-1/4" />
                <div className="h-3 bg-[#2e2e2e] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#2e2e2e] text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Role Filter</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'freelancer')}
            className="bg-[#1e1e1e] border border-[#2e2e2e] text-gray-200 text-sm rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="freelancer">Freelancer</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-[#2e2e2e] rounded-xl bg-[#1e1e1e] shadow-xl">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#181818] text-gray-400 font-medium border-b border-[#2e2e2e]">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e]">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <span className="text-2xl">🔍</span>
                    <p>No users match your search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isSelf = user.id === currentUserId;
                const isSuperAdmin = user.role === 'superadmin';
                const isUpdatingRole = roleUpdating[user.id];
                const isUpdatingStatus = statusUpdating[user.id];

                return (
                  <tr key={user.id} className="hover:bg-[#252525] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover border border-[#3e3e3e]"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold border border-[#3e3e3e]"
                              style={{ backgroundColor: getAvatarColor(user.name) }}
                            >
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {user.is_active && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#1e1e1e] rounded-full" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-gray-100 truncate flex items-center gap-1.5">
                            {user.name}
                            {isSelf && (
                              <span className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800/50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {isSuperAdmin ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-900/20 text-purple-400 border border-purple-800/50 uppercase tracking-wider">
                          Super Admin
                        </span>
                      ) : (
                        <div className="relative inline-block w-32">
                          <select
                            value={user.role}
                            disabled={isSelf || isUpdatingRole}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            className="w-full bg-[#2e2e2e] border border-[#3e3e3e] text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none transition-all cursor-pointer"
                          >
                            <option value="admin">Admin</option>
                            <option value="freelancer">Freelancer</option>
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            {isUpdatingRole ? (
                              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <button
                        disabled={isSelf || isUpdatingStatus}
                        onClick={() => handleToggleStatus(user.id, user.is_active)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                          user.is_active
                            ? 'bg-green-900/20 text-green-400 border-green-800/50 hover:bg-green-900/40'
                            : 'bg-red-900/20 text-red-400 border-red-800/50 hover:bg-red-900/40'
                        } disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider`}
                      >
                        {isUpdatingStatus ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                        )}
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap font-medium tabular-nums">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
