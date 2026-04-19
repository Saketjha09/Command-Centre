import { useState } from 'react'
import { BoardPage } from './pages/BoardPage'
import AvailabilityPage from './pages/AvailabilityPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { LoadingSpinner } from './components/LoadingSpinner'

type View = 'board' | 'availability'

function Router() {
  const { isAuthenticated, isLoading, user, logout } = useAuthContext()
  
  // Public Route Tracking
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  
  // Private View Tracking
  const [appView, setAppView] = useState<View>('board')

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0f1117]">
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
    <div className="flex flex-col h-screen w-full overflow-hidden text-slate-200 font-sans" style={{ background: '#0f1117' }}>
      <header className="flex items-center justify-between px-6 pt-3 border-b border-white/5 shrink-0" style={{ background: '#0f1117' }}>
        <nav className="flex gap-4" aria-label="Main Navigation">
          <button
            onClick={() => setAppView('board')}
            className={`px-1 pb-3 text-sm font-medium transition-all duration-200 border-b-2 relative top-[1px] ${
              appView === 'board'
                ? 'border-indigo-500 text-white drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setAppView('availability')}
            className={`px-1 pb-3 text-sm font-medium transition-all duration-200 border-b-2 relative top-[1px] ${
              appView === 'availability'
                ? 'border-indigo-500 text-white drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            Availability
          </button>
        </nav>
        
        <div className="flex items-center gap-4 pb-2">
           {user && (
             <div className="hidden sm:flex items-center gap-2">
               <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{user.role}</span>
               <span className="text-sm font-medium text-slate-300">{user.name}</span>
             </div>
           )}
           <button 
             onClick={() => logout()}
             className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors border border-red-900/50 bg-red-950/30 px-3 py-1.5 rounded-lg"
           >
             Logout
           </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden relative">
        {appView === 'board' ? <BoardPage /> : <AvailabilityPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
