import type { User, LoginRequest, RegisterRequest } from '../types/auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const defaultOptions: RequestInit = { credentials: 'include' }

export const NOT_AUTHENTICATED = Symbol('NOT_AUTHENTICATED')

export async function login(req: LoginRequest): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    ...defaultOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid email or password')
    }
    const errorText = await res.text()
    throw new Error(`[${res.status}] login failed: ${errorText}`)
  }
  return res.json() as Promise<User>
}

export async function register(req: RegisterRequest): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    ...defaultOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error('Email already registered')
    }
    const errorText = await res.text()
    throw new Error(`[${res.status}] register failed: ${errorText}`)
  }
  return res.json() as Promise<User>
}

export async function logout(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
    ...defaultOptions,
    method: 'POST'
  })
  
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`[${res.status}] logout failed: ${errorText}`)
  }
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/me`, defaultOptions)

  if (!res.ok) {
    if (res.status === 401) {
      throw NOT_AUTHENTICATED
    }
    const errorText = await res.text()
    throw new Error(`[${res.status}] fetchCurrentUser failed: ${errorText}`)
  }
  return res.json() as Promise<User>
}
