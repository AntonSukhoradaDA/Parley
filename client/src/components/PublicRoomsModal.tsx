import { useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'
import { joinRoom, listPublicRooms, type PublicRoom } from '@/lib/rooms'
import { Modal } from './Modal'

export function PublicRoomsModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean
  onClose: () => void
  onJoined: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [rooms, setRooms] = useState<PublicRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await listPublicRooms(search.trim() || undefined)
        if (!cancelled) setRooms(data)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Failed to load rooms')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, search])

  async function onJoin(id: string) {
    setJoiningId(id)
    setError(null)
    try {
      await joinRoom(id)
      onJoined(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join')
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Index"
      title="Browse the floor"
      width="max-w-xl"
    >
      <div className="relative mb-5">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-mist text-sm">
          ⌕
        </span>
        <input
          type="text"
          className="parley-input pl-6"
          placeholder="Search by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-xs text-mist font-mono py-2">loading the index…</div>
      )}
      {!loading && rooms.length === 0 && (
        <div className="text-center py-10">
          <div className="text-paper text-xl font-medium tracking-tight">
            Nothing on the boards.
          </div>
          <p className="text-mist text-sm mt-2">
            No public rooms match that query.
          </p>
        </div>
      )}

      <ul className="divide-y divide-hairline">
        {rooms.map((r) => (
          <li key={r.id} className="py-4 flex items-start gap-4 group">
            <span className="font-mono text-accent/70 text-sm pt-1 w-3">#</span>
            <div className="flex-1 min-w-0">
              <div className="text-paper text-base font-medium tracking-tight leading-tight truncate">
                {r.name}
              </div>
              {r.description && (
                <div className="text-sm text-bone/80 mt-1 line-clamp-2 leading-relaxed">
                  {r.description}
                </div>
              )}
              <div className="eyebrow mt-2">
                {r.memberCount} member{r.memberCount === 1 ? '' : 's'}
              </div>
            </div>
            {r.isMember ? (
              <span className="eyebrow text-accent/80 self-center">Joined</span>
            ) : (
              <button
                type="button"
                disabled={joiningId === r.id}
                onClick={() => onJoin(r.id)}
                className="parley-button-ghost self-center"
              >
                {joiningId === r.id ? 'Joining…' : 'Join →'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
