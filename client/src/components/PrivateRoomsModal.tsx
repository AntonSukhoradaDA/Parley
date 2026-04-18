import { useMemo, useState } from 'react'
import type { Room } from '@/lib/rooms'
import { Modal } from './Modal'
import { SearchInput } from '@/components/ui'

export function PrivateRoomsModal({
  open,
  rooms,
  onClose,
  onSelect,
}: {
  open: boolean
  rooms: Room[]
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const list = rooms.filter((r) => r.visibility === 'private')
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    )
  }, [rooms, search])

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Private rooms"
      title="Your private rooms"
      width="max-w-xl"
    >
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search your private rooms…"
        className="mb-5"
      />

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <div className="text-paper text-xl font-medium tracking-tight">
            {rooms.some((r) => r.visibility === 'private')
              ? 'Nothing matches.'
              : 'No private rooms yet.'}
          </div>
          <p className="text-mist text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            Private rooms are invitation-only. Accept an invite or have an owner add you to one.
          </p>
        </div>
      )}

      <ul className="divide-y divide-hairline">
        {filtered.map((r) => (
          <li key={r.id} className="py-4 flex items-start gap-4 group">
            <span className="font-mono text-accent/70 text-sm pt-1 w-3">◆</span>
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
                {r.role !== 'member' && (
                  <>
                    <span className="mx-2 text-mist">·</span>
                    <span className={r.role === 'owner' ? 'text-accent/80' : 'text-chalk/80'}>
                      {r.role}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className="parley-button-ghost self-center"
            >
              Open →
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
