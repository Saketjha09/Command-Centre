export interface User {
  id: string
  name: string
  email: string
  role: 'superadmin' | 'admin' | 'freelancer'
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  role: 'admin' | 'freelancer'
}
