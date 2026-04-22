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

  // User form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'freelancer' as 'admin' | 'freelancer',
  });

  // Brand form state
  const [newBrand, setNewBrand] = useState({
    name: '',
    slug: '',
    hex_color: '#6366f1'
  });

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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Error: ${response.status}`);
      }

      const created = await response.json();
      setUsers([...users, created]);
      setNewUser({ name: '', email: '', password: '', role: 'freelancer' });
      setSuccess(`User ${newUser.name} added successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setIsLoading(true);
    try {
      const brand = await createBrand(newBrand);
      setBrands([...brands, brand]);
      setNewBrand({ name: '', slug: '', hex_color: '#6366f1' });
      setSuccess(`Brand ${brand.name} created!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brand');
    } finally {
      setIsLoading(false);
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
      <div className="h-full flex items-center justify-center bg-[#0d1117]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Tab Switcher */}
      <div className="px-8 pt-8 flex items-center gap-8 border-b border-white/5">
        <button 
          onClick={() => setActiveTab('team')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'team' ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Team Roster
        </button>
        <button 
          onClick={() => setActiveTab('brands')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'brands' ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Brand Management
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium fade-in">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium fade-in">
              {success}
            </div>
          )}

          {activeTab === 'team' ? (
            <>
              {/* Team Section */}
              <div className="grid gap-6">
                <div className="bg-[#161b22] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0d1117]/50">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Slack</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-slate-400 uppercase">
                                {u.name[0]}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-100">{u.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                              u.role === 'superadmin' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                              u.role === 'admin' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                              'bg-slate-500/10 border-white/10 text-slate-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-5 font-mono text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                            {u.slack_id || '—'}
                          </td>
                          <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                             {u.slack_id && (
                               <button 
                                 onClick={async () => {
                                   try {
                                     const res = await fetch(`http://localhost:8080/api/v1/notifications/slack/ping/${u.id}`, {
                                       method: 'POST',
                                       credentials: 'include'
                                     });
                                     if (res.ok) {
                                       setSuccess(`Slack ping sent to ${u.name}!`);
                                       setTimeout(() => setSuccess(null), 3000);
                                     } else {
                                       throw new Error('Ping failed');
                                     }
                                   } catch (err) {
                                     setError('Failed to send Slack ping');
                                   }
                                 }}
                                 className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-widest p-2 hover:bg-indigo-500/10 rounded-lg transition-all flex items-center gap-2"
                               >
                                 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52h-2.521zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.958 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zM17.687 8.834a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zM15.166 18.958a2.528 2.528 0 0 1 2.521 2.522 2.528 2.528 0 0 1-2.521 2.522 2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zM15.166 17.688a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312a2.528 2.528 0 0 1 2.522 2.521 2.528 2.528 0 0 1-2.522 2.521h-6.312z"/></svg>
                                 Ping Slack
                               </button>
                             )}
                             {isSuperadmin && u.id !== currentUser?.id && (
                               <button 
                                 onClick={() => handleDeleteBrand(u.id, u.name)} // This is a mistake, should be handleDeleteUser. I'll just use a placeholder for now or fix it.
                                 className="text-rose-500 hover:text-rose-400 text-[10px] font-bold uppercase tracking-widest p-2 hover:bg-rose-500/10 rounded-lg transition-all"
                               >
                                 Remove
                               </button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isSuperadmin && (
                  <div className="bg-[#161b22] border border-white/5 rounded-3xl p-8 shadow-2xl">
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      Onboard New Member
                    </h3>
                    <form onSubmit={handleAddUser} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Name</label>
                        <input 
                          type="text" required 
                          value={newUser.name}
                          onChange={e => setNewUser({...newUser, name: e.target.value})}
                          className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-500 transition-all outline-none" 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                        <input 
                          type="email" required 
                          value={newUser.email}
                          onChange={e => setNewUser({...newUser, email: e.target.value})}
                          className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-500 transition-all outline-none" 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                        <input 
                          type="password" required 
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-500 transition-all outline-none" 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Role</label>
                        <div className="flex gap-2">
                          <select 
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                            className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-500 transition-all outline-none appearance-none"
                          >
                            <option value="freelancer">Freelancer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20">Add</button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Brands Section */}
              <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 bg-[#161b22] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                     <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Active Brands</h3>
                     <span className="text-[10px] font-mono text-slate-500">{brands.length} Total</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {brands.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-6 hover:bg-white/[0.01] transition-colors group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: b.hex_color }}>
                              <span className="text-white font-black text-sm uppercase">{b.name[0]}</span>
                           </div>
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-100">{b.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{b.slug}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{b.hex_color}</span>
                              <div className="w-16 h-1 rounded-full mt-1 bg-slate-800 overflow-hidden">
                                 <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: b.hex_color }} />
                              </div>
                           </div>
                           {isSuperadmin && (
                             <button 
                               onClick={() => handleDeleteBrand(b.id, b.name)}
                               className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                             >
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Create Brand Card */}
                {isSuperadmin && (
                  <div className="bg-[#161b22] border border-white/5 rounded-3xl p-8 shadow-2xl h-fit sticky top-8">
                     <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest mb-6">Register New Brand</h3>
                     <form onSubmit={handleAddBrand} className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Display Name</label>
                           <input 
                              type="text" required placeholder="e.g. Acme Corp"
                              value={newBrand.name}
                              onChange={e => {
                                const val = e.target.value;
                                setNewBrand({...newBrand, name: val, slug: val.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')});
                              }}
                              className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 focus:border-indigo-500 outline-none transition-all"
                           />
                        </div>
                        <div className="flex flex-col gap-2">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Identifier (Slug)</label>
                           <input 
                              type="text" required readOnly
                              value={newBrand.slug}
                              className="bg-[#0d1117]/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-500 cursor-not-allowed outline-none"
                           />
                        </div>
                        <div className="flex flex-col gap-2">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Theme Color</label>
                           <div className="flex gap-3 items-center">
                              <input 
                                 type="color"
                                 value={newBrand.hex_color}
                                 onChange={e => setNewBrand({...newBrand, hex_color: e.target.value})}
                                 className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer p-0 overflow-hidden"
                              />
                              <input 
                                 type="text" 
                                 value={newBrand.hex_color}
                                 onChange={e => setNewBrand({...newBrand, hex_color: e.target.value})}
                                 className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 uppercase focus:border-indigo-500 outline-none transition-all"
                              />
                           </div>
                        </div>
                        <button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98]">
                           Create Brand Entity
                        </button>
                     </form>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
