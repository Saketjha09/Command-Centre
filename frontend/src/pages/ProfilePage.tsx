import { useState, useRef } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { updateProfile, uploadAvatar } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function ProfilePage() {
  const { user, setUser } = useAuthContext();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMsg(null);

    try {
      const updatedUser = await updateProfile({ name, email });
      setUser(updatedUser);
      setMsg({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMsg(null);
    try {
      const updatedUser = await uploadAvatar(file);
      setUser(updatedUser);
      setMsg({ text: 'Avatar uploaded!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Upload failed', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full p-8 space-y-8">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl overflow-hidden border-2 border-white/5">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url.startsWith('https') ? user.avatar_url : `${BASE_URL}${user.avatar_url}`} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                user.name.slice(0, 2).toUpperCase()
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 bg-[#21262d] rounded-lg border border-white/10 text-slate-400 hover:text-slate-100 shadow-xl transition-all hover:scale-110 active:scale-95 group-hover:border-indigo-500/50"
              title="Upload new avatar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarChange} 
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{user.name}</h1>
            <p className="text-slate-400 font-medium capitalize flex items-center gap-2">
              {user.role}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            </p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-lg font-semibold text-slate-200">Account Settings</h2>
          
          <form onSubmit={handleSave} className="space-y-4">
            {msg && (
              <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${
                msg.type === 'success' 
                  ? 'bg-green-900/20 border-green-500/30 text-green-400' 
                  : 'bg-red-900/20 border-red-500/30 text-red-400'
              }`}>
                {msg.type === 'success' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                )}
                {msg.text}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all hover:border-white/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all hover:border-white/20"
                required
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/10 flex items-center gap-2"
              >
                {isSaving && <LoadingSpinner size="sm" />}
                {isSaving ? 'Updating Profile...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Security & Identity
          </h2>
          <p className="text-sm text-slate-400">Your profile information is visible to other team members within the Freelance Command Center.</p>
          <div className="pt-2">
             <div className="text-xs text-slate-500 uppercase font-semibold">Workspace Identifier</div>
             <div className="text-sm font-mono text-slate-500 mt-1 bg-[#0d1117] p-2.5 rounded-lg">{user.id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
