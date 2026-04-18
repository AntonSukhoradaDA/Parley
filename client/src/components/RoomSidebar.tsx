import { useState } from 'react'
import type { Room } from '@/lib/rooms'
import type { PersonalChat } from '@/lib/personal-chats'
import { usePresenceStore } from '@/store/presence'

export function RoomSidebar({
  rooms,
  personalChats,
  selectedId,
  onSelect,
  onCreate,
  onBrowse,
  loading,
}: {
  rooms: Room[]
  personalChats: PersonalChat[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onBrowse: () => void
  loading: boolean
}) {
  const [openSection, setOpenSection] = useState<{ public: boolean; private: boolean; personal: boolean }>({
    public: true,
    private: true,
    personal: true,
  })
  const publicRooms = rooms.filter((r) => r.visibility === 'public')
  const privateRooms = rooms.filter((r) => r.visibility === 'private')

  return (
    <aside className="w-72 shrink-0 bg-vellum border-r border-hairline flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-hairline">
        <div className="eyebrow mb-2 text-accent/80">Your rooms</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="parley-button flex-1 !py-2 !text-[13px]"
          >
            New room
          </button>
          <button
            type="button"
            onClick={onBrowse}
            className="parley-button-ghost"
            title="Browse public rooms"
          >
            Browse
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {loading && (
          <div className="px-5 py-3 text-xs text-mist font-mono">loading…</div>
        )}
        {!loading && rooms.length === 0 && (
          <div className="px-5 py-8 text-center">
            <div className="text-paper text-lg font-medium tracking-tight leading-tight mb-2">
              Empty desk.
            </div>
            <p className="text-sm text-mist leading-relaxed">
              Open a new room of your own,
              <br />
              or browse the floor.
            </p>
          </div>
        )}

        <Section
          title="Public"
          open={openSection.public}
          onToggle={() => setOpenSection((s) => ({ ...s, public: !s.public }))}
          count={publicRooms.length}
        >
          {publicRooms.map((r) => (
            <RoomItem
              key={r.id}
              room={r}
              selected={r.id === selectedId}
              onSelect={onSelect}
            />
          ))}
          {publicRooms.length === 0 && openSection.public && !loading && rooms.length > 0 && (
            <EmptyHint label="None yet." />
          )}
        </Section>
        <Section
          title="Private"
          open={openSection.private}
          onToggle={() => setOpenSection((s) => ({ ...s, private: !s.private }))}
          count={privateRooms.length}
        >
          {privateRooms.map((r) => (
            <RoomItem
              key={r.id}
              room={r}
              selected={r.id === selectedId}
              onSelect={onSelect}
            />
          ))}
          {privateRooms.length === 0 && openSection.private && !loading && rooms.length > 0 && (
            <EmptyHint label="None yet." />
          )}
        </Section>
        <Section
          title="Direct messages"
          open={openSection.personal}
          onToggle={() => setOpenSection((s) => ({ ...s, personal: !s.personal }))}
          count={personalChats.length}
        >
          {personalChats.map((c) => (
            <PersonalChatItem
              key={c.id}
              chat={c}
              selected={c.id === selectedId}
              onSelect={onSelect}
            />
          ))}
          {personalChats.length === 0 && openSection.personal && !loading && (
            <EmptyHint label="No conversations." />
          )}
        </Section>
      </div>
    </aside>
  )
}

function PersonalChatItem({
  chat,
  selected,
  onSelect,
}: {
  chat: PersonalChat
  selected: boolean
  onSelect: (id: string) => void
}) {
  const unread = usePresenceStore((s) => s.unreadCounts[chat.id] ?? 0)
  const status = usePresenceStore((s) => s.statuses[chat.partner.id])
  const dotColor = status === 'online' ? 'bg-moss' : status === 'afk' ? 'bg-yellow-500' : 'bg-stone'

  return (
    <button
      type="button"
      onClick={() => onSelect(chat.id)}
      className={
        'group relative w-full text-left pl-5 pr-4 py-1.5 flex items-center gap-3 transition-colors ' +
        (selected
          ? 'bg-slate text-paper'
          : 'text-bone hover:bg-slate/50 hover:text-paper')
      }
    >
      {selected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent" aria-hidden />
      )}
      <span className="relative shrink-0">
        <span className="w-5 h-5 rounded-full bg-slate border border-hairline flex items-center justify-center text-mist text-[10px] font-mono uppercase">
          {chat.partner.username.charAt(0)}
        </span>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-vellum ${dotColor}`} />
      </span>
      <span className={`truncate flex-1 text-[14px] tracking-tight ${unread > 0 && !selected ? 'text-paper font-medium' : ''}`}>
        {chat.partner.username}
      </span>
      {chat.frozen && (
        <span className="text-[9.5px] font-mono uppercase tracking-wider text-rust/70">frozen</span>
      )}
      {unread > 0 && !selected && (
        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-ink text-[10px] font-mono font-bold px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

function Section({
  title,
  open,
  onToggle,
  count,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-1.5 text-mist hover:text-chalk transition-colors"
      >
        <span className="eyebrow flex items-center gap-2">
          <span className="text-[10px] text-accent/70">{open ? '▾' : '▸'}</span>
          {title}
        </span>
        <span className="text-[10.5px] font-mono text-mist">
          {String(count).padStart(2, '0')}
        </span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="px-5 py-2 text-xs text-mist/70">{label}</div>
  )
}

function RoomItem({
  room,
  selected,
  onSelect,
}: {
  room: Room
  selected: boolean
  onSelect: (id: string) => void
}) {
  const unread = usePresenceStore((s) => s.unreadCounts[room.id] ?? 0)

  return (
    <button
      type="button"
      onClick={() => onSelect(room.id)}
      className={
        'group relative w-full text-left pl-5 pr-4 py-1.5 flex items-center gap-3 transition-colors ' +
        (selected
          ? 'bg-slate text-paper'
          : 'text-bone hover:bg-slate/50 hover:text-paper')
      }
    >
      {selected && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent"
          aria-hidden
        />
      )}
      <span
        className={
          'text-xs font-mono w-3 ' +
          (room.visibility === 'public' ? 'text-mist' : 'text-accent')
        }
      >
        {room.visibility === 'public' ? '#' : '◆'}
      </span>
      <span className={`truncate flex-1 text-[14px] tracking-tight ${unread > 0 && !selected ? 'text-paper font-medium' : ''}`}>
        {room.name}
      </span>
      {unread > 0 && !selected && (
        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-ink text-[10px] font-mono font-bold px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      {unread === 0 && room.role !== 'member' && (
        <span
          className={
            'text-[9.5px] font-mono uppercase tracking-wider ' +
            (room.role === 'owner' ? 'text-accent' : 'text-mist')
          }
        >
          {room.role}
        </span>
      )}
    </button>
  )
}
