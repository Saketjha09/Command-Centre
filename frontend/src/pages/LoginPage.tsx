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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-gray-50 px-4 font-sans text-gray-900">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-indigo-100 border border-gray-100 overflow-hidden">
        
        <div className="flex flex-col items-center pt-10 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-200 mb-5 rotate-3">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Command Center</h1>
          <p className="text-[13px] font-medium text-gray-400 mt-2">Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="px-10 py-8 space-y-6" noValidate>
          {error && (
            <div className="p-3.5 text-xs font-bold text-red-600 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting}
              className={`w-full bg-gray-50 border ${validationError && !email ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-[13px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all disabled:opacity-50`}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
              className={`w-full bg-gray-50 border ${validationError && !password ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-[13px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all disabled:opacity-50`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[13px] font-bold rounded-xl flex items-center justify-center transition-all disabled:opacity-60 shadow-lg shadow-indigo-200"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Sign In'}
          </button>
        </form>

        <div className="px-10 py-6 bg-gray-50/50 border-t border-gray-100 text-center">
          <p className="text-[13px] font-medium text-gray-500">
            Need access?{' '}
            <button type="button" onClick={onGoToRegister} className="text-indigo-600 hover:underline font-bold transition-colors">
              Register now
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}
