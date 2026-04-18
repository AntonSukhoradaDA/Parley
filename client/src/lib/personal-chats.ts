import { api } from './api'

export interface PersonalChat {
  id: string
  partner: { id: string; username: string }
  createdAt: string
  frozen: boolean
  frozenByMe: boolean
}

export const listPersonalChats = () => api<PersonalChat[]>('/api/personal-chats')

export const openPersonalChat = (userId: string) =>
  api<PersonalChat>(`/api/personal-chats/${userId}`, { method: 'POST' })
