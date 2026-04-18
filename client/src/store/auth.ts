import { create } from 'zustand'

export interface User {
  id: string
  email: string
  username: string
  createdAt: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  setSession: (user: User, accessToken: string) => void
  setAccessToken: (accessToken: string) => void
  setUser: (user: User) => void
  setStatus: (status: AuthState['status']) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'idle',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}))
