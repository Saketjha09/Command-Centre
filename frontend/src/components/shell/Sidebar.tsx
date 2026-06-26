import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { fetchTasks, fetchBrands } from '../../services/api'
import { BASE_URL } from '../../services/config'
import { useSearchParams } from 'react-router-dom'
import type { Brand } from '../../types/brand'

interface SidebarProps {
  currentView: string
  onNavigate: (view: string, brand?: string) => void
  collapsed: boolean
  onToggle: () => void
  onAddMember?: () => void
  onAddBrand?: () => void
}

const Icons = {
  Dashboard: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Tasks: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2" />
    </svg>
  ),
  Availability: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  People: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Payroll: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM12 18v-1m0-8V7" />
    </svg>
  ),
  Profile: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  MyTasks: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  )
}

export function Sidebar({ currentView, onNavigate, collapsed, onToggle, onAddMember, onAddBrand }: SidebarProps) {
  const { role, name, avatar_url, logout } = useAuth()
  const [searchParams] = useSearchParams()
  const currentBrand = searchParams.get('brand') || ''
  
  const [brands, setBrands] = useState<Brand[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (role === 'superadmin' || role === 'admin') {
      Promise.all([fetchBrands(), fetchTasks()])
        .then(([brandsData, tasksData]) => {
          setBrands(brandsData)
          
          const newCounts: Record<string, number> = {}
          brandsData.forEach(b => {
            newCounts[b.slug] = tasksData.filter(t => 
              t.brand === b.slug && t.status !== 'done'
            ).length
          })
          setCounts(newCounts)
        })
        .catch(console.error)
    }
  }, [role])

  const ROLE_NAV: Record<string, {id: string, label: string, icon: keyof typeof Icons}[]> = {
    superadmin: [
      { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
      { id: 'availability', label: 'Availability', icon: 'Availability' },
    ],
    admin: [
      { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
      { id: 'availability', label: 'Availability', icon: 'Availability' },
    ],
    freelancer: [
      { id: 'availability', label: 'Availability', icon: 'Availability' },
    ]
  }

  const rawRole = (role || 'freelancer').toLowerCase()
  const userRole = (['superadmin', 'admin', 'freelancer'].includes(rawRole) ? rawRole : 'freelancer')
  const items = ROLE_NAV[userRole] || ROLE_NAV.freelancer

  return (
    <aside className={`flex flex-col border-r border-gray-200 bg-gray-50/50 transition-all duration-300 overflow-hidden ${collapsed ? 'w-18' : 'w-[260px]'}`}>
      {/* Premium Header */}
      <div className={`h-16 flex items-center px-5 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
            </div>
            <span className="text-[14px] font-black text-gray-900 tracking-tight uppercase tracking-widest">
              Operator
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-xl text-gray-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all"
        >
          {collapsed ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar space-y-8">
        {/* Main Nav */}
        <div>
          {!collapsed && (
            <div className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              Intelligence
            </div>
          )}
          <div className="space-y-1">
            {items.map(item => {
              const active = currentView === item.id && (item.id !== 'board' || !currentBrand)
              const Icon = Icons[item.icon]
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id, '')}
                  className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                    active ? 'bg-white shadow-md shadow-indigo-500/5 text-indigo-600 border border-gray-100' : 'text-gray-500 hover:bg-white hover:text-gray-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  {active && <div className="absolute left-0 w-1 h-5 bg-indigo-600 rounded-r-full" />}
                  <span className={`${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                    <Icon />
                  </span>
                  {!collapsed && (
                    <span className={`text-[13px] font-bold tracking-tight`}>
                      {item.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Actions (Admin Only) */}
        {!collapsed && (role === 'superadmin' || role === 'admin') && (
           <div>
              <div className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                Operations
              </div>
              <div className="space-y-1">
                 <button 
                  onClick={onAddMember}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all font-bold text-[13px]"
                 >
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                       <Icons.Plus />
                    </div>
                    Add Freelancer
                 </button>
                 <button 
                  onClick={onAddBrand}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-blue-600 hover:bg-blue-50 transition-all font-bold text-[13px]"
                 >
                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                       <Icons.Plus />
                    </div>
                    Add Brand
                 </button>
              </div>
           </div>
        )}

        {/* Brands Section */}
        {!collapsed && (role === 'superadmin' || role === 'admin') && brands.length > 0 && (
          <div>
            <div className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              Directives
            </div>
            <div className="space-y-1">
              {brands.map(b => {
                const active = currentBrand === b.slug && currentView === 'board'
                return (
                  <button
                    key={b.id}
                    onClick={() => onNavigate('board', b.slug)}
                    className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-xl transition-all group ${
                      active ? 'bg-white shadow-md shadow-gray-200/20 text-gray-900 border border-gray-100' : 'text-gray-500 hover:bg-white hover:text-gray-900'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full ring-4 ring-white shadow-sm" style={{ backgroundColor: b.hex_color }} />
                    <span className="text-[13px] font-bold flex-1 text-left tracking-tight">{b.name}</span>
                    {counts[b.slug] !== undefined && counts[b.slug] > 0 && (
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                        {counts[b.slug]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Premium Profile Footer */}
      <div className={`p-4 mt-auto border-t border-gray-100 bg-white/40 backdrop-blur-sm ${collapsed ? 'flex flex-col items-center gap-4' : 'flex items-center gap-4'}`}>
        <div className={`shrink-0 relative ${collapsed ? 'w-10 h-10' : 'w-11 h-11'}`}>
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-white shadow-md flex items-center justify-center text-[12px] font-black text-white overflow-hidden">
            {avatar_url ? (
               <img 
                 src={avatar_url.startsWith('http') ? avatar_url : `${BASE_URL}${avatar_url}`} 
                 className="w-full h-full object-cover"
               />
            ) : (
              name?.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
        </div>
        
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-gray-900 font-black truncate tracking-tight">
              {name}
            </div>
            <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-0.5">
              {role}
            </div>
          </div>
        )}

        <button 
          onClick={logout}
          className={`p-2.5 rounded-xl transition-all ${
            collapsed ? 'text-gray-400 hover:bg-red-50 hover:text-red-600' : 'text-gray-400 hover:bg-red-50 hover:text-red-600 hover:shadow-sm'
          }`}
          title="Logout of Operator"
        >
          <Icons.Logout />
        </button>
      </div>
    </aside>
  )
}
