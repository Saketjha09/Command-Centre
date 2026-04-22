import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchTasks, fetchGlobalActivity, fetchUsers, fetchBrands } from '../services/api'
import { fetchTodayAvailability } from '../services/availabilityApi'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { TaskSummary } from '../types/task'
import type { AvailabilityRecord } from '../types/availability'
import type { Brand } from '../types/brand'

interface Props {
  onNavigate: (view: string) => void
}

export function DashboardPage({ onNavigate }: Props) {
  const { name } = useAuth()
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchTasks(),
      fetchTodayAvailability(),
      fetchGlobalActivity(),
      fetchUsers(),
      fetchBrands()
    ])
      .then(([t, a, act, u, b]) => {
        setTasks(t)
        setAvailability(a)
        setActivity(act)
        setUsers(u)
        setBrands(b)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' 
    : hour < 17 ? 'Good afternoon' : 'Good evening'

  const activeTasks = tasks.filter(t => 
    t.status !== 'approved' && t.status !== 'paid')
  
  const overdueTasks = tasks.filter(t => 
    t.deadline && new Date(t.deadline) < now 
    && t.status !== 'approved' && t.status !== 'paid')
  
  const reviewTasks = tasks.filter(t => 
    t.status === 'review')
  
  const needsAttention = tasks.filter(t =>
    (t.deadline && new Date(t.deadline) < now) ||
    t.status === 'review' ||
    t.assigned_to === null
  ).slice(0, 5)

  // Group availability by user
  const userMap = availability.reduce((acc, r) => {
    if (!acc[r.user_id]) acc[r.user_id] = []
    acc[r.user_id].push(r)
    return acc
  }, {} as Record<string, AvailabilityRecord[]>)

  const availableToday = Object.values(userMap).filter(slots =>
    slots.some(s => s.is_available)
  ).length

  const stats = [
    {
      label: 'ACTIVE TASKS',
      value: activeTasks.length,
      sub: `${[...new Set(activeTasks.map(t=>t.brand))].length} Brands active`,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      onClick: () => onNavigate('board')
    },
    {
      label: 'OVERDUE',
      value: overdueTasks.length,
      sub: overdueTasks.length > 0 ? 'Action required' : 'On schedule',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      onClick: () => onNavigate('board')
    },
    {
      label: 'PENDING REVIEW',
      value: reviewTasks.length,
      sub: 'Awaiting approval',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      onClick: () => onNavigate('board')
    },
    {
      label: 'TEAM ONLINE',
      value: `${availableToday}/${users.filter(u=>u.role==='freelancer').length}`,
      sub: 'Ready for assignment',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      onClick: () => onNavigate('availability')
    },
  ]

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-[#09090b]">
      <LoadingSpinner size="lg" />
    </div>
  )

  return (
    <div className="flex flex-col gap-8 p-8 h-full overflow-y-auto custom-scrollbar bg-[#09090b]">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[#71717a] text-[10px] font-bold uppercase tracking-[0.2em]">
           <span>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
           <span className="w-1 h-1 rounded-full bg-[#27272a]" />
           <span>Operational Overview</span>
        </div>
        <h1 className="text-4xl font-bold text-[#fafafa] tracking-tight">
          {greeting}, {name.split(' ')[0]}
        </h1>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={stat.onClick}
            className={`flex flex-col gap-4 p-6 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.98] text-left group bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] shadow-lg`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#fafafa] font-mono tracking-tighter">{stat.value}</span>
            </div>
            <span className="text-xs text-[#71717a] font-medium group-hover:text-[#a1a1aa] transition-colors">{stat.sub}</span>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Needs Attention & Recent Activity */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Priority Tasks */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.2em]">Priority Action Items</h2>
              <button onClick={() => onNavigate('board')} className="text-[#4f46e5] text-[11px] font-bold uppercase tracking-widest hover:text-[#6366f1] transition-colors">View All →</button>
            </div>
            <div className="grid gap-3">
              {needsAttention.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-[#71717a] text-sm font-medium">Clear skies! Nothing needs immediate attention.</p>
                </div>
              ) : needsAttention.map(task => {
                const brandMeta = brands.find(b => b.slug === task.brand);
                return (
                <div 
                  key={task.id}
                  onClick={() => onNavigate('board')}
                  className="flex items-center justify-between p-5 bg-[#18181b] border border-[#27272a] rounded-2xl hover:border-[#3f3f46] transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-4">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandMeta?.hex_color || '#475569' }} />
                     <div>
                        <div className="text-sm font-bold text-[#fafafa] group-hover:text-[#4f46e5] transition-colors">{task.title}</div>
                        <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-widest mt-0.5">{brandMeta?.name || task.brand.replace('_', ' ')}</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        task.status === 'review' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                        task.assigned_to === null ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 
                        'bg-[#27272a] border-[#3f3f46] text-[#a1a1aa]'
                     }`}>
                        {(task.status || '').replace('_', ' ')}
                     </div>
                     <svg className="w-4 h-4 text-[#3f3f46] group-hover:text-[#a1a1aa] transition-all translate-x-0 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                     </svg>
                  </div>
                </div>
              )})}
            </div>
          </section>

          {/* Activity Feed */}
          <section className="flex flex-col gap-4">
            <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.2em]">Recent Activity</h2>
            <div className="flex flex-col gap-4 bg-[#18181b]/50 border border-[#27272a] rounded-2xl p-6">
              {activity.length === 0 ? (
                 <p className="text-[#71717a] text-sm italic">No recent activity recorded.</p>
              ) : activity.map((act, i) => (
                <div key={act.id} className="flex gap-4 relative">
                  {i !== activity.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-[#27272a]" />}
                  <div className="w-8 h-8 rounded-lg bg-[#27272a] border border-[#3f3f46] flex items-center justify-center text-xs font-bold text-[#fafafa] shrink-0 z-10 uppercase">
                    {act.user_name?.[0] || '?'}
                  </div>
                  <div className="flex flex-col gap-1 pb-4">
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">
                      <span className="font-bold text-[#fafafa]">{act.user_name || 'System'}</span> 
                      {act.action === 'created' && ' created a new task '}
                      {act.action === 'assigned' && ' assigned a task '}
                      {act.action === 'status_change' && ` moved task to `}
                      {act.action === 'status_change' && <span className="font-bold text-[#4f46e5] uppercase tracking-widest text-[9px] bg-[#4f46e5]/10 px-2 py-0.5 rounded ml-1">{act.to_value}</span>}
                    </p>
                    <span className="text-[10px] text-[#52525b] font-mono">{new Date(act.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="flex flex-col gap-8">
           {/* Team Online Widget */}
           <section className="flex flex-col gap-4">
              <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.2em]">Active Now</h2>
              <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-lg">
                <div className="p-6 flex flex-col gap-5">
                  {users.filter(u=>u.role==='freelancer').slice(0, 6).map(user => {
                    const isAvail = availability.some(r => r.user_id === user.id && r.is_available);
                    return (
                      <div key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-lg bg-[#27272a] border border-[#3f3f46] flex items-center justify-center text-xs font-bold text-[#fafafa] uppercase">
                              {user.name[0]}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#18181b] ${isAvail ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-[#3f3f46]'}`} />
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-[#fafafa]">{user.name}</div>
                            <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider">Freelancer</div>
                          </div>
                        </div>
                        <button onClick={() => onNavigate('availability')} className="text-[10px] text-[#71717a] hover:text-[#4f46e5] font-bold uppercase tracking-widest transition-colors">View</button>
                      </div>
                    )
                  })}
                </div>
                <button 
                  onClick={() => onNavigate('availability')}
                  className="w-full py-4 bg-[#09090b]/50 text-[10px] font-bold text-[#71717a] uppercase tracking-[0.2em] hover:text-[#fafafa] hover:bg-[#09090b] transition-all border-t border-[#27272a]"
                >
                  View Full Roster
                </button>
              </div>
           </section>

           {/* Brand Distribution */}
           <section className="flex flex-col gap-4">
              <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.2em]">Workload by Brand</h2>
              <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 flex flex-col gap-6 shadow-lg">
                 {brands.map(b => {
                   const brandTasks = tasks.filter(t => t.brand === b.slug && t.status !== 'approved' && t.status !== 'paid');
                   const percent = tasks.length > 0 ? (brandTasks.length / tasks.length) * 100 : 0;
                   return (
                     <div key={b.id} className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">{b.name}</span>
                          <span className="text-xs font-bold text-[#fafafa] tabular-nums">{brandTasks.length}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#27272a] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000`} style={{ width: `${percent}%`, backgroundColor: b.hex_color }} />
                        </div>
                     </div>
                   )
                 })}
              </div>
           </section>
        </div>
      </div>
    </div>
  )
}
