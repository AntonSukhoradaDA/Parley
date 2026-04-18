import { create } from 'zustand'
import { listMyRooms, type Room } from '@/lib/rooms'
import { listPersonalChats, type PersonalChat } from '@/lib/personal-chats'

interface RoomsState {
  rooms: Room[]
  personalChats: PersonalChat[]
  selectedId: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  upsertPersonalChat: (chat: PersonalChat) => void
  select: (id: string | null) => void
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: [],
  personalChats: [],
  selectedId: null,
  loading: false,
  error: null,
  async refresh() {
    set({ loading: true, error: null })
    try {
      const [rooms, personalChats] = await Promise.all([
        listMyRooms(),
        listPersonalChats(),
      ])
      set({ rooms, personalChats, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load rooms' })
    }
  },
  upsertPersonalChat(chat) {
    set((s) => {
      const filtered = s.personalChats.filter((c) => c.id !== chat.id)
      return { personalChats: [...filtered, chat] }
    })
  },
  select(id) {
    set({ selectedId: id })
  },
}))
