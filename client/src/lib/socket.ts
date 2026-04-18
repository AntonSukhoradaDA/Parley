import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/auth'
import { usePresenceStore } from '@/store/presence'

let socket: Socket | null = null
let activityInterval: ReturnType<typeof setInterval> | null = null
let lastUserActivity = Date.now()

export function getSocket(): Socket {
  if (socket?.connected) return socket

  const token = useAuthStore.getState().accessToken
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })

  // Presence listeners
  socket.on('presence:update', (data: { userId: string; status: string }) => {
    usePresenceStore.getState().setStatus(data.userId, data.status as 'online' | 'afk' | 'offline')
  })

  // Unread listeners
  socket.on('unread:init', (counts: Record<string, number>) => {
    usePresenceStore.getState().initUnread(counts)
  })

  socket.on('unread:bump', (data: { roomId: string }) => {
    usePresenceStore.getState().bumpUnread(data.roomId)
  })

  // Start activity reporting
  startActivityTracking()

  return socket
}

export function disconnectSocket() {
  stopActivityTracking()
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

function startActivityTracking() {
  // Track user activity events
  const onActivity = () => {
    lastUserActivity = Date.now()
  }
  window.addEventListener('mousemove', onActivity, { passive: true })
  window.addEventListener('keydown', onActivity, { passive: true })
  window.addEventListener('click', onActivity, { passive: true })
  window.addEventListener('scroll', onActivity, { passive: true })
  window.addEventListener('touchstart', onActivity, { passive: true })

  // Send activity pings every 30s if user has been active
  activityInterval = setInterval(() => {
    if (!socket?.connected) return
    const idleMs = Date.now() - lastUserActivity
    // Only send if user was active in the last 60 seconds
    if (idleMs < 60_000) {
      socket.emit('presence:activity')
    }
  }, 30_000)

  // Send immediate ping on focus
  const onFocus = () => {
    lastUserActivity = Date.now()
    socket?.emit('presence:activity')
  }
  window.addEventListener('focus', onFocus)
}

function stopActivityTracking() {
  if (activityInterval) {
    clearInterval(activityInterval)
    activityInterval = null
  }
}
