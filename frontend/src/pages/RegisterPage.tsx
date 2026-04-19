import { useState, type FormEvent } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface RegisterPageProps {
  onGoToLogin: () => void
}

export function RegisterPage({ onGoToLogin }: RegisterPageProps) {
  const { register } = useAuthContext()
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'freelancer'>('freelancer')
  
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!name || !email || !password) {
      setValidationError(true)
      return
    }
    
    setValidationError(false)
    setIsSubmitting(true)
    setError(null)
    
    try {
      await register({ name, email, password, role })
      // Auto-logged in upon success (handled inside AuthContext.register via apiLogin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0f1117] py-12 px-4 font-sans text-slate-200 overflow-y-auto">
      <div className="w-full max-w-md bg-[#1a1d27] rounded-2xl shadow-2xl shadow-indigo-500/10 border border-white/5 overflow-hidden">
        
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Create Account</h1>
          <p className="text-sm text-slate-400 mt-1">Join the Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4" noValidate>
          {error && (
            <div className="p-3 text-sm text-red-300 bg-red-950/50 rounded-lg border border-red-800/50">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSubmitting}
              className={`w-full bg-[#0f1117] border ${validationError && !name ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50`}
            />
            {validationError && !name && <span className="text-[11px] text-red-400 mt-1 block">Required</span>}
          </div>

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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'freelancer')}
              disabled={isSubmitting}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50 text-slate-200 appearance-none"
            >
              <option value="freelancer">Freelancer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-lg flex items-center justify-center transition-colors disabled:opacity-60"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : 'Register'}
            </button>
          </div>
        </form>

        <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <button type="button" onClick={onGoToLogin} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Sign in
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}
