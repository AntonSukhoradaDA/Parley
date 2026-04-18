import { useEffect, useState } from 'react'
import {
  downloadAttachment,
  fetchAttachmentBlob,
  formatSize,
  isImageMime,
  type AttachmentMeta,
} from '@/lib/attachments'

interface Props {
  attachment: AttachmentMeta
}

export function AttachmentView({ attachment }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isImageMime(attachment.mimetype)) return
    let url: string | null = null
    let cancelled = false
    fetchAttachmentBlob(attachment.id)
      .then(({ blob }) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImgUrl(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [attachment.id, attachment.mimetype])

  if (isImageMime(attachment.mimetype) && !failed) {
    return (
      <div className="inline-block max-w-sm">
        {imgUrl ? (
          <button
            type="button"
            onClick={() => downloadAttachment(attachment.id)}
            className="block"
            title={`${attachment.filename} — click to download`}
          >
            <img
              src={imgUrl}
              alt={attachment.filename}
              className="max-w-sm max-h-80 rounded border border-hairline"
            />
          </button>
        ) : (
          <div className="w-60 h-40 bg-slate/50 border border-hairline rounded flex items-center justify-center text-mist text-xs">
            Loading image…
          </div>
        )}
        {attachment.comment && (
          <div className="text-mist text-xs mt-1 italic">{attachment.comment}</div>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => downloadAttachment(attachment.id)}
      className="flex items-center gap-3 bg-slate/40 hover:bg-slate/60 border border-hairline rounded px-3 py-2 text-left transition-colors max-w-sm"
    >
      <span className="text-2xl">📄</span>
      <div className="min-w-0 flex-1">
        <div className="text-chalk text-sm truncate">{attachment.filename}</div>
        <div className="text-mist text-xs font-mono">
          {formatSize(attachment.size)}
          {attachment.comment && <span className="ml-2 italic">· {attachment.comment}</span>}
        </div>
      </div>
      <span className="text-accent text-xs">↓</span>
    </button>
  )
}
