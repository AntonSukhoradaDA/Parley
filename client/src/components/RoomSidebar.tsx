import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Room } from '@/lib/rooms'
import type { PersonalChat } from '@/lib/personal-chats'
import { listFriends, type Friend } from '@/lib/friends'
import { usePresenceStore } from '@/store/presence'
import { Avatar, Badge, PresenceDot, SearchInput } from '@/components/ui'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'

export interface RoomSidebarHandle {
  focusPrivate: () => void
}

export const RoomSidebar = forwardRef<
  RoomSidebarHandle,
  {
    rooms: Room[]
    personalChats: PersonalChat[]
    selectedId: string | null
    onSelect: (id: string) => void
    onSelectFriend: (userId: string) => void
    onCreate: () => void
    loading: boolean
    variant?: 'desktop' | 'mobile'
  }
>(function RoomSidebar(
  {
    rooms,
    personalChats,
    selectedId,
    onSelect,
    onSelectFriend,
    onCreate,
    loading,
    variant = 'desktop',
  },
  ref,
) {
  const { t } = useTranslation()
  const [openSection, setOpenSection] = useState<{
    public: boolean
    private: boolean
    contacts: boolean
  }>({ public: true, private: true, contacts: true })
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const privateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listFriends()
      .then((f) => {
        if (!cancelled) setFriends(f)
      })
      .catch(() => {
        /* ignore */
      })
    const interval = setInterval(() => {
      listFriends()
        .then((f) => {
          if (!cancelled) setFriends(f)
        })
        .catch(() => {})
    }, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    focusPrivate: () => {
      setCollapsed(false)
      setOpenSection((s) => ({ ...s, private: true }))
      requestAnimationFrame(() => {
        privateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Brief highlight to confirm the jump landed.
        const el = privateRef.current
        if (!el) return
        el.classList.add('ring-1', 'ring-accent/60')
        window.setTimeout(() => el.classList.remove('ring-1', 'ring-accent/60'), 900)
      })
    },
  }))

  const q = query.trim().toLowerCase()
  const matchRoom = (r: Room) => !q || r.name.toLowerCase().includes(q)
  const matchFriend = (f: Friend) => !q || f.username.toLowerCase().includes(q)
  const publicRooms = rooms.filter((r) => r.visibility === 'public').filter(matchRoom)
  const privateRooms = rooms.filter((r) => r.visibility === 'private').filter(matchRoom)
  const filteredFriends = friends.filter(matchFriend)

  // Map friend → their personal chat (if any) for unread counts + DM selection.
  const chatByPartner = new Map<string, PersonalChat>()
  for (const c of personalChats) chatByPartner.set(c.partner.id, c)

  if (collapsed && variant === 'desktop') {
    return (
      <aside className="w-10 shrink-0 bg-vellum border-r border-hairline flex flex-col items-center py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="parley-icon-button"
          title={t('sidebar.expand')}
          aria-label={t('sidebar.expand')}
        >
          <ChevronRightIcon width={12} height={12} />
        </button>
        <div className="mt-3 eyebrow text-mist" style={{ writingMode: 'vertical-rl' }}>
          {t('sidebar.roomsContacts')}
        </div>
      </aside>
    )
  }

  const rootCls =
    variant === 'mobile'
      ? 'w-full h-full bg-vellum flex flex-col min-h-0'
      : 'w-64 shrink-0 bg-vellum border-r border-hairline flex flex-col'

  return (
    <aside className={rootCls}>
      {variant === 'desktop' && (
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-hairline">
          <div className="eyebrow text-mist">{t('sidebar.navigator')}</div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="parley-icon-button !w-6 !h-6"
            title={t('sidebar.collapse')}
            aria-label={t('sidebar.collapse')}
          >
            <ChevronLeftIcon width={12} height={12} />
          </button>
        </div>
      )}
      <div className="px-4 pt-3 pb-3 border-b border-hairline">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('sidebar.searchPlaceholder')}
        />
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {loading && (
          <div className="px-5 py-3 text-xs text-mist font-mono">{t('common.loading')}</div>
        )}
        {!loading && rooms.length === 0 && friends.length === 0 && (
          <div className="px-5 py-8 text-center">
            <div className="text-paper text-lg font-medium tracking-tight leading-tight mb-2">
              {t('sidebar.empty.title')}
            </div>
            <p className="text-sm text-mist leading-relaxed">
              {t('sidebar.empty.body_line1')}
              <br />
              {t('sidebar.empty.body_line2')}
            </p>
          </div>
        )}

        <div className="px-5 mb-2">
          <div className="eyebrow text-mist">{t('sidebar.sections.rooms')}</div>
        </div>
        <Section
          title={t('sidebar.sections.public')}
          open={openSection.public}
          onToggle={() => setOpenSection((s) => ({ ...s, public: !s.public }))}
          count={publicRooms.length}
        >
          {publicRooms.map((r) => (
            <RoomItem key={r.id} room={r} selected={r.id === selectedId} onSelect={onSelect} />
          ))}
          {publicRooms.length === 0 && openSection.public && !loading && rooms.length > 0 && (
            <EmptyHint label={q ? t('sidebar.hints.noMatches') : t('sidebar.hints.noneYet')} />
          )}
        </Section>
        <Section
          ref={privateRef}
          title={t('sidebar.sections.private')}
          open={openSection.private}
          onToggle={() => setOpenSection((s) => ({ ...s, private: !s.private }))}
          count={privateRooms.length}
        >
          {privateRooms.map((r) => (
            <RoomItem key={r.id} room={r} selected={r.id === selectedId} onSelect={onSelect} />
          ))}
          {privateRooms.length === 0 && openSection.private && !loading && rooms.length > 0 && (
            <EmptyHint label={q ? t('sidebar.hints.noMatches') : t('sidebar.hints.noneYet')} />
          )}
        </Section>

        <div className="px-5 mb-2 mt-4">
          <div className="eyebrow text-mist">{t('sidebar.sections.contacts')}</div>
        </div>
        <Section
          title={t('sidebar.sections.friends')}
          open={openSection.contacts}
          onToggle={() => setOpenSection((s) => ({ ...s, contacts: !s.contacts }))}
          count={filteredFriends.length}
        >
          {filteredFriends.map((f) => {
            const chat = chatByPartner.get(f.userId)
            return (
              <FriendItem
                key={f.userId}
                friend={f}
                chat={chat}
                selected={!!chat && chat.id === selectedId}
                onClick={() => onSelectFriend(f.userId)}
              />
            )
          })}
          {filteredFriends.length === 0 && openSection.contacts && (
            <EmptyHint label={q ? t('sidebar.hints.noMatches') : t('sidebar.hints.noContacts')} />
          )}
        </Section>
      </div>

      <div className="px-4 py-3 border-t border-hairline">
        <button
          type="button"
          onClick={onCreate}
          className="parley-button w-full !py-1.5 !text-[13px]"
        >
          {t('sidebar.createRoom')}
        </button>
      </div>
    </aside>
  )
})

