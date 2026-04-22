import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { fetchTasks, fetchBrands } from '../../services/api'
import { useSearchParams } from 'react-router-dom'
import type { Brand } from '../../types/brand'

interface SidebarProps {
  currentView: string
  onNavigate: (view: string, brand?: string) => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ currentView, onNavigate, collapsed, onToggle }: SidebarProps) {
  const user = useAuth()
  const [searchParams] = useSearchParams()
  const currentBrand = searchParams.get('brand') || ''
  
  const role = (user?.role || 'freelancer') as 'superadmin' | 'admin' | 'freelancer'
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
              t.brand === b.slug && t.status !== 'approved' && t.status !== 'paid'
            ).length
          })
          setCounts(newCounts)
        })
        .catch(console.error)
    }
  }, [role])

  const ROLE_NAV: Record<string, {id: string, label: string, icon: string}[]> = {
    superadmin: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'board', label: 'Tasks', icon: '📋' },
      { id: 'availability', label: 'Availability', icon: '📅' },
      { id: 'people', label: 'Freelancers', icon: '👥' },
      { id: 'payroll', label: 'Payroll', icon: '💰' },
      { id: 'profile', label: 'Profile', icon: '👤' },
    ],
    admin: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'board', label: 'Tasks', icon: '📋' },
      { id: 'availability', label: 'Availability', icon: '📅' },
      { id: 'people', label: 'Freelancers', icon: '👥' },
      { id: 'profile', label: 'Profile', icon: '👤' },
    ],
    freelancer: [
      { id: 'mytasks', label: 'My Tasks', icon: '✅' },
      { id: 'availability', label: 'Availability', icon: '📅' },
      { id: 'profile', label: 'Profile', icon: '👤' },
    ]
  }

  const items = ROLE_NAV[role] || ROLE_NAV.freelancer

  return (
    <aside style={{
      width: collapsed ? '64px' : '240px',
      background: '#09090b', // zinc-950
      borderRight: '1px solid #18181b', // zinc-900
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 24px',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: '900', fontSize: '14px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}>
              F
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>
              Command
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'none', border: 'none',
            color: '#52525b', cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}
          className="hover:bg-[#18181b] hover:text-[#fafafa]"
        >
          {collapsed ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          )}
        </button>
      </div>

      {/* Main Nav */}
      <div style={{ padding: '20px 12px', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        {!collapsed && (
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            color: '#3f3f46',
            marginBottom: '12px',
            paddingLeft: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em'
          }}>
            Main Menu
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map(item => {
            const active = currentView === item.id && (item.id !== 'board' || !currentBrand)
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id, '')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: collapsed ? '12px' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? '#18181b' : 'transparent',
                  border: 'none',
                  borderLeft: active ? '3px solid #4f46e5' : '3px solid transparent',
                  borderRadius: collapsed ? '12px' : '0 8px 8px 0',
                  marginLeft: collapsed ? '0' : '-12px',
                  paddingLeft: collapsed ? '12px' : '21px',
                  color: active ? '#fafafa' : '#71717a',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
                className={active ? '' : 'hover:bg-[#18181b]/50 hover:text-[#a1a1aa]'}
              >
                <span style={{ fontSize: '18px', filter: active ? 'none' : 'grayscale(100%) opacity(0.6)' }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{ fontSize: '13px', fontWeight: active ? 600 : 500 }}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Brands Section */}
        {!collapsed && (role === 'superadmin' || role === 'admin') && brands.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#52525b',
              marginBottom: '8px',
              paddingLeft: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Brands
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {brands.map(b => (
                <button
                  key={b.id}
                  onClick={() => onNavigate('board', b.slug)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 12px', 
                    background: currentBrand === b.slug && currentView === 'board' ? '#27272a' : 'none',
                    border: 'none',
                    color: currentBrand === b.slug && currentView === 'board' ? '#fafafa' : '#a1a1aa',
                    cursor: 'pointer', borderRadius: '6px',
                  }}
                  onMouseEnter={e => { if (currentBrand !== b.slug) (e.currentTarget as HTMLElement).style.background = '#27272a' }}
                  onMouseLeave={e => { if (currentBrand !== b.slug) (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.hex_color }} />
                  <span style={{ fontSize: '13px', flex: 1, textAlign: 'left', fontWeight: currentBrand === b.slug ? 500 : 400 }}>{b.name}</span>
                  {counts[b.slug] !== undefined && (
                    <span style={{ fontSize: '11px', background: '#09090b', padding: '2px 6px', borderRadius: '12px', border: '1px solid #27272a' }}>
                      {counts[b.slug]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User profile footer */}
      {!collapsed && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#27272a', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fafafa', fontSize: '12px', fontWeight: 600,
            overflow: 'hidden'
          }}>
            {user?.avatar_url ? (
               <img 
                 src={user.avatar_url.startsWith('http') ? user.avatar_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${user.avatar_url}`} 
                 className="w-full h-full object-cover"
               />
            ) : (
              user?.name?.slice(0, 2).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: '#fafafa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: '11px', color: '#71717a', textTransform: 'capitalize' }}>
              {role}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
