import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRoomsStore } from '@/store/rooms'
import { logout } from '@/lib/auth'
import { RoomSidebar } from '@/components/RoomSidebar'
import { CreateRoomModal } from '@/components/CreateRoomModal'
import { PublicRoomsModal } from '@/components/PublicRoomsModal'
import { ManageRoomModal } from '@/components/ManageRoomModal'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'

export function ChatPage() {
  const user = useAuthStore((s) => s.user)
  const { rooms, selectedId, loading, refresh, select } = useRoomsStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    refresh()
  }, [refresh])

  const selected = useMemo(
    () => rooms.find((r) => r.id === selectedId) ?? null,
    [rooms, selectedId],
  )

  async function afterRoomChange(roomId?: string) {
    await refresh()
    if (roomId) select(roomId)
  }

  return (
    <div className="h-screen flex flex-col bg-ink text-bone overflow-hidden">
      {/* ─── Masthead ───────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-hairline bg-ink">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="w-px h-5 bg-hairline-strong" aria-hidden />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 group"
            >
              <span className="eyebrow text-mist group-hover:text-chalk transition-colors">
                In session as
              </span>
              <span className="text-paper text-sm font-medium leading-none">
                {user?.username}
              </span>
              <span className="w-7 h-7 rounded-full bg-slate border border-hairline-strong flex items-center justify-center text-paper text-xs font-mono uppercase">
                {user?.username?.charAt(0)}
              </span>
            </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-vellum border border-hairline-strong rounded-[6px] shadow-2xl shadow-black/60 z-40 animate-modal py-1.5">
                <div className="px-4 py-2 border-b border-hairline">
                  <div className="eyebrow text-accent/80 mb-0.5">Account</div>
                  <div className="text-sm text-paper truncate">{user?.email}</div>
                </div>
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
            </>
          )}
          </div>
        </div>
      </header>

      {/* ─── Body ───────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <RoomSidebar
          rooms={rooms}
          selectedId={selectedId}
          onSelect={select}
          onCreate={() => setCreateOpen(true)}
          onBrowse={() => setBrowseOpen(true)}
          loading={loading}
        />

        <main className="flex-1 flex flex-col bg-ink min-w-0">
          {selected ? (
            <>
              <div className="border-b border-hairline px-10 py-7 flex items-end justify-between gap-6">
                <div className="min-w-0">
                  <div className="eyebrow mb-2 text-accent/80">
                    {selected.visibility === 'public' ? 'Public room' : 'Private room'}
                    <span className="mx-2 text-mist">·</span>
                    your role: {selected.role}
                  </div>
                  <h2 className="text-paper text-3xl font-medium tracking-tight leading-tight truncate">
                    <span className="text-accent mr-2 font-mono font-normal">
                      {selected.visibility === 'public' ? '#' : '◆'}
                    </span>
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-3 text-chalk/70 text-sm max-w-2xl leading-relaxed">
                      {selected.description}
                    </p>
                  )}
                  <div className="mt-3 text-mist text-xs font-mono">
                    {selected.memberCount} member{selected.memberCount === 1 ? '' : 's'} · in attendance
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="parley-button-ghost shrink-0"
                >
                  Manage room
                </button>
              </div>
              <div className="flex-1 grain relative flex flex-col items-center justify-center text-center px-8">
                <div className="relative z-10 max-w-md">
                  <div className="eyebrow mb-3 text-accent/70">Phase IV — forthcoming</div>
                  <p className="text-paper text-2xl leading-snug font-medium tracking-tight">
                    The thread waits.
                  </p>
                  <p className="mt-4 text-mist text-sm leading-relaxed">
                    Messaging arrives in the next chapter — composition, replies,
                    edits, attachments, and the long scroll of conversation.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <EmptyChat onBrowse={() => setBrowseOpen(true)} onCreate={() => setCreateOpen(true)} />
          )}
        </main>
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
      <ManageRoomModal
        open={manageOpen}
        room={selected}
        onClose={() => setManageOpen(false)}
        onChanged={() => refresh()}
        onLeft={() => {
          select(null)
          refresh()
        }}
      />
    </div>
  )
}

function EmptyChat({
  onBrowse,
  onCreate,
}: {
  onBrowse: () => void
  onCreate: () => void
}) {
  return (
    <div className="flex-1 grain accent-glow relative flex items-center justify-center px-8">
      <div className="relative z-10 max-w-lg text-center">
        <div className="eyebrow mb-4 text-accent/80">No room selected</div>
        <h1 className="text-paper text-5xl leading-[1.05] tracking-tight font-medium">
          Pick a thread,
          <br />
          or start one.
        </h1>
        <p className="mt-6 text-chalk/70 leading-relaxed max-w-md mx-auto">
          A parley begins with someone choosing the table. Open a room of your
          own, or join the floor in progress.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button type="button" onClick={onCreate} className="parley-button !w-auto !px-6">
            New room →
          </button>
          <button type="button" onClick={onBrowse} className="parley-button-ghost">
            Browse public rooms
          </button>
        </div>
      </div>
    </div>
  )
}
