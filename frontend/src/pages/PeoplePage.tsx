import { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { 
  fetchUsers, 
  fetchBrands, 
  createBrand, 
  deleteBrand, 
  inviteUser, 
  updateUserRole, 
  updateUserStatus 
} from '../services/api';
import type { Brand } from '../types/brand';
import type { User } from '../types/auth';

export function PeoplePage() {
  const { user: currentUser } = useAuthContext();
  const [activeTab, setActiveTab] = useState<'team' | 'brands'>('team');
  const [users, setUsers] = useState<User[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  // Form States
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '' });
  const [brandForm, setBrandForm] = useState({ name: '', slug: '', hex_color: '#6366f1' });

  const isSuperadmin = currentUser?.role === 'superadmin';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [u, b] = await Promise.all([fetchUsers(), fetchBrands()]);
      setUsers(u);
      setBrands(b);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteUser(inviteForm);
      setSuccess(`User ${inviteForm.name} invited successfully!`);
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', password: '' });
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBrand(brandForm);
      setSuccess(`Brand ${brandForm.name} created!`);
      setShowBrandModal(false);
      setBrandForm({ name: '', slug: '', hex_color: '#6366f1' });
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brand');
    }
  };

  const handleToggleStatus = async (id: string, name: string, currentStatus: boolean) => {
    const action = currentStatus ? 'Deactivate' : 'Reactivate';
    if (!window.confirm(`${action} user "${name}"?`)) return;
    try {
      await updateUserStatus(id, !currentStatus);
      setUsers(users.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u));
      setSuccess(`User ${name} ${currentStatus ? 'deactivated' : 'reactivated'}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleRoleChange = async (id: string, name: string, newRole: string) => {
    try {
      await updateUserRole(id, newRole);
      setUsers(users.map(u => u.id === id ? { ...u, role: newRole as User['role'] } : u));
      setSuccess(`Role updated for ${name} to ${newRole}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!window.confirm(`Delete brand "${name}"? This cannot be undone.`)) return;
    try {
      await deleteBrand(id);
      setBrands(brands.filter(b => b.id !== id));
      setSuccess(`Brand ${name} deleted.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete brand');
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Tab Switcher */}
      <div className="px-10 pt-10 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-10">
          <button 
            onClick={() => setActiveTab('team')}
            className={`pb-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === 'team' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-900'}`}
          >
            Team Roster
          </button>
          <button 
            onClick={() => setActiveTab('brands')}
            className={`pb-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === 'brands' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-900'}`}
          >
            Brand Management
          </button>
        </div>
        
        {isSuperadmin && (
          <div className="pb-4">
            {activeTab === 'team' ? (
              <button 
                onClick={() => setShowInviteModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Invite User
              </button>
            ) : (
              <button 
                onClick={() => setShowBrandModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Brand
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-10">
          
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold uppercase tracking-widest fade-in">
              {error}
              <button onClick={() => setError(null)} className="ml-4 opacity-50 hover:opacity-100">✕</button>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-600 text-[11px] font-bold uppercase tracking-widest fade-in">
              {success}
            </div>
          )}

          {activeTab === 'team' ? (
            <div className="flex flex-col gap-10">
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">User</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Role</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Slack ID</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(u => (
                      <tr key={u.id} className={`hover:bg-gray-50/30 transition-colors group ${!u.is_active ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                               <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-700 uppercase">
                                 {u.name[0]}
                               </div>
                               {!u.is_active && (
                                 <div className="absolute -bottom-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-white" title="Inactive" />
                               )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-bold text-gray-900">{u.name}</span>
                              <span className="text-[11px] text-gray-400 font-medium">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {isSuperadmin && u.id !== currentUser?.id ? (
                            <select 
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, u.name, e.target.value)}
                              className="bg-transparent border-none text-[9px] font-bold uppercase tracking-widest text-indigo-600 focus:ring-0 cursor-pointer hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                            >
                              <option value="superadmin">Superadmin</option>
                              <option value="admin">Admin</option>
                              <option value="freelancer">Freelancer</option>
                            </select>
                          ) : (
                            <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${
                              u.role === 'superadmin' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                              u.role === 'admin' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                              'bg-gray-50 border-gray-100 text-gray-500'
                            }`}>
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-6 font-mono text-[11px] text-gray-400 group-hover:text-gray-600 transition-colors">
                          {u.slack_id || '—'}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                             {u.slack_id && u.is_active && (
                               <button 
                                 onClick={async () => {
                                   try {
                                     const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1/notifications/slack/ping/${u.id}`, {
                                       method: 'POST',
                                       credentials: 'include'
                                     });
                                     if (res.ok) {
                                       setSuccess(`Slack ping sent to ${u.name}!`);
                                       setTimeout(() => setSuccess(null), 3000);
                                     } else { throw new Error('Ping failed'); }
                                   } catch (err) { setError('Failed to send Slack ping'); }
                                 }}
                                 className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 border border-transparent hover:border-indigo-100"
                               >
                                 Ping
                               </button>
                             )}
                             {isSuperadmin && u.id !== currentUser?.id && (
                               <button 
                                 onClick={() => handleToggleStatus(u.id, u.name, u.is_active)}
                                 className={`p-2 rounded-lg transition-all ${u.is_active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                 title={u.is_active ? "Deactivate User" : "Reactivate User"}
                               >
                                 {u.is_active ? (
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                 ) : (
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 )}
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-10">
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                   <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-[0.2em]">Active Brands</h3>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{brands.length} Total Entities</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {brands.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-8 hover:bg-gray-50/30 transition-colors group">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all group-hover:scale-105" style={{ backgroundColor: b.hex_color }}>
                            <span className="text-white font-black text-[16px] uppercase">{b.name[0]}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[15px] font-bold text-gray-900">{b.name}</span>
                            <span className="text-[11px] text-gray-400 font-mono uppercase tracking-tighter">{b.slug}</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="flex flex-col items-end">
                            <span className="text-[11px] font-bold text-gray-400 font-mono uppercase">{b.hex_color}</span>
                            <div className="w-20 h-1.5 rounded-full mt-2 bg-gray-100 overflow-hidden border border-gray-200/50">
                               <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: b.hex_color }} />
                            </div>
                         </div>
                         {isSuperadmin && (
                           <button 
                             onClick={() => handleDeleteBrand(b.id, b.name)}
                             className="opacity-0 group-hover:opacity-100 transition-all p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                           >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-gray-900 uppercase tracking-[0.2em]">Invite New Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>
            <form onSubmit={handleInvite} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={inviteForm.name}
                  onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-[13px] text-gray-900 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-[13px] text-gray-900 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Initial Password</label>
                <input 
                  type="password" 
                  required
                  value={inviteForm.password}
                  onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-[13px] text-gray-900 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                Send Invitation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-gray-900 uppercase tracking-[0.2em]">Register New Brand</h2>
              <button onClick={() => setShowBrandModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>
            <form onSubmit={handleAddBrand} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brand Name</label>
                <input 
                  type="text" 
                  required
                  value={brandForm.name}
                  onChange={e => setBrandForm({ ...brandForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-[13px] text-gray-900 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brand Slug</label>
                <input 
                  type="text" 
                  required
                  value={brandForm.slug}
                  onChange={e => setBrandForm({ ...brandForm, slug: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-[13px] text-gray-900 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="acme-corp"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Theme Color</label>
                <div className="flex gap-4">
                  <input 
                    type="color" 
                    value={brandForm.hex_color}
                    onChange={e => setBrandForm({ ...brandForm, hex_color: e.target.value })}
                    className="w-12 h-12 rounded-xl border-none cursor-pointer p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={brandForm.hex_color}
                    onChange={e => setBrandForm({ ...brandForm, hex_color: e.target.value })}
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-[13px] text-gray-900 font-mono uppercase"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                Create Brand
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
