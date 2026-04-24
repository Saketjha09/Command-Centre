import { useAuthContext } from '../context/AuthContext'

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout } = useAuthContext()
  return {
    id: user?.id ?? '',
    name: user?.name ?? '',
    role: user?.role ?? 'freelancer',
    email: user?.email ?? '',
    avatar_url: user?.avatar_url,
    isAuthenticated,
    isLoading,
    logout,
  }
}
