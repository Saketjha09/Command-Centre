import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchTasks, fetchGlobalActivity, fetchUsers, fetchBrands, fetchDashboardMetrics } from '../services/api'
import { fetchTodayAvailability } from '../services/availabilityApi'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { TaskSummary } from '../types/task'
import type { AvailabilityRecord } from '../types/availability'
import type { Brand } from '../types/brand'
import { AdminAvailabilityGrid } from '../components/availability/AdminAvailabilityGrid'
import { TaskBoard } from '../components/tasks/TaskBoard'

interface Props {
  onNavigate: (view: string) => void
}

const Icons = {
  ActiveTasks: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2" />
    </svg>
  ),
  Overdue: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Review: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Team: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

export function DashboardPage({ onNavigate }: Props) {
  const { name } = useAuth()
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchTasks(),
      fetchTodayAvailability(),
      fetchGlobalActivity(),
      fetchUsers(),
      fetchBrands(),
      fetchDashboardMetrics()
    ])
      .then(([t, a, act, u, b, m]) => {
        setTasks(t)
        setAvailability(a)
        setActivity(act)
        setUsers(u)
        setBrands(b)
        setMetrics(m.metrics || [])
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
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      icon: Icons.ActiveTasks,
      onClick: () => onNavigate('board')
    },
    {
      label: 'OVERDUE',
      value: overdueTasks.length,
      sub: overdueTasks.length > 0 ? 'Action required' : 'On schedule',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
      icon: Icons.Overdue,
      onClick: () => onNavigate('board')
    },
    {
      label: 'PENDING REVIEW',
      value: reviewTasks.length,
      sub: 'Awaiting approval',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      icon: Icons.Review,
      onClick: () => onNavigate('board')
    },
    {
      label: 'TEAM ONLINE',
      value: `${availableToday}/${users.filter(u=>u.role==='freelancer').length}`,
      sub: 'Ready for assignment',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
      icon: Icons.Team,
      onClick: () => onNavigate('availability')
    },
  ]

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-white">
      <LoadingSpinner size="lg" />
    </div>
  )

  return (
    <div className="flex flex-col gap-10 p-10 h-full overflow-y-auto custom-scrollbar bg-white">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold uppercase tracking-[0.2em]">
           <span>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
           <span className="w-1 h-1 rounded-full bg-gray-200" />
           <span>System Dashboard</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          {greeting}, {name.split(' ')[0]}
        </h1>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={stat.onClick}
            className={`flex flex-col gap-3 p-6 rounded-2xl border transition-all hover:shadow-lg active:scale-[0.98] text-left bg-white ${stat.border} shadow-sm group`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
              <stat.icon />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900 tabular-nums">{stat.value}</span>
            </div>
            <span className="text-[12px] text-gray-500 font-medium group-hover:text-gray-700 transition-colors">{stat.sub}</span>
          </button>
        ))}
      </div>

      {/* Content Metrics */}
      <section className="flex flex-col gap-5">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Team Output</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.length === 0 ? (
            <div className="col-span-full p-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-gray-400 text-sm">No production data available for this cycle.</p>
            </div>
          ) : metrics.map(m => (
            <div key={m.user_name} className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">{m.user_name[0]}</div>
                <span className="text-[13px] font-bold text-gray-900">{m.user_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Scripts</span>
                  <span className="text-xl font-bold text-gray-900 tabular-nums">{m.counts.script || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Videos</span>
                  <span className="text-xl font-bold text-gray-900 tabular-nums">{m.counts.video_edit || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-10">
        {/* Priority Items */}
        <div className="lg:col-span-2 flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Action Required</h2>
              <button onClick={() => onNavigate('board')} className="text-indigo-600 text-[11px] font-bold uppercase tracking-widest hover:underline transition-all">All Tasks →</button>
            </div>
            <div className="space-y-3">
              {needsAttention.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                  <p className="text-gray-400 text-sm">Everything is currently on track.</p>
                </div>
              ) : needsAttention.map(task => {
                const brandMeta = brands.find(b => b.slug === task.brand);
                return (
                <div 
                  key={task.id}
                  onClick={() => onNavigate('board')}
                  className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                     <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandMeta?.hex_color || '#e2e8f0' }} />
                     <div>
                        <div className="text-[14px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{task.title}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{brandMeta?.name || task.brand.replace('_', ' ')}</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                        task.status === 'review' ? 'bg-orange-50 border-orange-100 text-orange-600' : 
                        task.assigned_to === null ? 'bg-red-50 border-red-100 text-red-600' : 
                        'bg-gray-50 border-gray-100 text-gray-400'
                     }`}>
                        {(task.status || '').replace('_', ' ')}
                     </div>
                     <svg className="w-4 h-4 text-gray-200 group-hover:text-indigo-600 transition-all translate-x-0 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                     </svg>
                  </div>
                </div>
              )})}
            </div>
          </section>

          {/* Activity Feed */}
          <section className="flex flex-col gap-5">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Recent Activity</h2>
            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-8 flex flex-col gap-6">
              {activity.length === 0 ? (
                 <p className="text-gray-400 text-sm italic">No recent activity detected.</p>
              ) : activity.map((act, i) => (
                <div key={act.id} className="flex gap-5 relative">
                  {i !== activity.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-100" />}
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-700 shrink-0 z-10 shadow-sm uppercase">
                    {act.user_name?.[0] || '?'}
                  </div>
                  <div className="flex flex-col gap-1 pb-6">
                    <p className="text-[13px] text-gray-600 leading-relaxed">
                      <span className="font-bold text-gray-900">{act.user_name || 'System'}</span> 
                      {act.action === 'created' && ' created a new project '}
                      {act.action === 'assigned' && ' assigned a task '}
                      {act.action === 'status_change' && ` moved project to `}
                      {act.action === 'status_change' && <span className="font-bold text-indigo-600 uppercase tracking-widest text-[9px] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded ml-1">{act.to_value}</span>}
                    </p>
                    <span className="text-[11px] text-gray-400">{new Date(act.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="flex flex-col gap-10">
           {/* Active Now Widget */}
           <section className="flex flex-col gap-5">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Active Now</h2>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 flex flex-col gap-6">
                  {users.filter(u=>u.role==='freelancer').slice(0, 6).map(user => {
                    const isAvail = availability.some(r => r.user_id === user.id && r.is_available);
                    return (
                      <div key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-700 uppercase">
                              {user.name[0]}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isAvail ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-gray-200'}`} />
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-gray-900">{user.name}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Freelancer</div>
                          </div>
                        </div>
                        <button onClick={() => onNavigate('availability')} className="text-[10px] text-indigo-600 hover:underline font-bold uppercase tracking-widest">Profile</button>
                      </div>
                    )
                  })}
                </div>
                <button 
                  onClick={() => onNavigate('availability')}
                  className="w-full py-4 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] hover:text-indigo-600 hover:bg-gray-100 transition-all border-t border-gray-100"
                >
                  View Team Roster
                </button>
              </div>
           </section>

           {/* Brand workload */}
           <section className="flex flex-col gap-5">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Workload Balance</h2>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                 {brands.map(b => {
                   const brandTasks = tasks.filter(t => t.brand === b.slug && t.status !== 'approved' && t.status !== 'paid');
                   const percent = tasks.length > 0 ? (brandTasks.length / tasks.length) * 100 : 0;
                   return (
                     <div key={b.id} className="flex flex-col gap-2.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{b.name}</span>
                          <span className="text-[13px] font-bold text-gray-900 tabular-nums">{brandTasks.length}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                          <div className={`h-full rounded-full transition-all duration-1000`} style={{ width: `${percent}%`, backgroundColor: b.hex_color }} />
                        </div>
                     </div>
                   )
                 })}
              </div>
           </section>
        </div>
      </div>

      {/* 14-Day Availability Overview */}
      <section className="flex flex-col gap-5 mt-10">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Team Availability (14-Day Grid)</h2>
        <AdminAvailabilityGrid />
      </section>

      {/* Task Board */}
      <section className="flex flex-col gap-5 mt-10">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Task Board</h2>
        <TaskBoard />
      </section>
    </div>
  )
}
