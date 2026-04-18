import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  MenuIcon,
  UsersIcon,
} from '@/components/icons'
import { openPersonalChat } from '@/lib/personal-chats'
import type { RoomSidebarHandle } from '@/components/RoomSidebar'
import { useAuthStore } from '@/store/auth'
import { useRoomsStore } from '@/store/rooms'
import { logout } from '@/lib/auth'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { usePresenceStore } from '@/store/presence'
import { RoomSidebar } from '@/components/RoomSidebar'
import { CreateRoomModal } from '@/components/CreateRoomModal'
import { PublicRoomsModal } from '@/components/PublicRoomsModal'
import { PrivateRoomsModal } from '@/components/PrivateRoomsModal'
import { ManageRoomModal } from '@/components/ManageRoomModal'
import { MessageList, type ChatMessage } from '@/components/MessageList'
import { MessageInput } from '@/components/MessageInput'
import { MemberPanel } from '@/components/MemberPanel'
import { ContactsPanel } from '@/components/ContactsPanel'
import { ProfileModal } from '@/components/ProfileModal'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { listRequests } from '@/lib/friends'

export function ChatPage() {
  const user = useAuthStore((s) => s.user)
  const { t } = useTranslation()
  const { rooms, personalChats, selectedId, loading, refresh, select, upsertPersonalChat } =
    useRoomsStore()
  const sidebarRef = useRef<RoomSidebarHandle>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [privateOpen, setPrivateOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageInitialTab, setManageInitialTab] = useState<
    'members' | 'admins' | 'banned' | 'invitations' | 'settings'
  >('members')
  const [menuOpen, setMenuOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editMsg, setEditMsg] = useState<ChatMessage | null>(null)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileTab, setProfileTab] = useState<'password' | 'sessions' | 'bans' | 'danger'>(
    'password',
  )
  const [incomingRequests, setIncomingRequests] = useState(0)
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await listRequests()
        if (!cancelled) setIncomingRequests(r.incoming.length)
      } catch {
        /* ignore */
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [contactsOpen])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Connect socket when authenticated
  useEffect(() => {
    const token = useAuthStore.getState().accessToken
    if (token) getSocket()
    return () => disconnectSocket()
  }, [])

  const selected = useMemo(
    () => rooms.find((r) => r.id === selectedId) ?? null,
    [rooms, selectedId],
  )
  const selectedPersonal = useMemo(
    () => personalChats.find((c) => c.id === selectedId) ?? null,
    [personalChats, selectedId],
  )

  // Clear reply/edit and unread when switching rooms
  useEffect(() => {
    setReplyTo(null)
    setEditMsg(null)
    if (selectedId) {
      usePresenceStore.getState().clearUnread(selectedId)
      getSocket().emit('room:markRead', { roomId: selectedId })
    }
  }, [selectedId])

  async function afterRoomChange(roomId?: string) {
    await refresh()
    if (roomId) select(roomId)
  }

  async function handleSelectFriend(userId: string) {
    try {
      const chat = await openPersonalChat(userId)
      upsertPersonalChat(chat)
      select(chat.id)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="h-screen flex flex-col bg-ink text-bone overflow-hidden">
      {/* ─── Masthead ───────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b border-hairline bg-ink">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open rooms"
              className="parley-icon-button w-8! h-8!"
            >
              <MenuIcon width={16} height={16} />
            </button>
          </div>
          <Logo />
          {(selected || selectedPersonal) && (
            <>
              <span className="text-mist font-mono text-xs select-none">/</span>
              <span className="font-mono text-xs text-chalk truncate">
                {selected
                  ? `${selected.visibility === 'public' ? '#' : '◆'} ${selected.name}`
                  : `@ ${selectedPersonal?.partner.username}`}
              </span>
            </>
          )}
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          <NavButton onClick={() => setBrowseOpen(true)}>{t('nav.publicRooms')}</NavButton>
          <NavButton onClick={() => setPrivateOpen(true)}>{t('nav.privateRooms')}</NavButton>
          <NavButton onClick={() => setContactsOpen(true)} badge={incomingRequests}>
            {t('nav.contacts')}
          </NavButton>
          <NavButton
            onClick={() => {
              setProfileTab('sessions')
              setProfileOpen(true)
            }}
          >
            {t('nav.sessions')}
          </NavButton>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 group"
            >
              <span className="text-[13px] text-bone group-hover:text-paper transition-colors">
                {t('nav.profile')}
              </span>
              <ChevronDownIcon
                width={11}
                height={11}
                className="text-mist group-hover:text-chalk transition-colors"
              />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-vellum border border-hairline-strong rounded-[6px] shadow-2xl shadow-black/60 z-40 animate-modal py-1.5">
                  <div className="px-4 py-2 border-b border-hairline">
                    <div className="eyebrow text-accent/80 mb-0.5">Account</div>
                    <div className="text-sm text-paper truncate">{user?.email}</div>
                  </div>
                  {(['password', 'sessions', 'bans'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setProfileTab(t)
                        setProfileOpen(true)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-bone hover:bg-slate hover:text-paper transition-colors"
                    >
                      {t === 'password'
                        ? 'Change password'
                        : t === 'sessions'
                          ? 'Active sessions'
                          : 'Blocked users'}
                    </button>
                  ))}
                  <div className="border-t border-hairline mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setProfileTab('danger')
                        setProfileOpen(true)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-rust/80 hover:bg-slate hover:text-rust transition-colors"
                    >
                      Delete account…
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        logout()
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-bone hover:bg-slate hover:text-paper transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <NavButton onClick={() => logout()}>{t('common.signOut')}</NavButton>
          <span className="w-px h-5 bg-hairline-strong mx-1.5" aria-hidden />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* ─── Body ───────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop sidebar — inline */}
        <div className="hidden md:flex">
          <RoomSidebar
            ref={sidebarRef}
            rooms={rooms}
            personalChats={personalChats}
            selectedId={selectedId}
            onSelect={select}
            onSelectFriend={handleSelectFriend}
            onCreate={() => setCreateOpen(true)}
            loading={loading}
          />
        </div>

        {/* Mobile drawer — nav actions + rooms/contacts + footer controls */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-ink/70 backdrop-blur-[3px] animate-fade"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs bg-vellum border-r border-hairline-strong animate-drawer-left flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
                <span className="eyebrow text-mist">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Close"
                  className="parley-icon-button !w-7 !h-7"
                >
                  <CloseIcon width={13} height={13} />
                </button>
              </div>

              {/* Nav actions */}
              <div className="py-1 border-b border-hairline">
                <MobileNavItem
                  onClick={() => {
                    setMobileSidebarOpen(false)
                    setBrowseOpen(true)
                  }}
                >
                  {t('nav.publicRooms')}
                </MobileNavItem>
                <MobileNavItem
                  onClick={() => {
                    setMobileSidebarOpen(false)
                    setPrivateOpen(true)
                  }}
                >
                  {t('nav.privateRooms')}
                </MobileNavItem>
                <MobileNavItem
                  onClick={() => {
                    setMobileSidebarOpen(false)
                    setContactsOpen(true)
                  }}
                  badge={incomingRequests}
                >
                  {t('nav.contacts')}
                </MobileNavItem>
                <MobileNavItem
                  onClick={() => {
                    setMobileSidebarOpen(false)
                    setProfileTab('sessions')
                    setProfileOpen(true)
                  }}
                >
                  {t('nav.sessions')}
                </MobileNavItem>
                <MobileNavItem
                  onClick={() => {
                    setMobileSidebarOpen(false)
                    setProfileTab('password')
                    setProfileOpen(true)
                  }}
                >
                  {t('nav.profile')}
                </MobileNavItem>
                <MobileNavItem onClick={() => logout()}>{t('common.signOut')}</MobileNavItem>
              </div>

              {/* Rooms & contacts */}
              <div className="flex-1 min-h-0 flex">
                <RoomSidebar
                  variant="mobile"
                  rooms={rooms}
                  personalChats={personalChats}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    select(id)
                    setMobileSidebarOpen(false)
                  }}
                  onSelectFriend={async (userId) => {
                    await handleSelectFriend(userId)
                    setMobileSidebarOpen(false)
                  }}
                  onCreate={() => {
                    setMobileSidebarOpen(false)
                    setCreateOpen(true)
                  }}
                  loading={loading}
                />
              </div>

              {/* Footer: theme + language + email */}
              <div className="border-t border-hairline px-4 py-2.5 flex items-center justify-between gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <div className="border-t border-hairline px-4 py-2 text-[11px] font-mono text-mist truncate">
                {user?.email}
              </div>
            </div>
          </div>
        )}

        <main className="flex flex-1 flex-col bg-ink min-w-0">
          {selected ? (
            <>
              <div className="border-b border-hairline px-4 md:px-8 py-3 md:py-4 flex items-start md:items-end justify-between gap-3 md:gap-6">
                <div className="md:hidden shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={() => select(null)}
                    aria-label="Back to rooms"
                    className="parley-icon-button !w-8 !h-8"
                  >
                    <ChevronLeftIcon width={14} height={14} />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-paper text-lg md:text-xl font-medium tracking-tight leading-tight truncate">
                    <span className="text-accent mr-2 font-mono font-normal">
                      {selected.visibility === 'public' ? '#' : '◆'}
                    </span>
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-2 text-chalk/70 text-sm max-w-2xl leading-relaxed hidden md:block">
                      {selected.description}
                    </p>
                  )}
                  <div className="mt-1.5 md:mt-2 text-mist text-xs font-mono">
                    {selected.memberCount} member{selected.memberCount === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="md:hidden shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setMobileMembersOpen(true)}
                    aria-label="Show members"
                    className="parley-icon-button !w-8 !h-8"
                  >
                    <UsersIcon width={15} height={15} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="parley-button-ghost shrink-0 hidden md:inline-flex"
                >
                  Manage room
                </button>
              </div>

              <MessageList
                roomId={selected.id}
                onReply={(msg) => {
                  setReplyTo(msg)
                  setEditMsg(null)
                }}
                onEdit={(msg) => {
                  setEditMsg(msg)
                  setReplyTo(null)
                }}
              />

              <MessageInput
                roomId={selected.id}
                replyTo={replyTo}
                editMsg={editMsg}
                onCancelReply={() => setReplyTo(null)}
                onCancelEdit={() => setEditMsg(null)}
              />
            </>
          ) : selectedPersonal ? (
            <>
              <div className="border-b border-hairline px-4 md:px-8 py-3 md:py-4 flex items-start md:items-end justify-between gap-3 md:gap-6">
                <div className="md:hidden shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={() => select(null)}
                    aria-label="Back to rooms"
                    className="parley-icon-button !w-8 !h-8"
                  >
                    <ChevronLeftIcon width={14} height={14} />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow mb-1.5 text-accent/80">Direct message</div>
                  <h2 className="text-paper text-lg md:text-xl font-medium tracking-tight leading-tight truncate">
                    <span className="text-accent mr-2 font-mono font-normal">@</span>
                    {selectedPersonal.partner.username}
                  </h2>
                  {selectedPersonal.frozen && (
                    <p className="mt-2 text-rust/80 text-sm">
                      {selectedPersonal.frozenByMe
                        ? 'You have blocked this user - conversation is read-only.'
                        : 'This conversation is frozen - you cannot send new messages.'}
                    </p>
                  )}
                </div>
              </div>

              <MessageList
                roomId={selectedPersonal.id}
                onReply={(msg) => {
                  setReplyTo(msg)
                  setEditMsg(null)
                }}
                onEdit={(msg) => {
                  setEditMsg(msg)
                  setReplyTo(null)
                }}
              />

              {selectedPersonal.frozen ? (
                <div className="border-t border-hairline bg-vellum px-4 md:px-8 py-4 text-xs text-mist text-center">
                  Messaging is disabled while one of you has blocked the other.
                </div>
              ) : (
                <MessageInput
                  roomId={selectedPersonal.id}
                  replyTo={replyTo}
                  editMsg={editMsg}
                  onCancelReply={() => setReplyTo(null)}
                  onCancelEdit={() => setEditMsg(null)}
                />
              )}
            </>
          ) : (
            <EmptyChat onBrowse={() => setBrowseOpen(true)} onCreate={() => setCreateOpen(true)} />
          )}
        </main>

        {selected && (
          <div className="hidden md:flex">
            <MemberPanel
              room={selected}
              onOpenManage={(tab) => {
                setManageInitialTab(tab)
                setManageOpen(true)
              }}
            />
          </div>
        )}

        {/* Mobile member panel overlay */}
        {selected && mobileMembersOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-ink/70 backdrop-blur-[3px] animate-fade"
            onClick={() => setMobileMembersOpen(false)}
          >
            <div
              className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs animate-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <MemberPanel
                variant="mobile"
                room={selected}
                onClose={() => setMobileMembersOpen(false)}
                onOpenManage={(tab) => {
                  setMobileMembersOpen(false)
                  setManageInitialTab(tab)
                  setManageOpen(true)
                }}
              />
            </div>
          </div>
        )}
      </div>

      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          afterRoomChange(id)
        }}
      />
      <PublicRoomsModal
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        onJoined={(id) => {
          setBrowseOpen(false)
          afterRoomChange(id)
        }}
      />
      <PrivateRoomsModal
        open={privateOpen}
        rooms={rooms}
        onClose={() => setPrivateOpen(false)}
        onSelect={(id) => {
          setPrivateOpen(false)
          select(id)
        }}
      />
      <ManageRoomModal
        open={manageOpen}
        room={selected}
        initialTab={manageInitialTab}
        onClose={() => {
          setManageOpen(false)
          setManageInitialTab('members')
        }}
        onChanged={() => refresh()}
        onLeft={() => {
          select(null)
          refresh()
        }}
      />
      <ContactsPanel open={contactsOpen} onClose={() => setContactsOpen(false)} />
      <ProfileModal
        open={profileOpen}
        initialTab={profileTab}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  )
}

