import { useAuthStore } from '@/store/auth'

export interface AttachmentMeta {
  id: string
  filename: string
  mimetype: string
  size: number
  comment: string | null
}

export async function uploadAttachment(
  roomId: string,
  file: File,
  comment?: string,
): Promise<AttachmentMeta> {
  const form = new FormData()
  form.append('file', file)
  form.append('roomId', roomId)
  if (comment) form.append('comment', comment)

  const token = useAuthStore.getState().accessToken
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch('/api/attachments/upload', {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    const text = await res.text()
    let message = 'Upload failed'
    try {
      const data = JSON.parse(text)
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  return res.json()
}

export async function fetchAttachmentBlob(id: string): Promise<{ blob: Blob; filename: string }> {
  const token = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api/attachments/${id}/download`, {
    credentials: 'include',
    headers,
  })
  if (!res.ok) throw new Error('Download failed')

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match ? decodeURIComponent(match[1]) : 'download'
  const blob = await res.blob()
  return { blob, filename }
}

export async function downloadAttachment(id: string) {
  const { blob, filename } = await fetchAttachmentBlob(id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isImageMime(mime: string) {
  return mime.startsWith('image/')
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
