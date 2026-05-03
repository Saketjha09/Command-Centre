import { useState, useEffect } from 'react'
import AvailabilityPage from './pages/AvailabilityPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { WSProvider, useWS } from './context/WebSocketContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import { Sidebar } from './components/shell/Sidebar'
import { TopBar } from './components/shell/TopBar'
import { ProfilePage } from './pages/ProfilePage'

type View = 'dashboard' | 'availability' | 'profile'

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  availability: 'Availability',
  profile: 'Settings',
}

// Role-based default views
const DEFAULT_VIEW: Record<string, View> = {
  superadmin: 'dashboard',
  admin: 'dashboard',
  freelancer: 'availability',
}

// Role-based accessible views
const ACCESSIBLE_VIEWS: Record<string, View[]> = {
  superadmin: ['dashboard', 'availability', 'profile'],
  admin: ['dashboard', 'availability', 'profile'],
  freelancer: ['availability', 'profile'],
}

import { useSearchParams, BrowserRouter } from 'react-router-dom'
import { TaskDrawer } from './components/kanban/TaskDrawer'
import { CommandPalette } from './components/CommandPalette'
import { createTask as apiCreateTask } from './services/api'

import { BottomNav } from './components/shell/BottomNav'
import { AddMemberModal } from './components/shell/AddMemberModal'
import { AddBrandModal } from './components/shell/AddBrandModal'

function AuthenticatedApp() {
  const { user } = useAuthContext()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const rawRole = (user?.role || 'freelancer').toLowerCase()
  const userRole = (['superadmin', 'admin', 'freelancer'].includes(rawRole) ? rawRole : 'freelancer') as keyof typeof ACCESSIBLE_VIEWS
  
  const accessibleViews = ACCESSIBLE_VIEWS[userRole] || ACCESSIBLE_VIEWS.freelancer
  const defaultView = DEFAULT_VIEW[userRole] || DEFAULT_VIEW.freelancer

  // 1. Derive view from URL or localStorage with strict validation
  const paramView = searchParams.get('v') as View
  const storedView = localStorage.getItem('currentView') as View
  const initialView = paramView || storedView || defaultView
  const view: View = accessibleViews.includes(initialView) ? initialView : defaultView
  
  const brand = searchParams.get('brand') || ''

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })

  const [isGlobalDrawerOpen, setIsGlobalDrawerOpen] = useState(false)
  const [globalDrawerTaskId, setGlobalDrawerTaskId] = useState<string | null>(null)
  const [globalDrawerMode, setGlobalDrawerMode] = useState<'create' | 'view'>('create')

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const { wsStatus, lastMessage } = useWS()

  // 2. Sync validated view to URL and localStorage
  useEffect(() => {
    const currentParamV = searchParams.get('v')
    if (currentParamV !== view) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('v', view)
        return next
      }, { replace: true })
    }
    localStorage.setItem('currentView', view)
  }, [view, setSearchParams])

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // 3. WS Auto-refresh
  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'task.created' || lastMessage.type === 'task.status_changed' || lastMessage.type === 'task.assigned')) {
      setRefreshTrigger(prev => prev + 1)
    }
  }, [lastMessage])

  const handleNavigate = (v: string, b?: string) => {
    const newView = v as View
    if (accessibleViews.includes(newView)) {
      const params: any = { v: newView }
      if (b !== undefined) params.brand = b
      setSearchParams(params)
    }
  }

  const handleGlobalCreate = async (data: any) => {
     try {
       await apiCreateTask(data)
       setIsGlobalDrawerOpen(false)
       setRefreshTrigger(t => t + 1)
     } catch (err: any) {
       throw err
     }
  }

  const onNewTask = () => {
    setGlobalDrawerTaskId(null)
    setGlobalDrawerMode('create')
    setIsGlobalDrawerOpen(true)
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans text-gray-900">
      <div className="hidden md:flex shrink-0">
        <Sidebar
          currentView={view}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onAddMember={(userRole === 'superadmin' || userRole === 'admin') ? () => setIsAddMemberOpen(true) : undefined}
          onAddBrand={(userRole === 'superadmin' || userRole === 'admin') ? () => setIsAddBrandOpen(true) : undefined}
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden pb-16 md:pb-0">
        <TopBar
          title={VIEW_TITLES[view] || 'Command Center'}
          wsStatus={wsStatus}
          onNewTask={onNewTask}
          onAddMember={(userRole === 'superadmin' || userRole === 'admin') ? () => setIsAddMemberOpen(true) : undefined}
          onAddBrand={(userRole === 'superadmin' || userRole === 'admin') ? () => setIsAddBrandOpen(true) : undefined}
        />
        


        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0 bg-white border-l border-gray-100">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'availability' && <AvailabilityPage />}
          {view === 'profile' && <ProfilePage />}
        </main>
      </div>

      <BottomNav currentView={view} onNavigate={handleNavigate} />

      <AddMemberModal 
        isOpen={isAddMemberOpen} 
        onClose={() => setIsAddMemberOpen(false)}
        onSuccess={() => setRefreshTrigger(t => t + 1)}
      />

      <AddBrandModal 
        isOpen={isAddBrandOpen} 
        onClose={() => setIsAddBrandOpen(false)}
        onSuccess={() => setRefreshTrigger(t => t + 1)}
      />

      <TaskDrawer
         isOpen={isGlobalDrawerOpen}
         onClose={() => setIsGlobalDrawerOpen(false)}
         mode={globalDrawerMode}
         taskId={globalDrawerTaskId}
         onCreate={handleGlobalCreate}
      />
      <CommandPalette 
        onAddMember={(userRole === 'superadmin' || userRole === 'admin') ? () => setIsAddMemberOpen(true) : undefined}
        onAddBrand={(userRole === 'superadmin' || userRole === 'admin') ? () => setIsAddBrandOpen(true) : undefined}
      />
    </div>
  )
}

function Router() {
  const { isAuthenticated, isLoading } = useAuthContext()
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] animate-pulse">Initializing System</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !localStorage.getItem('access_token')) {
    if (authView === 'register') {
      return <RegisterPage onGoToLogin={() => setAuthView('login')} />
    }
    return <LoginPage onGoToRegister={() => setAuthView('register')} />
  }

  return (
    <WSProvider>
      <AuthenticatedApp />
    </WSProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </BrowserRouter>
  )
}
