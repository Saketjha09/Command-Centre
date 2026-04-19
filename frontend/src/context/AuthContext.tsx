import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, LoginRequest, RegisterRequest } from '../types/auth'
import { login as apiLogin, logout as apiLogout, register as apiRegister, fetchCurrentUser, NOT_AUTHENTICATED } from '../services/authApi'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (req: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  register: (req: RegisterRequest) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    fetchCurrentUser()
      .then(currentUser => {
        if (active) {
          setUser(currentUser)
        }
      })
      .catch(err => {
        if (active) {
          if (err !== NOT_AUTHENTICATED) {
            console.error('Auth context load error:', err)
          }
          setUser(null)
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })
    return () => { active = false }
  }, [])

  const login = async (req: LoginRequest) => {
    const currentUser = await apiLogin(req)
    setUser(currentUser)
  }

  const logout = async () => {
    try {
      await apiLogout()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setUser(null)
      // Navigates strictly handled by individual views utilizing the context.
    }
  }

  const register = async (req: RegisterRequest) => {
    await apiRegister(req)
    // Post-register login auto resolves the user internally
    await login({ email: req.email, password: req.password })
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      register
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext outside AuthProvider')
  return ctx
}
