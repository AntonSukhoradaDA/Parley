import { api } from './api'

export interface SessionInfo {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
}

export interface BannedUser {
  userId: string
  username: string
  createdAt: string
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api<void>('/api/auth/change-password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  })
}

export function listSessions() {
  return api<SessionInfo[]>('/api/auth/sessions')
}

export function revokeSession(id: string) {
  return api<void>(`/api/auth/sessions/${id}`, { method: 'DELETE' })
}

export function deleteAccount() {
  return api<void>('/api/users/me', { method: 'DELETE' })
}

export function listBannedUsers() {
  return api<BannedUser[]>('/api/users/bans')
}

export function unbanUser(userId: string) {
  return api<void>(`/api/users/ban/${userId}`, { method: 'DELETE' })
}