function FriendItem({
  friend,
  chat,
  selected,
  onClick,
}: {
  friend: Friend
  chat?: PersonalChat
  selected: boolean
  onClick: () => void
}) {
  const unread = usePresenceStore((s) => (chat ? (s.unreadCounts[chat.id] ?? 0) : 0))
  const status = usePresenceStore((s) => s.statuses[friend.userId]) ?? 'offline'

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'group relative w-full text-left pl-5 pr-4 py-1.5 flex items-center gap-3 transition-colors ' +
        (selected ? 'bg-slate text-paper' : 'text-bone hover:bg-slate/50 hover:text-paper')
      }
    >
      {selected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent" aria-hidden />
      )}
      <span className="relative shrink-0">
        <Avatar name={friend.username} size="xs" />
        <PresenceDot
          status={status}
          className="absolute -bottom-0.5 -right-0.5 border border-vellum"
        />
      </span>
      <span
        className={`truncate flex-1 text-[14px] tracking-tight ${unread > 0 && !selected ? 'text-paper font-medium' : ''}`}
      >
        {friend.username}
      </span>
      {chat?.frozen && (
        <span className="text-[9.5px] font-mono uppercase tracking-wider text-rust/70">frozen</span>
      )}
      {!selected && <Badge count={unread} />}
    </button>
  )
}

const Section = forwardRef<
  HTMLDivElement,
  {
    title: string
    open: boolean
    onToggle: () => void
    count: number
    children: React.ReactNode
  }
>(function Section({ title, open, onToggle, count, children }, ref) {
  return (
    <div ref={ref} className="mb-2 rounded transition-shadow">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-1.5 text-mist hover:text-chalk transition-colors"
      >
        <span className="eyebrow flex items-center gap-2">
          <span className="text-[10px] text-accent/70">{open ? '▾' : '▸'}</span>
          {title}
        </span>
        <span className="text-[10.5px] font-mono text-mist">{count}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
})

function EmptyHint({ label }: { label: string }) {
  return <div className="px-5 py-2 text-xs text-mist/70">{label}</div>
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
        (selected ? 'bg-slate text-paper' : 'text-bone hover:bg-slate/50 hover:text-paper')
      }
    >
      {selected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent" aria-hidden />
      )}
      <span
        className={
          'text-xs font-mono w-3 ' + (room.visibility === 'public' ? 'text-mist' : 'text-accent')
        }
      >
        {room.visibility === 'public' ? '#' : '◆'}
      </span>
      <span
        className={`truncate flex-1 text-[14px] tracking-tight ${unread > 0 && !selected ? 'text-paper font-medium' : ''}`}
      >
        {room.name}
      </span>
      {!selected && <Badge count={unread} />}
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
