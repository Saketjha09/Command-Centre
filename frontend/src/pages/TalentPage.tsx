import { useState, useEffect } from 'react'
import { fetchUsers, fetchTasks } from '../services/api'
import { getRates } from '../services/payrollService'
import type { EditorRate } from '../services/payrollService'
import type { User } from '../types/auth'
import type { TaskSummary } from '../types/task'
import { LoadingSpinner } from '../components/LoadingSpinner'

type Tab = 'roster' | 'assignments' | 'rates'

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
      style={
        active
          ? {
              color: 'var(--color-accent-success)',
              borderColor: 'var(--color-accent-success)',
              background: 'rgba(63,185,80,0.08)',
            }
          : {
              color: 'var(--color-text-muted)',
              borderColor: 'var(--color-border-default)',
              background: 'var(--color-bg-tertiary)',
            }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? 'var(--color-accent-success)' : 'var(--color-text-muted)' }}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RolePill({ role }: { role: string }) {
  const styles: Record<string, React.CSSProperties> = {
    superadmin: {
      color: 'var(--color-accent-secondary)',
      borderColor: 'var(--color-accent-secondary)',
      background: 'rgba(99,102,241,0.08)',
    },
    admin: {
      color: 'var(--color-accent-primary)',
      borderColor: 'var(--color-accent-primary)',
      background: 'rgba(88,166,255,0.08)',
    },
    freelancer: {
      color: 'var(--color-text-secondary)',
      borderColor: 'var(--color-border-emphasis)',
      background: 'var(--color-bg-tertiary)',
    },
  }
  const s = styles[role] ?? styles.freelancer
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
      style={s}
    >
      {role}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-3"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-[12px] font-semibold uppercase tracking-widest">{message}</p>
    </div>
  )
}

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr style={{ background: 'var(--color-bg-secondary)' }}>
        {columns.map((col) => (
          <th
            key={col}
            className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-default)' }}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ── Tab 1: Roster ─────────────────────────────────────────────────────────────

function RosterTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load roster'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (error) return <p className="text-center py-12 text-[13px]" style={{ color: 'var(--color-accent-danger)' }}>{error}</p>
  if (users.length === 0) return <EmptyState message="No team members yet" />

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--color-border-default)' }}>
      <table className="w-full text-left border-collapse">
        <TableHeader columns={['Name', 'Role', 'Email', 'Status']} />
        <tbody>
          {users.map((u, i) => (
            <tr
              key={u.id}
              className="transition-colors group"
              style={{
                borderBottom: i < users.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                opacity: u.is_active ? 1 : 0.6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black uppercase shrink-0"
                    style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-secondary)' }}
                  >
                    {u.name?.[0] ?? '?'}
                  </div>
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {u.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4"><RolePill role={u.role} /></td>
              <td className="px-6 py-4 text-[12px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {u.email}
              </td>
              <td className="px-6 py-4"><StatusPill active={u.is_active} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab 2: Assignments ────────────────────────────────────────────────────────

function AssignmentsTab() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')

  useEffect(() => {
    Promise.all([fetchTasks(), fetchUsers()])
      .then(([t, u]) => { setTasks(t); setUsers(u) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load assignments'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (error) return <p className="text-center py-12 text-[13px]" style={{ color: 'var(--color-accent-danger)' }}>{error}</p>

  const freelancers = users.filter((u) => u.role === 'freelancer')
  const filtered = assigneeFilter
    ? tasks.filter((t) => t.assigned_to === assigneeFilter)
    : tasks

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'

  const formatDeadline = (d: string) => {
    if (!d) return '—'
    const date = new Date(d)
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
  }

  const STATUS_COLORS: Record<string, React.CSSProperties> = {
    unassigned: { color: 'var(--color-text-muted)', borderColor: 'var(--color-border-emphasis)', background: 'var(--color-bg-tertiary)' },
    assigned: { color: 'var(--color-accent-secondary)', borderColor: 'var(--color-accent-secondary)', background: 'rgba(99,102,241,0.08)' },
    in_progress: { color: 'var(--color-accent-primary)', borderColor: 'var(--color-accent-primary)', background: 'rgba(88,166,255,0.08)' },
    in_review: { color: 'var(--color-accent-warning)', borderColor: 'var(--color-accent-warning)', background: 'rgba(210,153,34,0.08)' },
    done: { color: 'var(--color-accent-success)', borderColor: 'var(--color-accent-success)', background: 'rgba(63,185,80,0.08)' },
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Assignee filter */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
          Filter by Assignee
        </label>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-[12px] font-medium focus:outline-none border"
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            borderColor: 'var(--color-border-default)',
          }}
        >
          <option value="">All Assignees</option>
          {freelancers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No assignments found" />
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--color-border-default)' }}>
          <table className="w-full text-left border-collapse">
            <TableHeader columns={['Task Name', 'Assigned To', 'Brand', 'Status', 'Due Date']} />
            <tbody>
              {filtered.map((t, i) => {
                const statusStyle = STATUS_COLORS[t.status] ?? STATUS_COLORS.unassigned
                return (
                  <tr
                    key={t.id}
                    className="transition-colors"
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-6 py-4 text-[13px] font-semibold max-w-[260px] truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {t.title}
                    </td>
                    <td className="px-6 py-4 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {t.assigned_to ? getUserName(t.assigned_to) : <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-emphasis)', background: 'var(--color-bg-tertiary)' }}
                      >
                        {t.brand || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                        style={statusStyle}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[12px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDeadline(t.deadline)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Rates ──────────────────────────────────────────────────────────────

function RatesTab() {
  const [rates, setRates] = useState<EditorRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRates()
      .then(setRates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load rates'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (error) return <p className="text-center py-12 text-[13px]" style={{ color: 'var(--color-accent-danger)' }}>{error}</p>
  if (rates.length === 0) return <EmptyState message="No rates configured yet" />

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--color-border-default)' }}>
      <table className="w-full text-left border-collapse">
        <TableHeader columns={['Freelancer', 'Content Type', 'Rate', 'Last Updated']} />
        <tbody>
          {rates.map((r, i) => (
            <tr
              key={`${r.editor_id}-${r.content_type}`}
              className="transition-colors"
              style={{ borderBottom: i < rates.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="px-6 py-4 text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {r.editor_name ?? <span style={{ color: 'var(--color-text-muted)' }} className="font-mono text-[11px]">{r.editor_id.slice(0, 8)}…</span>}
              </td>
              <td className="px-6 py-4">
                <span
                  className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border"
                  style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-emphasis)', background: 'var(--color-bg-tertiary)' }}
                >
                  {r.content_type.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--color-accent-success)' }}>
                  ₹{r.rate.toLocaleString()}
                </span>
              </td>
              <td className="px-6 py-4 text-[12px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(r.updated_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'rates', label: 'Rates' },
]

export function TalentPage() {
  const [activeTab, setActiveTab] = useState<Tab>('roster')

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
    >
      {/* Header + Tab Bar */}
      <div
        className="px-10 pt-10 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-muted)' }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Talent
          </h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Team roster, task assignments, and rate overview.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="pb-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all border-b-2"
              style={
                activeTab === tab.id
                  ? { color: 'var(--color-accent-primary)', borderColor: 'var(--color-accent-primary)' }
                  : { color: 'var(--color-text-muted)', borderColor: 'transparent' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'roster' && <RosterTab />}
          {activeTab === 'assignments' && <AssignmentsTab />}
          {activeTab === 'rates' && <RatesTab />}
        </div>
      </div>
    </div>
  )
}
