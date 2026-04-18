import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/auth'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket?.connected) return socket

  const token = useAuthStore.getState().accessToken
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
