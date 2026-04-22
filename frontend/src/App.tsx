import { useState, useEffect } from 'react'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import AvailabilityPage from './pages/AvailabilityPage'
import { PeoplePage } from './pages/PeoplePage'
import { PayrollPage } from './pages/PayrollPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { WSProvider, useWS } from './context/WebSocketContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import { Sidebar } from './components/shell/Sidebar'
import { TopBar } from './components/shell/TopBar'
import { ProfilePage } from './pages/ProfilePage'

type View = 'dashboard' | 'board' | 'availability' | 'people' | 'payroll' | 'mytasks' | 'profile'

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  board: 'Command Center',
  availability: 'Availability Calendar',
  people: 'Team Roster',
  payroll: 'Payroll & Ledger',
  mytasks: 'My Tasks',
  profile: 'My Profile',
}

// Role-based default views
const DEFAULT_VIEW: Record<string, View> = {
  superadmin: 'dashboard',
  admin: 'dashboard',
  freelancer: 'mytasks',
}

// Role-based accessible views
const ACCESSIBLE_VIEWS: Record<string, View[]> = {
  superadmin: ['dashboard', 'board', 'availability', 'people', 'payroll', 'profile'],
  admin: ['dashboard', 'board', 'availability', 'people', 'profile'],
  freelancer: ['mytasks', 'availability', 'profile'],
}

import { useSearchParams, BrowserRouter } from 'react-router-dom'
import { TaskDrawer } from './components/kanban/TaskDrawer'
import { CommandPalette } from './components/CommandPalette'
import { createTask as apiCreateTask } from './services/api'

function AuthenticatedApp() {
  const { user } = useAuthContext()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const userRole = (user?.role || 'freelancer') as 'superadmin' | 'admin' | 'freelancer'
  const accessibleViews = ACCESSIBLE_VIEWS[userRole] || ACCESSIBLE_VIEWS.freelancer
  const defaultView = DEFAULT_VIEW[userRole] || DEFAULT_VIEW.freelancer

  // Sync view from URL or localStorage
  const view = (searchParams.get('v') as View) || (localStorage.getItem('currentView') as View) || defaultView
  const brand = searchParams.get('brand') || ''

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })

  const [isGlobalDrawerOpen, setIsGlobalDrawerOpen] = useState(false)
  const [globalDrawerTaskId, setGlobalDrawerTaskId] = useState<string | null>(null)
  const [globalDrawerMode, setGlobalDrawerMode] = useState<'create' | 'view'>('create')

  const { wsStatus } = useWS()

  // Enforce role-based view access and sync to URL
  useEffect(() => {
    if (!accessibleViews.includes(view)) {
      setSearchParams({ v: defaultView }, { replace: true })
    } else if (!searchParams.get('v')) {
      setSearchParams({ v: view }, { replace: true })
    }
  }, [view, accessibleViews, defaultView, searchParams, setSearchParams])

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem('currentView', view)
  }, [view])

  const handleNavigate = (v: string, b?: string) => {
    const newView = v as View
    if (accessibleViews.includes(newView)) {
      const params: any = { v: newView }
      if (b !== undefined) params.brand = b
      else if (brand && newView === 'board') params.brand = brand
      setSearchParams(params)
    }
  }

  const handleGlobalCreate = async (data: any) => {
     try {
       await apiCreateTask(data)
       setIsGlobalDrawerOpen(false)
     } catch (err: any) {
       throw err
     }
  }

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden font-sans text-[#fafafa]">
      <Sidebar
        currentView={view}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        <TopBar
          title={VIEW_TITLES[view]}
          wsStatus={wsStatus}
          onNewTask={() => {
            setGlobalDrawerTaskId(null)
            setGlobalDrawerMode('create')
            setIsGlobalDrawerOpen(true)
          }}
        />
        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0 bg-[#09090b] border-l border-[#27272a]">
          {view === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
          {view === 'board' && <KanbanBoard />}
          {view === 'availability' && <AvailabilityPage />}
          {view === 'people' && <PeoplePage />}
          {view === 'payroll' && <PayrollPage />}
          {view === 'mytasks' && <MyTasksPage />}
          {view === 'profile' && <ProfilePage />}
        </main>
      </div>

      <TaskDrawer
         isOpen={isGlobalDrawerOpen}
         onClose={() => setIsGlobalDrawerOpen(false)}
         mode={globalDrawerMode}
         taskId={globalDrawerTaskId}
         onCreate={handleGlobalCreate}
      />
      <CommandPalette />
    </div>
  )
}

function Router() {
  const { isAuthenticated, isLoading } = useAuthContext()
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0d1117]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
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

