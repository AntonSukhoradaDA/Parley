import { create } from 'zustand'
import { listMyRooms, type Room } from '@/lib/rooms'

interface RoomsState {
  rooms: Room[]
  selectedId: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  select: (id: string | null) => void
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: [],
  selectedId: null,
  loading: false,
  error: null,
  async refresh() {
    set({ loading: true, error: null })
    try {
      const rooms = await listMyRooms()
      set({ rooms, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load rooms' })
    }
  },
  select(id) {
    set({ selectedId: id })
  },
}))
