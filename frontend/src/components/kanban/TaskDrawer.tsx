import { useState, useEffect } from 'react'
import { createTask, fetchTaskById, fetchUsers, assignTask, fetchTaskHistory, fetchBrands } from '../../services/api'
import { LoadingSpinner } from '../LoadingSpinner'
import type { TaskDetail } from '../../types/task'
import type { Brand } from '../../types/brand'

interface Props {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'view'
  taskId: string | null
  initialStatus?: string
  onCreate: (taskData: { 
    title: string; 
    description: string;
    brand: string; 
    priority: string;
    deadline?: string; 
    status?: string 
  }) => Promise<void>
}

const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'medium', label: 'Medium', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'high', label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { id: 'urgent', label: 'Urgent', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
]

export function TaskDrawer({ isOpen, onClose, mode, taskId, initialStatus, onCreate }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [priority, setPriority] = useState('medium')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [assigning, setAssigning] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (isOpen && mode === 'view' && taskId) {
      loadTaskData(taskId)
    } else {
      setTask(null)
      setTitle('')
      setDescription('')
      setDeadline('')
      setBrand(brands[0]?.slug || '')
      setPriority('medium')
      setActiveTab('details')
    }
  }, [isOpen, mode, taskId, brands])

  useEffect(() => {
    if (isOpen) {
      Promise.all([fetchUsers(), fetchBrands()])
        .then(([u, b]) => {
          setUsers(u)
          setBrands(b)
          if (mode === 'create' && b.length > 0) setBrand(b[0].slug)
        })
        .catch(console.error)
    }
  }, [isOpen, mode])

  useEffect(() => {
    if (isOpen && activeTab === 'history' && taskId) {
      loadHistory(taskId)
    }
  }, [isOpen, activeTab, taskId])

  async function loadTaskData(id: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTaskById(id)
      setTask(data)
      setTitle(data.title)
      setDescription(data.description || '')
      setBrand(data.brand)
      setPriority(data.priority)
      setDeadline(data.deadline ? new Date(data.deadline).toISOString().split('T')[0] : '')
    } catch (err: any) {
      setError(err.message ?? 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory(id: string) {
    setLoadingHistory(true)
    try {
      const data = await fetchTaskHistory(id)
      setHistory(data || [])
    } catch (err: any) {
      console.error('History load failed:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleAssign(userId: string) {
    if (!taskId) return
    setAssigning(true)
    try {
      const updated = await assignTask(taskId, userId)
      setTask(updated)
      if (activeTab === 'history') loadHistory(taskId)
    } catch (err: any) {
      setError(err.message ?? 'Failed to assign task')
    } finally {
      setAssigning(false)
    }
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return }
    if (!brand) { setError('Brand is required'); return }
    setLoading(true)
    setError(null)
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        brand,
        priority,
        deadline: deadline || undefined,
        status: initialStatus
      })
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" 
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[90vh] md:h-auto md:max-h-[85vh] bg-[#09090b] border border-[#27272a] z-[101] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 rounded-3xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#18181b] bg-[#09090b]">
           <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                mode === 'create' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
              }`}>
                {mode === 'create' ? 'Quick Add' : (task?.status || '').replace('_', ' ')}
              </div>
              {task?.id && <span className="text-xs font-mono text-[#52525b] tracking-tighter">REF-{task.id.slice(0,6).toUpperCase()}</span>}
           </div>
           <div className="flex items-center gap-2">
              <button onClick={onClose} className="p-2 rounded-xl text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
           </div>
        </div>

        {/* Navigation Tabs */}
        {mode === 'view' && (
          <div className="flex px-8 border-b border-[#18181b] bg-[#09090b]">
            <button 
              onClick={() => setActiveTab('details')}
              className={`px-4 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'details' ? 'border-indigo-500 text-[#fafafa]' : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'}`}
            >
              Details
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'history' ? 'border-indigo-500 text-[#fafafa]' : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'}`}
            >
              Activity
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#09090b]">
           {error && (
             <div className="mb-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {error}
             </div>
           )}

           {loading && mode === 'view' ? (
             <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>
           ) : activeTab === 'details' ? (
             <div className="flex flex-col gap-10">
                {/* Title Section */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-[#52525b] uppercase tracking-[0.2em]">Title</label>
                  <input 
                    value={title} 
                    onChange={e=>setTitle(e.target.value)} 
                    placeholder="Task summary..."
                    className="text-2xl font-bold bg-transparent text-[#fafafa] placeholder-[#27272a] focus:outline-none w-full border-none p-0 focus:ring-0"
                  />
                </div>

                {/* Grid Attributes */}
                <div className="grid md:grid-cols-2 gap-8 py-8 border-y border-[#18181b]">
                   {/* Brand */}
                   <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-[#52525b] uppercase tracking-[0.2em]">Brand</label>
                      <div className="relative group">
                        <select 
                          value={brand} 
                          onChange={e=>setBrand(e.target.value)}
                          className="w-full appearance-none bg-[#18181b] border border-[#27272a] rounded-2xl px-5 py-3.5 text-sm font-bold text-[#fafafa] uppercase tracking-widest hover:border-[#3f3f46] transition-all cursor-pointer"
                        >
                          <option value="" disabled>Select Brand</option>
                          {brands.map(b => (
                            <option key={b.id} value={b.slug}>{b.name}</option>
                          ))}
                        </select>
                        <svg className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 text-[#52525b] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                   </div>

                   {/* Priority */}
                   <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-[#52525b] uppercase tracking-[0.2em]">Priority</label>
                      <div className="flex gap-2">
                        {PRIORITIES.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setPriority(p.id)}
                            className={`flex-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                              priority === p.id ? `${p.bg} ${p.border} ${p.color}` : 'bg-transparent border-[#27272a] text-[#52525b] hover:border-[#3f3f46]'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                   </div>

                   {/* Assignee */}
                   <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-[#52525b] uppercase tracking-[0.2em]">Assignee</label>
                      <div className="relative group">
                        <select 
                          value={task?.assigned_to || ''} 
                          onChange={e=>handleAssign(e.target.value)}
                          disabled={assigning || mode === 'create'}
                          className="w-full appearance-none bg-[#18181b] border border-[#27272a] rounded-2xl px-5 py-3.5 text-sm font-bold text-[#fafafa] uppercase tracking-widest hover:border-[#3f3f46] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">No Assignee</option>
                          {users.filter(u=>u.role==='freelancer').map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <svg className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 text-[#52525b] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      {mode === 'create' && <p className="text-[10px] text-[#52525b] font-medium italic">Assignment available after creation.</p>}
                   </div>

                   {/* Deadline */}
                   <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-[#52525b] uppercase tracking-[0.2em]">Deadline</label>
                      <input 
                        type="date" 
                        value={deadline} 
                        onChange={e=>setDeadline(e.target.value)}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded-2xl px-5 py-3 text-sm font-bold text-[#fafafa] color-scheme-dark hover:border-[#3f3f46] transition-all"
                      />
                   </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-4">
                   <label className="text-[11px] font-bold text-[#52525b] uppercase tracking-[0.2em]">Description</label>
                   <textarea 
                      value={description}
                      onChange={e=>setDescription(e.target.value)}
                      placeholder="Add detailed briefing instructions..."
                      rows={8}
                      className="w-full bg-[#18181b]/50 border border-[#27272a] rounded-3xl p-6 text-sm text-[#a1a1aa] leading-relaxed placeholder-[#3f3f46] focus:outline-none focus:border-indigo-500/30 transition-all resize-none"
                   />
                </div>
             </div>
           ) : (
             <div className="flex flex-col gap-6">
                {loadingHistory ? (
                   <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>
                ) : history.length === 0 ? (
                   <div className="py-20 text-center text-[#52525b] text-sm italic">No history recorded.</div>
                ) : (
                  <div className="flex flex-col gap-8 relative">
                    <div className="absolute left-4 top-4 bottom-4 w-px bg-[#18181b]" />
                    {history.map(act => (
                      <div key={act.id} className="flex gap-6 relative">
                        <div className="w-8 h-8 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[10px] font-bold text-[#fafafa] z-10 shrink-0">
                          {act.user_name?.[0] || '?'}
                        </div>
                        <div className="flex flex-col gap-1.5 pt-1">
                           <p className="text-sm text-[#a1a1aa] leading-relaxed">
                              <span className="font-bold text-[#fafafa]">{act.user_name}</span>
                              {act.action === 'created' && ' created this project'}
                              {act.action === 'assigned' && ` assigned to `}
                              {act.action === 'assigned' && <span className="font-bold text-indigo-400">{users.find(u=>u.id===act.to_value)?.name || act.to_value}</span>}
                              {act.action === 'status_change' && ` moved status to `}
                              {act.action === 'status_change' && <span className="font-bold text-emerald-400 uppercase tracking-widest text-[10px]">{act.to_value}</span>}
                           </p>
                           <span className="text-[10px] font-mono text-[#3f3f46] uppercase">{new Date(act.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-[#18181b] flex items-center justify-end gap-4 bg-[#09090b]">
           <button onClick={onClose} className="px-6 py-3 rounded-2xl text-sm font-bold text-[#52525b] hover:text-[#fafafa] transition-colors uppercase tracking-widest">Discard</button>
           <button 
             onClick={handleSubmit} 
             disabled={loading || !title.trim()}
             className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
           >
             {loading ? <LoadingSpinner size="sm" /> : mode === 'create' ? 'Launch Project' : 'Save Changes'}
           </button>
        </div>
      </div>
    </>
  )
}
