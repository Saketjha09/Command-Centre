import { useState, type FormEvent } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface LoginPageProps {
  onGoToRegister: () => void
}

export function LoginPage({ onGoToRegister }: LoginPageProps) {
  const { login } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setValidationError(true)
      return
    }
    
    setValidationError(false)
    setIsSubmitting(true)
    setError(null)
    
    try {
      await login({ email, password })
      // On success, App.tsx will automatically re-evaluate isAuthenticated
      // and redirect to the protected views. No manual navigate needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-[#0f1117] px-4 font-sans text-slate-200">
      <div className="w-full max-w-sm bg-[#1a1d27] rounded-2xl shadow-2xl shadow-indigo-500/10 border border-white/5 overflow-hidden">
        
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5" noValidate>
          {error && (
            <div className="p-3 text-sm text-red-300 bg-red-950/50 rounded-lg border border-red-800/50">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting}
              className={`w-full bg-[#0f1117] border ${validationError && !email ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50`}
            />
            {validationError && !email && <span className="text-[11px] text-red-400 mt-1 block">Required</span>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
              className={`w-full bg-[#0f1117] border ${validationError && !password ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50`}
            />
            {validationError && !password && <span className="text-[11px] text-red-400 mt-1 block">Required</span>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-lg flex items-center justify-center transition-colors disabled:opacity-60 mt-2"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Sign In'}
          </button>
        </form>

        <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 text-center">
          <p className="text-sm text-slate-400">
            Don't have an account?{' '}
            <button type="button" onClick={onGoToRegister} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Register
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}
