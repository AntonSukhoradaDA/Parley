import { getSocket } from './socket'
import { usePendingStore, type PendingMessage } from '@/store/pending'

const ACK_TIMEOUT_MS = 8000

interface SendPayload {
  tempId: string
  roomId: string
  content: string
  replyToId?: string
  attachmentIds: string[]
}

export function sendMessageWithRetry(payload: SendPayload) {
  const socket = getSocket()
  const { tempId, roomId, content, replyToId, attachmentIds } = payload

  let settled = false
  const timeout = setTimeout(() => {
    if (settled) return
    settled = true
    usePendingStore.getState().markFailed(tempId, roomId, 'Timed out')
  }, ACK_TIMEOUT_MS)

  const body: Record<string, unknown> = { roomId, content }
  if (replyToId) body.replyToId = replyToId
  if (attachmentIds.length) body.attachmentIds = attachmentIds

  socket
    .timeout(ACK_TIMEOUT_MS)
    .emit(
      'message:send',
      body,
      (err: unknown, ack: { ok?: boolean; error?: string } | undefined) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (err) {
          usePendingStore.getState().markFailed(tempId, roomId, 'No response')
          return
        }
        if (!ack?.ok) {
          usePendingStore.getState().markFailed(tempId, roomId, ack?.error ?? 'Failed to send')
          return
        }
        // Success: broadcast 'message:new' will render the real message. We drop the pending
        // entry here; de-dup is handled in MessageList via content/sender/time match.
        usePendingStore.getState().remove(tempId, roomId)
      },
    )
}

export function retryPending(msg: PendingMessage) {
  usePendingStore.getState().retry(msg.tempId, msg.roomId)
  sendMessageWithRetry({
    tempId: msg.tempId,
    roomId: msg.roomId,
    content: msg.content,
    replyToId: msg.replyToId,
    attachmentIds: msg.attachments.map((a) => a.id),
  })
}
