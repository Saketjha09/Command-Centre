import { useState, useEffect } from 'react'
import { createTask, fetchTaskById, fetchUsers, assignTask, fetchTaskHistory, fetchBrands } from '../../services/api'
import { LoadingSpinner } from '../LoadingSpinner'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { RichTextEditor } from '../RichTextEditor'
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
    status?: string;
    payoutAmount?: number;
    content_type: string;
    assigned_to?: string;
  }) => Promise<void>
}

const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
  { id: 'medium', label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { id: 'high', label: 'High', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  { id: 'urgent', label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
]

export function TaskDrawer({ isOpen, onClose, mode, taskId, initialStatus, onCreate }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [priority, setPriority] = useState('medium')
  const [deadline, setDeadline] = useState('')
  const [payoutAmount, setPayoutAmount] = useState<string>('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [contentType, setContentType] = useState('script')
  const [assignedTo, setAssignedTo] = useState('')
  const [creationStep, setCreationStep] = useState(0)
  
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
      setPayoutAmount('0')
      setBrand(brands[0]?.slug || '')
      setPriority('medium')
      setContentType('script')
      setAssignedTo('')
      setCreationStep(0)
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
      setPayoutAmount(data.payout_amount?.toString() || '0')
      setContentType(data.content_type || 'script')
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
        status: initialStatus,
        payoutAmount: parseFloat(payoutAmount) || 0,
        content_type: contentType,
        assigned_to: assignedTo || undefined
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
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[100] animate-in fade-in duration-300" 
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[750px] h-[90vh] md:h-auto md:max-h-[85vh] bg-white border border-gray-200 z-[101] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 rounded-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white">
           <div className="flex items-center gap-4">
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                mode === 'create' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}>
                {mode === 'create' ? 'Draft' : (task?.status || '').replace('_', ' ')}
              </div>
              {task?.id && <span className="text-[11px] font-mono text-gray-400 tracking-tight">PROJECT-{task.id.slice(0,6).toUpperCase()}</span>}
           </div>
           <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
           </button>
        </div>

        {/* Navigation Tabs */}
        {mode === 'view' && (
          <div className="flex px-8 border-b border-gray-100 bg-white">
            <button 
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Activity
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
           {error && (
             <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                {error}
             </div>
           )}

           {loading && mode === 'view' ? (
             <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>
           ) : activeTab === 'details' ? (
             <div className="flex flex-col gap-8">
                {mode === 'create' && creationStep === 0 ? (
                  <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Project Name</label>
                      <input 
                        value={title} 
                        onChange={e=>setTitle(e.target.value)} 
                        placeholder="e.g. Q4 Growth Campaign"
                        className="text-2xl font-bold bg-transparent text-gray-900 placeholder-gray-200 focus:outline-none w-full border-none p-0 focus:ring-0"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-50">
                      <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Type</label>
                        <div className="flex gap-2">
                          {['script', 'video_edit', 'other'].map(t => (
                            <button
                              key={t}
                              onClick={() => setContentType(t)}
                              className={`flex-1 py-2 rounded-md border text-[10px] font-bold transition-all ${
                                contentType === t ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {t.replace('_', ' ').toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Brand</label>
                        <select 
                          value={brand} 
                          onChange={e=>setBrand(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] font-medium text-gray-900 hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                        >
                          {brands.map(b => <option key={b.id} value={b.slug}>{b.name}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Assignee</label>
                        <select 
                          value={assignedTo} 
                          onChange={e=>setAssignedTo(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] font-medium text-gray-900 hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                        >
                          <option value="">Unassigned</option>
                          {users.filter(u=>u.role==='freelancer').map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Due Date</label>
                        <input 
                          type="date" 
                          value={deadline} 
                          onChange={e=>setDeadline(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] font-medium text-gray-900 hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Title</label>
                      <input 
                        value={title} 
                        onChange={e=>setTitle(e.target.value)} 
                        placeholder="Task summary..."
                        className="text-2xl font-bold bg-transparent text-gray-900 placeholder-gray-200 focus:outline-none w-full border-none p-0 focus:ring-0"
                        disabled={mode === 'view'}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 py-8 border-y border-gray-50">
                       <div className="flex flex-col gap-3">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Brand</label>
                          <select 
                            value={brand} 
                            onChange={e=>setBrand(e.target.value)}
                            disabled={mode === 'view'}
                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] font-medium text-gray-900 disabled:opacity-60"
                          >
                            {brands.map(b => <option key={b.id} value={b.slug}>{b.name}</option>)}
                          </select>
                       </div>

                       <div className="flex flex-col gap-3">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Priority</label>
                          <div className="flex gap-1.5">
                            {PRIORITIES.map(p => (
                              <button
                                key={p.id}
                                onClick={() => setPriority(p.id)}
                                disabled={mode === 'view'}
                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${
                                  priority === p.id 
                                    ? `${p.bg} ${p.color} ${p.border}` 
                                    : 'bg-white border-gray-100 text-gray-400'
                                }`}
                              >
                                {p.label.toUpperCase()}
                              </button>
                            ))}
                          </div>
                       </div>

                       <div className="flex flex-col gap-3">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Assignee</label>
                          <select 
                            value={task?.assigned_to || assignedTo || ''} 
                            onChange={e => mode === 'view' ? handleAssign(e.target.value) : setAssignedTo(e.target.value)}
                            disabled={assigning}
                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] font-medium text-gray-900 disabled:opacity-60"
                          >
                            <option value="">No Assignee</option>
                            {users.filter(u=>u.role==='freelancer').map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                       </div>

                       <div className="flex flex-col gap-3">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Due Date</label>
                          <input 
                            type="date" 
                            value={deadline} 
                            onChange={e=>setDeadline(e.target.value)}
                            disabled={mode === 'view'}
                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] font-medium text-gray-900 disabled:opacity-60"
                          />
                       </div>
                    </div>

                    <div className="flex flex-col gap-4">
                       <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Project Briefing</label>
                       {mode === 'view' ? (
                         <div className="w-full bg-gray-50 border border-gray-100 rounded-xl p-8 min-h-[300px]">
                            <article className="prose prose-sm max-w-none prose-slate prose-headings:font-bold prose-a:text-indigo-600">
                              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{description || '_No description provided._'}</ReactMarkdown>
                            </article>
                         </div>
                       ) : (
                         <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
                            <RichTextEditor 
                                content={description}
                                onChange={setDescription}
                                placeholder="Add detailed briefing instructions..."
                            />
                         </div>
                       )}
                    </div>
                  </div>
                )}
             </div>
           ) : (
             <div className="flex flex-col gap-6">
                {loadingHistory ? (
                   <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>
                ) : history.length === 0 ? (
                   <div className="py-20 text-center text-gray-400 text-xs italic">No activity recorded.</div>
                ) : (
                  <div className="flex flex-col gap-6 relative px-4">
                    <div className="absolute left-7 top-4 bottom-4 w-0.5 bg-gray-100" />
                    {history.map(act => (
                      <div key={act.id} className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 z-10 shrink-0">
                          {act.user_name?.[0] || '?'}
                        </div>
                        <div className="flex flex-col gap-1 pt-1.5">
                           <p className="text-[13px] text-gray-600">
                              <span className="font-bold text-gray-900">{act.user_name}</span>
                              {act.action === 'created' && ' created this project'}
                              {act.action === 'assigned' && ` assigned to `}
                              {act.action === 'assigned' && <span className="font-bold text-gray-900">{users.find(u=>u.id===act.to_value)?.name || act.to_value}</span>}
                              {act.action === 'status_change' && ` moved to `}
                              {act.action === 'status_change' && <span className="font-bold text-gray-900 uppercase tracking-widest text-[10px]">{act.to_value}</span>}
                           </p>
                           <span className="text-[11px] text-gray-400">{new Date(act.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
           <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">Discard</button>
           
           {mode === 'create' && creationStep === 0 ? (
             <button 
               onClick={() => setCreationStep(1)}
               disabled={!title.trim() || !brand}
               className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
             >
               Next: Briefing
             </button>
           ) : (
             <div className="flex gap-3">
               {mode === 'create' && (
                 <button onClick={() => setCreationStep(0)} className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-900">Back</button>
               )}
               <button 
                 onClick={handleSubmit} 
                 disabled={loading || !title.trim()}
                 className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
               >
                 {loading ? <LoadingSpinner size="sm" /> : mode === 'create' ? 'Create Project' : 'Save Changes'}
               </button>
             </div>
           )}
        </div>
      </div>
    </>
  )
}
