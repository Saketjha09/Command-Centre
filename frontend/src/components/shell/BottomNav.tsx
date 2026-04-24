import { useAuthContext } from '../../context/AuthContext'

interface BottomNavProps {
  currentView: string
  onNavigate: (view: string) => void
}

export function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  const { user } = useAuthContext()
  const role = user?.role || 'freelancer'

  const navItems = [
    { 
      id: role === 'freelancer' ? 'mytasks' : 'dashboard', 
      label: 'Home', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      id: role === 'freelancer' ? 'availability' : 'board', 
      label: role === 'freelancer' ? 'Calendar' : 'Board', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: role === 'freelancer' ? 'profile' : 'people', 
      label: role === 'freelancer' ? 'Profile' : 'Team', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${
            currentView === item.id ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          {item.icon}
          <span className="text-[9px] font-black uppercase tracking-[0.15em]">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
