import { useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import {
  formatSize,
  uploadAttachment,
  type AttachmentMeta,
} from '@/lib/attachments'
import { sendMessageWithRetry } from '@/lib/send-message'
import { usePendingStore } from '@/store/pending'
import { useAuthStore } from '@/store/auth'
import { PaperclipIcon } from './icons'
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
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // When entering edit mode, populate with existing content
  if (editMsg && text === '') {
    setText(editMsg.content)
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (const file of list) {
        const meta = await uploadAttachment(roomId, file)
        setAttachments((prev) => [...prev, meta])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  function send() {
    const content = text.trim()
    if (!content && attachments.length === 0 && !editMsg) return

    if (editMsg) {
      if (!content) return
      getSocket().emit('message:edit', { messageId: editMsg.id, content, roomId })
      onCancelEdit()
    } else {
      const user = useAuthStore.getState().user
      if (!user) return
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      usePendingStore.getState().add({
        tempId,
        roomId,
        content,
        replyToId: replyTo?.id,
        replyToSender: replyTo?.sender.username,
        replyToContent: replyTo?.content,
        attachments: [...attachments],
        status: 'sending',
        createdAt: new Date().toISOString(),
        sender: { id: user.id, username: user.username },
      })
      sendMessageWithRetry({
        tempId,
        roomId,
        content,
        replyToId: replyTo?.id,
        attachmentIds: attachments.map((a) => a.id),
      })
      onCancelReply()
      setAttachments([])
    }

    setText('')
    setError(null)
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

  function handlePaste(e: React.ClipboardEvent) {
    if (editMsg) return
    const files: File[] = []
    for (const item of e.clipboardData.items) {
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length) {
      e.preventDefault()
      handleFiles(files)
    }
  }

  const disabledSend =
    uploading ||
    (editMsg ? !text.trim() : !text.trim() && attachments.length === 0)

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

      {/* Attachment chips */}
      {!editMsg && attachments.length > 0 && (
        <div className="px-8 pt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 bg-slate/50 border border-hairline rounded px-2.5 py-1 text-xs"
            >
              <PaperclipIcon className="w-3.5 h-3.5 text-mist shrink-0" />
              <span className="text-chalk max-w-[180px] truncate">{a.filename}</span>
              <span className="text-mist/70 font-mono">{formatSize(a.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="text-mist hover:text-rust ml-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-8 pt-2 text-xs text-rust">{error}</div>
      )}

      <div className="flex items-end gap-3 px-8 py-4">
        {!editMsg && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file"
              className="shrink-0 w-10 h-10 rounded-md border border-hairline-strong bg-slate/50 text-mist hover:text-accent hover:border-accent/50 transition-colors flex items-center justify-center"
            >
              {uploading ? (
                <span className="text-xs font-mono">…</span>
              ) : (
                <PaperclipIcon className="w-4 h-4" />
              )}
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
          disabled={disabledSend}
          className="parley-button !w-auto !px-5 !py-2.5 shrink-0"
        >
          {editMsg ? 'Save' : 'Send'}
        </button>
      </div>
    </div>
  )
}
