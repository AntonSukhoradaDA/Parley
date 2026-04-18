import { api } from './api'

export interface Friend {
  friendshipId: string
  userId: string
  username: string
}

export interface FriendRequest {
  id: string
  userId: string
  username: string
  message: string | null
  createdAt: string
}

export interface FriendRequests {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

export interface BannedUser {
  userId: string
  username: string
  createdAt: string
}

export const listFriends = () => api<Friend[]>('/api/friends')

export const listRequests = () => api<FriendRequests>('/api/friends/requests')

export const sendFriendRequest = (username: string, message?: string) =>
  api<unknown>('/api/friends/request', {
    method: 'POST',
    body: { username, message },
  })

export const acceptRequest = (id: string) =>
  api<unknown>(`/api/friends/accept/${id}`, { method: 'POST' })

export const rejectRequest = (id: string) =>
  api<void>(`/api/friends/reject/${id}`, { method: 'DELETE' })

export const removeFriend = (userId: string) =>
  api<void>(`/api/friends/${userId}`, { method: 'DELETE' })

export const banUser = (userId: string) => api<void>(`/api/users/ban/${userId}`, { method: 'POST' })

export const unbanUser = (userId: string) =>
  api<void>(`/api/users/ban/${userId}`, { method: 'DELETE' })

export const listBannedUsers = () => api<BannedUser[]>('/api/users/bans')
