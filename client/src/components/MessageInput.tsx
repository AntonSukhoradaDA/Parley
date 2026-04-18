import { useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import type { ChatMessage } from './MessageList'

interface Props {
  roomId: string
  replyTo: ChatMessage | null
  editMsg: ChatMessage | null
  onCancelReply: () => void
  onCancelEdit: () => void
}

export function MessageInput({ roomId, replyTo, editMsg, onCancelReply, onCancelEdit }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When entering edit mode, populate with existing content
  if (editMsg && text === '') {
    setText(editMsg.content)
  }

  function send() {
    const content = text.trim()
    if (!content) return

    const socket = getSocket()

    if (editMsg) {
      socket.emit('message:edit', { messageId: editMsg.id, content, roomId })
      onCancelEdit()
    } else {
      socket.emit('message:send', {
        roomId,
        content,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      })
      onCancelReply()
    }

    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
    if (e.key === 'Escape') {
      if (editMsg) onCancelEdit()
      if (replyTo) onCancelReply()
      setText('')
    }
  }

  return (
    <div className="border-t border-hairline bg-vellum">
      {/* Reply / edit indicator */}
      {(replyTo || editMsg) && (
        <div className="px-8 pt-3 flex items-center gap-2 text-xs">
          <span className="text-accent">
            {editMsg ? 'Editing message' : `Replying to ${replyTo!.sender.username}`}
          </span>
          {!editMsg && replyTo && (
            <span className="text-mist truncate max-w-xs">{replyTo.content}</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (editMsg) { onCancelEdit(); setText('') }
              else onCancelReply()
            }}
            className="text-mist hover:text-rust ml-auto"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-3 px-8 py-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message... (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 bg-slate/50 text-paper text-sm border border-hairline-strong rounded-md px-4 py-2.5 resize-none outline-none focus:border-accent/50 transition-colors placeholder:text-mist"
          style={{ minHeight: '40px', maxHeight: '120px' }}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          className="parley-button !w-auto !px-5 !py-2.5 shrink-0"
        >
          {editMsg ? 'Save' : 'Send'}
        </button>
      </div>
    </div>
  )
}
