import { create } from 'zustand'
import type { AttachmentMeta } from '@/lib/attachments'

export interface PendingMessage {
  tempId: string
  roomId: string
  content: string
  replyToId?: string
  replyToSender?: string
  replyToContent?: string
  attachments: AttachmentMeta[]
  status: 'sending' | 'failed'
  error?: string
  createdAt: string
  sender: { id: string; username: string }
}

interface PendingState {
  byRoom: Record<string, PendingMessage[]>
  add: (msg: PendingMessage) => void
  markFailed: (tempId: string, roomId: string, error: string) => void
  retry: (tempId: string, roomId: string) => void
  remove: (tempId: string, roomId: string) => void
}

export const usePendingStore = create<PendingState>((set) => ({
  byRoom: {},
  add: (msg) =>
    set((s) => ({
      byRoom: {
        ...s.byRoom,
        [msg.roomId]: [...(s.byRoom[msg.roomId] ?? []), msg],
      },
    })),
  markFailed: (tempId, roomId, error) =>
    set((s) => ({
      byRoom: {
        ...s.byRoom,
        [roomId]: (s.byRoom[roomId] ?? []).map((m) =>
          m.tempId === tempId ? { ...m, status: 'failed', error } : m,
        ),
      },
    })),
  retry: (tempId, roomId) =>
    set((s) => ({
      byRoom: {
        ...s.byRoom,
        [roomId]: (s.byRoom[roomId] ?? []).map((m) =>
          m.tempId === tempId ? { ...m, status: 'sending', error: undefined } : m,
        ),
      },
    })),
  remove: (tempId, roomId) =>
    set((s) => ({
      byRoom: {
        ...s.byRoom,
        [roomId]: (s.byRoom[roomId] ?? []).filter((m) => m.tempId !== tempId),
      },
    })),
}))
