import { create } from 'zustand'

export type PresenceStatus = 'online' | 'afk' | 'offline'

interface PresenceState {
  statuses: Record<string, PresenceStatus>
  unreadCounts: Record<string, number>
  setStatus: (userId: string, status: PresenceStatus) => void
  setBulkStatuses: (statuses: Record<string, PresenceStatus>) => void
  initUnread: (counts: Record<string, number>) => void
  bumpUnread: (roomId: string) => void
  clearUnread: (roomId: string) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  statuses: {},
  unreadCounts: {},

  setStatus: (userId, status) =>
    set((s) => ({ statuses: { ...s.statuses, [userId]: status } })),

  setBulkStatuses: (statuses) =>
    set((s) => ({ statuses: { ...s.statuses, ...statuses } })),

  initUnread: (counts) => set({ unreadCounts: counts }),

  bumpUnread: (roomId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [roomId]: (s.unreadCounts[roomId] ?? 0) + 1,
      },
    })),

  clearUnread: (roomId) =>
    set((s) => {
      const { [roomId]: _, ...rest } = s.unreadCounts
      return { unreadCounts: rest }
    }),
}))
