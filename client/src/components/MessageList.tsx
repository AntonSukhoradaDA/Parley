import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth'
import { usePendingStore } from '@/store/pending'
import { retryPending } from '@/lib/send-message'
import { AttachmentView } from './AttachmentView'
import type { AttachmentMeta } from '@/lib/attachments'
import type { PendingMessage } from '@/store/pending'

const EMPTY_PENDING: PendingMessage[] = []

export interface ChatMessage {
  id: string
  roomId: string
  content: string
  editedAt: string | null
  createdAt: string
  replyToId: string | null
  sender: { id: string; username: string }
  replyTo: { id: string; content: string; sender: { id: string; username: string } } | null
  attachments?: AttachmentMeta[]
}

interface HistoryResponse {
  messages: ChatMessage[]
  nextCursor: string | null
}

interface Props {
  roomId: string
  onReply: (msg: ChatMessage) => void
  onEdit: (msg: ChatMessage) => void
}

export function MessageList({ roomId, onReply, onEdit }: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const pendingForRoom = usePendingStore((s) => s.byRoom[roomId]) ?? EMPTY_PENDING
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wasAtBottom = useRef(true)

  // Load initial history
  useEffect(() => {
    setMessages([])
    setCursor(null)
    setHasMore(true)
    setLoadingInitial(true)
    api<HistoryResponse>(`/api/rooms/${roomId}/messages`)
      .then((data) => {
        setMessages(data.messages)
        setCursor(data.nextCursor)
        setHasMore(!!data.nextCursor)
        // scroll to bottom on initial load
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      })
      .finally(() => setLoadingInitial(false))
  }, [roomId])

  // Socket listeners
  useEffect(() => {
    const socket = getSocket()

    function onNew(msg: ChatMessage) {
      if (msg.roomId !== roomId) return
      setMessages((prev) => [...prev, msg])
      // Auto-scroll if user was at bottom
      if (wasAtBottom.current) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    }

    function onEdited(msg: ChatMessage) {
      if (msg.roomId !== roomId) return
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
    }

    function onDeleted(data: { messageId: string; roomId: string }) {
      if (data.roomId !== roomId) return
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId))
    }

    socket.on('message:new', onNew)
    socket.on('message:edited', onEdited)
    socket.on('message:deleted', onDeleted)

    // Mark as read
    socket.emit('room:markRead', { roomId })

    return () => {
      socket.off('message:new', onNew)
      socket.off('message:edited', onEdited)
      socket.off('message:deleted', onDeleted)
    }
  }, [roomId])

  // Infinite scroll — load older
  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    const data = await api<HistoryResponse>(`/api/rooms/${roomId}/messages?cursor=${cursor}`)
    const el = containerRef.current
    const prevHeight = el?.scrollHeight ?? 0
    setMessages((prev) => [...data.messages, ...prev])
    setCursor(data.nextCursor)
    setHasMore(!!data.nextCursor)
    setLoadingMore(false)
    // Maintain scroll position
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight
    })
  }, [roomId, cursor, hasMore, loadingMore])

  // Track scroll position + auto-load older as user nears the top
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    wasAtBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
    if (el.scrollTop < 200 && hasMore && !loadingMore && !loadingInitial) {
      void loadOlder()
    }
  }, [hasMore, loadingMore, loadingInitial, loadOlder])

  function handleDelete(msgId: string) {
    const socket = getSocket()
    socket.emit('message:delete', { messageId: msgId, roomId })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 md:px-8 py-4"
    >
      {hasMore && (
        <div className="text-center py-3 text-xs font-mono text-mist">
          {loadingMore ? (
            'Loading older messages…'
          ) : (
            <button type="button" onClick={loadOlder} className="text-accent hover:underline">
              Load older messages
            </button>
          )}
        </div>
      )}
      {!hasMore && messages.length > 0 && (
        <div className="text-center py-3 text-[11px] font-mono text-mist/60">
          - beginning of history -
        </div>
      )}

      {loadingInitial && messages.length === 0 && (
        <div className="space-y-3 px-3 py-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2.5 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-slate/70 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate/70 rounded w-24" />
                <div className={`h-3 bg-slate/50 rounded ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingInitial && messages.length === 0 && pendingForRoom.length === 0 && (
        <div className="flex items-center justify-center h-full text-mist text-sm">
          No messages yet. Start the conversation.
        </div>
      )}

      <div className="space-y-1">
        {messages.map((msg) => {
          const isOwn = msg.sender.id === userId
          return (
            <div
              key={msg.id}
              className="group py-1.5 px-3 -mx-3 rounded hover:bg-slate/30 transition-colors"
            >
              {/* Reply quote */}
              {msg.replyTo && (
                <div className="flex items-center gap-1.5 mb-1 pl-3 border-l-2 border-accent/30">
                  <span className="text-accent/60 text-xs font-mono">
                    {msg.replyTo.sender.username}
                  </span>
                  <span className="text-mist text-xs truncate max-w-xs">{msg.replyTo.content}</span>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-xs font-mono text-mist uppercase shrink-0 mt-0.5">
                  {msg.sender.username.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-medium ${isOwn ? 'text-accent' : 'text-paper'}`}>
                      {msg.sender.username}
                    </span>
                    <span className="text-mist text-xs font-mono">{formatTime(msg.createdAt)}</span>
                    {msg.editedAt && <span className="text-mist/60 text-xs italic">edited</span>}
                  </div>
                  {msg.content && (
                    <p className="text-chalk text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                      {msg.attachments.map((a) => (
                        <AttachmentView key={a.id} attachment={a} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onReply(msg)}
                    className="text-mist hover:text-accent text-xs px-1.5 py-0.5 rounded hover:bg-slate"
                    title="Reply"
                  >
                    ↩
                  </button>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => onEdit(msg)}
                      className="text-mist hover:text-accent text-xs px-1.5 py-0.5 rounded hover:bg-slate"
                      title="Edit"
                    >
                      ✎
                    </button>
                  )}
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="text-mist hover:text-rust text-xs px-1.5 py-0.5 rounded hover:bg-slate"
                      title="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {pendingForRoom.map((p) => (
          <div key={p.tempId} className="group py-1.5 px-3 -mx-3 rounded hover:bg-slate/30">
            {p.replyToSender && (
              <div className="flex items-center gap-1.5 mb-1 pl-3 border-l-2 border-accent/30">
                <span className="text-accent/60 text-xs font-mono">{p.replyToSender}</span>
                <span className="text-mist text-xs truncate max-w-xs">{p.replyToContent}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-xs font-mono text-mist uppercase shrink-0 mt-0.5">
                {p.sender.username.charAt(0)}
              </span>
              <div className={`flex-1 min-w-0 ${p.status === 'sending' ? 'opacity-60' : ''}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-accent">{p.sender.username}</span>
                  <span className="text-mist text-xs font-mono">
                    {p.status === 'sending' ? (
                      'sending…'
                    ) : (
                      <span className="text-rust">failed{p.error ? `: ${p.error}` : ''}</span>
                    )}
                  </span>
                </div>
                {p.content && (
                  <p className="text-chalk text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {p.content}
                  </p>
                )}
                {p.attachments.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {p.attachments.map((a) => (
                      <AttachmentView key={a.id} attachment={a} />
                    ))}
                  </div>
                )}
                {p.status === 'failed' && (
                  <div className="mt-1 flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => retryPending(p)}
                      className="text-accent hover:underline font-mono"
                    >
                      retry
                    </button>
                    <button
                      type="button"
                      onClick={() => usePendingStore.getState().remove(p.tempId, roomId)}
                      className="text-mist hover:text-rust font-mono"
                    >
                      discard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </div>
  )
}
