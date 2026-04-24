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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gray-50 py-12 px-4 font-sans text-gray-900 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-indigo-100 border border-gray-100 overflow-hidden">
        
        <div className="flex flex-col items-center pt-10 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-200 mb-5">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Create Account</h1>
          <p className="text-[13px] font-medium text-gray-400 mt-2">Join the Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="px-10 py-8 space-y-5" noValidate>
          {error && (
            <div className="p-3.5 text-xs font-bold text-red-600 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSubmitting}
              className={`w-full bg-gray-50 border ${validationError && !name ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-[13px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all disabled:opacity-50`}
            />
          </div>

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

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">I am a...</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'freelancer')}
              disabled={isSubmitting}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all disabled:opacity-50 appearance-none"
            >
              <option value="freelancer">Freelancer</option>
              <option value="admin">Admin / Manager</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[13px] font-bold rounded-xl flex items-center justify-center transition-all disabled:opacity-60 shadow-lg shadow-indigo-200"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="px-10 py-6 bg-gray-50/50 border-t border-gray-100 text-center">
          <p className="text-[13px] font-medium text-gray-500">
            Already registered?{' '}
            <button type="button" onClick={onGoToLogin} className="text-indigo-600 hover:underline font-bold transition-colors">
              Sign in
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}
