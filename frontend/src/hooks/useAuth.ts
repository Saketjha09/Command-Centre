import { useAuthContext } from '../context/AuthContext'

export function useAuth() {
  const { user, isAuthenticated, isLoading } = useAuthContext()
  return {
    id: user?.id ?? '',
    name: user?.name ?? '',
    role: user?.role ?? 'freelancer',
    email: user?.email ?? '',
    isAuthenticated,
    isLoading,
  }
}
