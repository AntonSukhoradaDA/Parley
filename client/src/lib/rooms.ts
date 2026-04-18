import { api } from './api'

export type RoomVisibility = 'public' | 'private'
export type RoomMemberRole = 'owner' | 'admin' | 'member'

export interface Room {
  id: string
  name: string
  description: string
  visibility: RoomVisibility
  ownerId: string | null
  role: RoomMemberRole
  memberCount: number
  joinedAt: string
}

export interface PublicRoom {
  id: string
  name: string
  description: string
  visibility: RoomVisibility
  ownerId: string | null
  memberCount: number
  isMember: boolean
  createdAt: string
}

export interface RoomDetail {
  id: string
  name: string
  description: string
  visibility: RoomVisibility
  ownerId: string | null
  memberCount: number
  role: RoomMemberRole | null
  createdAt: string
}

export interface RoomMember {
  userId: string
  username: string
  role: RoomMemberRole
  joinedAt: string
}

export interface RoomBan {
  userId: string
  username: string
  bannedById: string
  bannedByUsername: string
  createdAt: string
}

export const listMyRooms = () => api<Room[]>('/api/rooms')

export const listPublicRooms = (search?: string) =>
  api<PublicRoom[]>('/api/rooms/public' + (search ? `?search=${encodeURIComponent(search)}` : ''))

export const getRoom = (id: string) => api<RoomDetail>(`/api/rooms/${id}`)

export const createRoom = (input: {
  name: string
  description?: string
  visibility: RoomVisibility
}) => api<{ id: string }>('/api/rooms', { method: 'POST', body: input })

export const updateRoom = (
  id: string,
  input: { name?: string; description?: string; visibility?: RoomVisibility },
) => api<RoomDetail>(`/api/rooms/${id}`, { method: 'PATCH', body: input })

export const deleteRoom = (id: string) => api<void>(`/api/rooms/${id}`, { method: 'DELETE' })

export const joinRoom = (id: string) => api<unknown>(`/api/rooms/${id}/join`, { method: 'POST' })

export const leaveRoom = (id: string) => api<void>(`/api/rooms/${id}/leave`, { method: 'POST' })

export const inviteToRoom = (id: string, username: string) =>
  api<unknown>(`/api/rooms/${id}/invite`, {
    method: 'POST',
    body: { username },
  })

export const listMembers = (id: string) => api<RoomMember[]>(`/api/rooms/${id}/members`)

export const setAdmin = (id: string, userId: string, makeAdmin: boolean) =>
  api<void>(`/api/rooms/${id}/admins/${userId}`, {
    method: makeAdmin ? 'POST' : 'DELETE',
  })

export const banUser = (id: string, userId: string) =>
  api<void>(`/api/rooms/${id}/ban/${userId}`, { method: 'POST' })

export const unbanUser = (id: string, userId: string) =>
  api<void>(`/api/rooms/${id}/ban/${userId}`, { method: 'DELETE' })

export const listBans = (id: string) => api<RoomBan[]>(`/api/rooms/${id}/bans`)

export const kickMember = (id: string, userId: string) =>
  api<void>(`/api/rooms/${id}/members/${userId}`, { method: 'DELETE' })