function NavButton({
  onClick,
  badge,
  children,
}: {
  onClick: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative px-2.5 py-1.5 text-[13px] text-bone hover:text-paper transition-colors rounded-[var(--radius-soft)] hover:bg-slate"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] flex items-center justify-center rounded-full bg-accent text-ink text-[9px] font-mono font-bold px-1">
          {badge}
        </span>
      )}
    </button>
  )
}

function MobileNavItem({
  onClick,
  badge,
  danger,
  children,
}: {
  onClick: () => void
  badge?: number
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full text-left px-5 py-2.5 text-[14px] transition-colors flex items-center justify-between ' +
        (danger
          ? 'text-rust/80 hover:bg-slate hover:text-rust'
          : 'text-bone hover:bg-slate hover:text-paper')
      }
    >
      <span>{children}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent text-ink text-[10px] font-mono font-bold">
          {badge}
        </span>
      )}
    </button>
  )
}

function EmptyChat({ onBrowse, onCreate }: { onBrowse: () => void; onCreate: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 grain accent-glow relative flex items-center justify-center px-8">
      <div className="relative z-10 max-w-lg text-center">
        <div className="eyebrow mb-4 text-accent/80">{t('chat.empty.eyebrow')}</div>
        <h1 className="text-paper text-5xl leading-[1.05] tracking-tight font-medium">
          {t('chat.empty.title_line1')}
          <br />
          {t('chat.empty.title_line2')}
        </h1>
        <p className="mt-6 text-chalk/70 leading-relaxed max-w-md mx-auto">
          {t('chat.empty.body')}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCreate}
            className="parley-button !w-auto !px-6 !py-2.5 !text-[13px]"
          >
            {t('chat.empty.newRoom')}
          </button>
          <button
            type="button"
            onClick={onBrowse}
            className="parley-button-ghost !px-6 !py-2.5 !text-[13px]"
          >
            {t('chat.empty.browse')}
          </button>
        </div>
      </div>
    </div>
  )
}
