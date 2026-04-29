import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserManagement } from '../hooks/useUserManagement';
import { UserTable } from '../components/admin/UserTable';
import { CreateUserModal } from '../components/admin/CreateUserModal';

export default function UserManagementPage() {
  const { role, id: currentUserId } = useAuth();
  const { 
    users, 
    loading, 
    error: hookError, 
    createUser, 
    updateRole, 
    toggleStatus 
  } = useUserManagement();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Reset error dismissal whenever a new hook error appears
  useEffect(() => {
    if (hookError) {
      setErrorDismissed(false);
    }
  }, [hookError]);

  // Auth guard: Superadmin only
  if (role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const activeError = !errorDismissed ? (localError || hookError) : null;

  const handleDismissError = () => {
    setLocalError(null);
    setErrorDismissed(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">User Management</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-md">
            Control system access, assign administrative roles, and manage account status across the organization.
          </p>
        </div>
        
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2 group"
        >
          <svg 
            className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add User
        </button>
      </div>

      {/* Error Banner */}
      {activeError && (
        <div className="mb-8 bg-red-900/20 border border-red-800/40 text-red-400 p-4 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-red-900/40 p-2 rounded-lg">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight">System Error</p>
              <p className="text-xs opacity-80">{activeError}</p>
            </div>
          </div>
          <button
            onClick={handleDismissError}
            className="text-red-400/60 hover:text-red-400 transition-colors uppercase text-[10px] font-black tracking-widest border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] overflow-hidden shadow-2xl">
        <div className="p-1">
          <UserTable
            users={users}
            loading={loading}
            currentUserId={currentUserId}
            onRoleChange={updateRole}
            onToggleStatus={toggleStatus}
          />
        </div>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createUser}
      />
    </div>
  );
}
