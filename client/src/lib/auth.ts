import { api } from './api'
import { useAuthStore, type User } from '@/store/auth'

interface AuthResponse {
  accessToken: string
  user: User
}

export async function register(input: {
  email: string
  username: string
  password: string
}): Promise<User> {
  const res = await api<AuthResponse>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: input,
  })
  useAuthStore.getState().setSession(res.user, res.accessToken)
  return res.user
}

export async function login(input: {
  email: string
  password: string
}): Promise<User> {
  const res = await api<AuthResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: input,
  })
  useAuthStore.getState().setSession(res.user, res.accessToken)
  return res.user
}

export async function logout(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST', auth: false })
  } finally {
    useAuthStore.getState().clear()
  }
}

export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState()
  store.setStatus('loading')
  try {
    const refreshed = await api<{ accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      auth: false,
      skipRefresh: true,
    })
    store.setAccessToken(refreshed.accessToken)
    const user = await api<User>('/api/auth/me')
    store.setSession(user, refreshed.accessToken)
  } catch {
    store.clear()
  }
}
