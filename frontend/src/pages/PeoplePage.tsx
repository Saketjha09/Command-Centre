import { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsers, fetchBrands, createBrand, deleteBrand } from '../services/api';
import type { Brand } from '../types/brand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'freelancer';
  slack_id?: string;
  created_at?: string;
}

export function PeoplePage() {
  const { user: currentUser } = useAuthContext();
  const [activeTab, setActiveTab] = useState<'team' | 'brands'>('team');
  const [users, setUsers] = useState<User[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    <div className="flex flex-col h-full bg-white">
      {/* Tab Switcher */}
      <div className="px-10 pt-10 flex items-center gap-10 border-b border-gray-100">
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

      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-10">
          
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold uppercase tracking-widest fade-in">
              {error}
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
                      <tr key={u.id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-700 uppercase">
                              {u.name[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-bold text-gray-900">{u.name}</span>
                              <span className="text-[11px] text-gray-400 font-medium">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${
                            u.role === 'superadmin' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                            u.role === 'admin' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                            'bg-gray-50 border-gray-100 text-gray-500'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-mono text-[11px] text-gray-400 group-hover:text-gray-600 transition-colors">
                          {u.slack_id || '—'}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                             {u.slack_id && (
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
                                 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52h-2.521zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.958 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zM17.687 8.834a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zM15.166 18.958a2.528 2.528 0 0 1 2.521 2.522 2.528 2.528 0 0 1-2.521 2.522 2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zM15.166 17.688a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312a2.528 2.528 0 0 1 2.522 2.521 2.528 2.528 0 0 1-2.522 2.521h-6.312z"/></svg>
                                 Ping
                               </button>
                             )}
                             {isSuperadmin && u.id !== currentUser?.id && (
                               <button 
                                 className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                 title="Remove User"
                               >
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
    </div>
  );
}
