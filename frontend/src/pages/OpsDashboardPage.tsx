import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchOpsTasks, createOpsTask, fetchTeamMembers } from '../services/opsService'
import { fetchBrands } from '../services/api'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { OpsTask, OpsTaskStatus, TeamMember } from '../types/ops'
import type { Brand } from '../types/brand'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const STATUS_BADGE: Record<OpsTaskStatus, { bg: string; label: string }> = {
  assigned: { bg: '#1f6feb', label: 'Assigned' },
  in_progress: { bg: '#d29922', label: 'In Progress' },
  done: { bg: '#238636', label: 'Done' },
}

interface CreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (assigneeName: string) => void
  brands: Brand[]
  members: TeamMember[]
}

function CreateTaskModal({ isOpen, onClose, onCreated, brands, members }: CreateModalProps) {
  const [brandId, setBrandId] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brief, setBrief] = useState('')
  const [sheetLink, setSheetLink] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setBrandId('')
      setBrandName('')
      setBrief('')
      setSheetLink('')
      setAssigneeId('')
      setError('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBrandChange = (id: string) => {
    setBrandId(id)
    const b = brands.find(b => b.id === id)
    setBrandName(b?.name ?? '')
  }

  const handleSubmit = async () => {
    if (!brief.trim()) { setError('Brief is required'); return }
    if (!assigneeId) { setError('Please select an assignee'); return }
    if (!brandName) { setError('Please select a brand'); return }

    setSubmitting(true)
    setError('')
    try {
      await createOpsTask({
        brand_id: brandId || undefined,
        brand_name: brandName,
        brief: brief.trim(),
        sheet_link: sheetLink.trim(),
        assignee_id: assigneeId,
      })
      const member = members.find(m => m.id === assigneeId)
      onCreated(member?.name ?? 'team member')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,17,23,0.80)' }}>
      <div
        className="w-full max-w-[560px] rounded-2xl p-6 flex flex-col gap-5 shadow-2xl"
        style={{ background: '#161b22', border: '1px solid #30363d' }}
      >
        <h2 className="text-lg font-bold" style={{ color: '#e6edf3' }}>Assign Task</h2>

        {/* Brand */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Brand</label>
          <select
            value={brandId}
            onChange={e => handleBrandChange(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', focusRingColor: '#1f6feb' } as any}
          >
            <option value="">Select brand...</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* Brief */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Task Brief</label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="Paste the task brief, reference, script link, or instructions exactly as you'd send on WhatsApp..."
            rows={5}
            className="rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', minHeight: 120 }}
          />
        </div>

        {/* Sheet Link */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Sheet Link</label>
          <input
            type="text"
            value={sheetLink}
            onChange={e => setSheetLink(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/..."
            className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
          />
        </div>

        {/* Assignee */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>Assign To</label>
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3' }}
          >
            <option value="">Select team member...</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: '#da3633' }}>{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ color: '#8b949e', border: '1px solid #30363d' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors"
            style={{ background: '#1f6feb' }}
          >
            {submitting ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OpsDashboardPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin' || role === 'superadmin'

  const [tasks, setTasks] = useState<OpsTask[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  const [brandFilter, setBrandFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | OpsTaskStatus>('all')
  const [expandedBrief, setExpandedBrief] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [t, b, m] = await Promise.all([fetchOpsTasks(), fetchBrands(), fetchTeamMembers()])
      setTasks(t)
      setBrands(b)
      setMembers(m)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(() => { fetchOpsTasks().then(setTasks).catch(console.error) }, 30000)
    return () => clearInterval(interval)
  }, [])

  const uniqueBrands = useMemo(() => [...new Set(tasks.map(t => t.brand_name))].sort(), [tasks])
  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, string>()
    tasks.forEach(t => map.set(t.assignee_id, t.assignee_name))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [tasks])

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (brandFilter !== 'all' && t.brand_name !== brandFilter) return false
      if (assigneeFilter !== 'all' && t.assignee_id !== assigneeFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      return true
    })
  }, [tasks, brandFilter, assigneeFilter, statusFilter])

  const handleCreated = (name: string) => {
    setModalOpen(false)
    setToast(`Task assigned to ${name}`)
    setTimeout(() => setToast(''), 3000)
    void loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#0d1117' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0d1117' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #30363d' }}>
        <h2 className="text-lg font-bold" style={{ color: '#e6edf3' }}>Ops Dashboard</h2>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors"
            style={{ background: '#1f6feb' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Assign Task
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4 px-6 py-3 flex-wrap" style={{ borderBottom: '1px solid #21262d' }}>
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
        >
          <option value="all">All Brands</option>
          {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
        >
          <option value="all">All People</option>
          {uniqueAssignees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <div className="flex gap-1 rounded-lg p-1" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          {(['all', 'assigned', 'in_progress', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
              style={{
                background: statusFilter === s ? '#1f6feb' : 'transparent',
                color: statusFilter === s ? '#fff' : '#8b949e',
              }}
            >
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs font-medium" style={{ color: '#8b949e' }}>
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <svg className="w-12 h-12" style={{ color: '#8b949e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium" style={{ color: '#8b949e' }}>No tasks yet. Assign the first one.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(task => {
              const badge = STATUS_BADGE[task.status]
              const isExpanded = expandedBrief === task.id
              return (
                <div
                  key={task.id}
                  className="rounded-xl p-4 transition-colors cursor-pointer"
                  style={{ background: '#161b22', border: '1px solid #30363d' }}
                  onClick={() => setExpandedBrief(isExpanded ? null : task.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>{task.assignee_name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{ background: '#21262d', color: '#8b949e' }}
                        >
                          {task.assignee_role}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: '#8b949e' }}>{task.brand_name}</span>
                    </div>
                    <span
                      className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase"
                      style={{ background: badge.bg }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <p
                    className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}
                    style={{ color: '#e6edf3' }}
                  >
                    {task.brief}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {task.sheet_link && (
                        <a
                          href={task.sheet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
                          style={{ background: '#21262d', color: '#1f6feb', border: '1px solid #30363d' }}
                        >
                          Open Sheet
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: '#8b949e' }}>{timeAgo(task.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-4"
          style={{ background: '#238636' }}
        >
          {toast}
        </div>
      )}

      <CreateTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        brands={brands}
        members={members}
      />
    </div>
  )
}
