import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api'
import {
  banUser as banFromRoom,
  deleteRoom,
  inviteToRoom,
  kickMember,
  leaveRoom,
  listBans,
  listMembers,
  setAdmin,
  unbanUser,
  updateRoom,
  type Room,
  type RoomBan,
  type RoomMember,
  type RoomVisibility,
} from '@/lib/rooms'
import { useAuthStore } from '@/store/auth'
import { usePresenceStore, type PresenceStatus } from '@/store/presence'
import { Modal } from './Modal'
import { PresenceDot, SearchInput } from '@/components/ui'

type Tab = 'members' | 'admins' | 'banned' | 'invitations' | 'settings'

export function ManageRoomModal({
  open,
  room,
  onClose,
  onChanged,
  onLeft,
  initialTab,
}: {
  open: boolean
  room: Room | null
  onClose: () => void
  onChanged: () => void
  onLeft: () => void
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'members')

  useEffect(() => {
    if (open && initialTab) setTab(initialTab)
  }, [open, initialTab])

  if (!room) return null

  const isOwner = room.role === 'owner'
  const isAdminPlus = isOwner || room.role === 'admin'

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'members', label: 'Members', visible: true },
    { id: 'admins', label: 'Admins', visible: isAdminPlus },
    { id: 'banned', label: 'Banned users', visible: isAdminPlus },
    {
      id: 'invitations',
      label: 'Invitations',
      visible: isAdminPlus && room.visibility === 'private',
    },
    { id: 'settings', label: 'Settings', visible: true },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Manage room"
      title={`${room.visibility === 'public' ? '#' : '◆'} ${room.name}`}
      width="max-w-3xl"
    >
      <div className="flex flex-wrap gap-x-1 gap-y-2 -mt-1 mb-5 border-b border-hairline">
        {tabs
          .filter((t) => t.visible)
          .map((t) => (
            <TabButton
              key={t.id}
              label={t.label}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            />
          ))}
      </div>

      {tab === 'members' && (
        <MembersTab room={room} isOwner={isOwner} isAdminPlus={isAdminPlus} onChanged={onChanged} />
      )}
      {tab === 'admins' && isAdminPlus && (
        <AdminsTab room={room} isOwner={isOwner} onChanged={onChanged} />
      )}
      {tab === 'banned' && isAdminPlus && <BannedTab room={room} onChanged={onChanged} />}
      {tab === 'invitations' && isAdminPlus && <InvitationsTab room={room} onChanged={onChanged} />}
      {tab === 'settings' && (
        <SettingsTab
          room={room}
          isOwner={isOwner}
          onChanged={onChanged}
          onClose={onClose}
          onLeft={onLeft}
        />
      )}
    </Modal>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-2.5 -mb-px border-b transition-colors text-[13px] ' +
        (active ? 'border-accent text-paper' : 'border-transparent text-mist hover:text-chalk')
      }
    >
      {label}
    </button>
  )
}

function FeedbackBanner({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null
  return (
    <div
      className={`text-[12px] font-mono border-l-2 pl-3 py-1 mb-3 ${
        error ? 'border-rust text-rust' : 'border-moss text-moss'
      }`}
    >
      {error ?? success}
    </div>
  )
}

function statusLabel(s: PresenceStatus): string {
  return s === 'afk' ? 'AFK' : s
}

// ─── Members tab ──────────────────────────────────────────────────────
function MembersTab({
  room,
  isOwner,
  isAdminPlus,
  onChanged,
}: {
  room: Room
  isOwner: boolean
  isAdminPlus: boolean
  onChanged: () => void
}) {
  const me = useAuthStore((s) => s.user)
  const statuses = usePresenceStore((s) => s.statuses)
  const [members, setMembers] = useState<RoomMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  async function load() {
    try {
      setMembers(await listMembers(room.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  async function run(userId: string, fn: () => Promise<unknown>, msg: string) {
    setBusyId(userId)
    setError(null)
    setSuccess(null)
    try {
      await fn()
      setSuccess(msg)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = (members ?? []).filter((m) => !q || m.username.toLowerCase().includes(q))

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} placeholder="Search member" className="mb-4" />
      <FeedbackBanner error={error} success={success} />
      {!members && <div className="text-xs text-mist font-mono">loading…</div>}
      {members && filtered.length === 0 && (
        <div className="text-mist text-sm py-6 text-center">No members match.</div>
      )}
      {filtered.length > 0 && (
        <div className="border border-hairline rounded-[var(--radius-soft)] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate/40 text-mist text-[11px] uppercase tracking-wider font-mono">
                <th className="text-left px-3 py-2 font-normal">Username</th>
                <th className="text-left px-3 py-2 font-normal">Status</th>
                <th className="text-left px-3 py-2 font-normal">Role</th>
                <th className="text-right px-3 py-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.map((m) => {
                const status = statuses[m.userId] ?? 'offline'
                const isSelf = m.userId === me?.id
                const busy = busyId === m.userId
                return (
                  <tr key={m.userId} className="hover:bg-slate/20">
                    <td className="px-3 py-2 text-paper">{m.username}</td>
                    <td className="px-3 py-2 text-bone">
                      <span className="inline-flex items-center gap-2">
                        <PresenceDot status={status} />
                        {statusLabel(status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          'text-[11px] font-mono uppercase tracking-wider ' +
                          (m.role === 'owner'
                            ? 'text-accent'
                            : m.role === 'admin'
                              ? 'text-chalk'
                              : 'text-mist')
                        }
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isSelf || m.role === 'owner' ? (
                        <span className="text-mist/60">-</span>
                      ) : (
                        <div className="inline-flex gap-1.5">
                          {m.role === 'admin' && isOwner && (
                            <RowButton
                              disabled={busy}
                              onClick={() =>
                                run(
                                  m.userId,
                                  () => setAdmin(room.id, m.userId, false),
                                  `Removed ${m.username} as admin`,
                                )
                              }
                            >
                              Remove admin
                            </RowButton>
                          )}
                          {m.role === 'member' && isAdminPlus && (
                            <RowButton
                              disabled={busy}
                              onClick={() =>
                                run(
                                  m.userId,
                                  () => setAdmin(room.id, m.userId, true),
                                  `Promoted ${m.username}`,
                                )
                              }
                            >
                              Make admin
                            </RowButton>
                          )}
                          {isAdminPlus && (
                            <>
                              <RowButton
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    !confirm(
                                      `Remove ${m.username} from the room? They may rejoin later.`,
                                    )
                                  )
                                    return
                                  run(
                                    m.userId,
                                    () => kickMember(room.id, m.userId),
                                    `Removed ${m.username}`,
                                  )
                                }}
                              >
                                Remove from room
                              </RowButton>
                              <RowButton
                                disabled={busy}
                                danger
                                onClick={() => {
                                  if (
                                    !confirm(`Ban ${m.username}? They will not be able to rejoin.`)
                                  )
                                    return
                                  run(
                                    m.userId,
                                    () => banFromRoom(room.id, m.userId),
                                    `Banned ${m.username}`,
                                  )
                                }}
                              >
                                Ban
                              </RowButton>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Admins tab ───────────────────────────────────────────────────────
function AdminsTab({
  room,
  isOwner,
  onChanged,
}: {
  room: Room
  isOwner: boolean
  onChanged: () => void
}) {
  const [members, setMembers] = useState<RoomMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    try {
      setMembers(await listMembers(room.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  async function demote(userId: string, username: string) {
    setBusyId(userId)
    setError(null)
    setSuccess(null)
    try {
      await setAdmin(room.id, userId, false)
      setSuccess(`Removed ${username} as admin`)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!members) return <div className="text-xs text-mist font-mono">loading…</div>

  const owner = members.find((m) => m.role === 'owner')
  const admins = members.filter((m) => m.role === 'admin')
  const summary = [owner?.username, ...admins.map((a) => a.username)].filter(Boolean).join(', ')

  return (
    <div>
      <FeedbackBanner error={error} success={success} />
      <p className="text-[13px] text-bone mb-4">
        <span className="text-mist">Current admins:</span> {summary || '-'}
      </p>
      <div className="border border-hairline rounded-[var(--radius-soft)] divide-y divide-hairline">
        {owner && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-paper text-[13px]">{owner.username}</span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-accent">
              owner
            </span>
            <span className="ml-auto text-[12px] text-mist italic">cannot lose admin rights</span>
          </div>
        )}
        {admins.map((a) => (
          <div key={a.userId} className="flex items-center gap-3 px-4 py-3">
            <span className="text-paper text-[13px]">{a.username}</span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-chalk">admin</span>
            {isOwner && (
              <div className="ml-auto">
                <RowButton
                  disabled={busyId === a.userId}
                  onClick={() => demote(a.userId, a.username)}
                >
                  Remove admin
                </RowButton>
              </div>
            )}
          </div>
        ))}
        {admins.length === 0 && (
          <div className="px-4 py-4 text-[12px] text-mist italic">No additional admins.</div>
        )}
      </div>
    </div>
  )
}

// ─── Banned users tab ─────────────────────────────────────────────────
function BannedTab({ room, onChanged }: { room: Room; onChanged: () => void }) {
  const [bans, setBans] = useState<RoomBan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    try {
      setBans(await listBans(room.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  async function unban(userId: string, username: string) {
    setBusyId(userId)
    setError(null)
    setSuccess(null)
    try {
      await unbanUser(room.id, userId)
      setSuccess(`Unbanned ${username}`)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <FeedbackBanner error={error} success={success} />
      {!bans && <div className="text-xs text-mist font-mono">loading…</div>}
      {bans && bans.length === 0 && (
        <div className="text-mist text-sm py-6 text-center">No banned users.</div>
      )}
      {bans && bans.length > 0 && (
        <div className="border border-hairline rounded-[var(--radius-soft)] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate/40 text-mist text-[11px] uppercase tracking-wider font-mono">
                <th className="text-left px-3 py-2 font-normal">Username</th>
                <th className="text-left px-3 py-2 font-normal">Banned by</th>
                <th className="text-left px-3 py-2 font-normal">Date/time</th>
                <th className="text-right px-3 py-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {bans.map((b) => (
                <tr key={b.userId} className="hover:bg-slate/20">
                  <td className="px-3 py-2 text-paper">{b.username}</td>
                  <td className="px-3 py-2 text-bone">{b.bannedByUsername}</td>
                  <td className="px-3 py-2 text-mist font-mono text-[12px]">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowButton
                      disabled={busyId === b.userId}
                      onClick={() => unban(b.userId, b.username)}
                    >
                      Unban
                    </RowButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Invitations tab ──────────────────────────────────────────────────
function InvitationsTab({ room, onChanged }: { room: Room; onChanged: () => void }) {
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      await inviteToRoom(room.id, username)
      setSuccess(`Invited ${username}`)
      setUsername('')
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to invite')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FeedbackBanner error={error} success={success} />
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <label className="block eyebrow mb-1 text-mist">Invite by username</label>
          <input
            type="text"
            className="w-full bg-slate/60 border border-hairline text-paper placeholder:text-mist text-[13px] rounded-[var(--radius-soft)] px-3 py-2 outline-none focus:border-accent/60 transition-colors"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !username.trim()}
          className="parley-button !w-auto !px-4 !py-2 !text-[13px] mt-[22px]"
        >
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </form>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────
function SettingsTab({
  room,
  isOwner,
  onChanged,
  onClose,
  onLeft,
}: {
  room: Room
  isOwner: boolean
  onChanged: () => void
  onClose: () => void
  onLeft: () => void
}) {
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description)
  const [visibility, setVisibility] = useState<RoomVisibility>(room.visibility)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      await updateRoom(room.id, { name, description, visibility })
      setSuccess('Saved')
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!confirm(`Delete room "${room.name}"? This removes all messages and files.`)) return
    setSubmitting(true)
    try {
      await deleteRoom(room.id)
      onLeft()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete')
      setSubmitting(false)
    }
  }

  async function onLeave() {
    if (!confirm(`Leave room "${room.name}"?`)) return
    setSubmitting(true)
    try {
      await leaveRoom(room.id)
      onLeft()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to leave')
      setSubmitting(false)
    }
  }

  if (!isOwner) {
    return (
      <div>
        <FeedbackBanner error={error} success={null} />
        <p className="text-[13px] text-bone leading-relaxed mb-5">
          Only the owner can change room settings. You may leave the room at any time.
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={onLeave}
          className="parley-button-danger !w-auto !px-4"
        >
          Leave room
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <FeedbackBanner error={error} success={success} />

      <FieldRow label="Room name">
        <input
          type="text"
          className="flex-1 bg-slate/60 border border-hairline text-paper text-[13px] rounded-[var(--radius-soft)] px-3 py-2 outline-none focus:border-accent/60 transition-colors"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={64}
          required
        />
      </FieldRow>

      <FieldRow label="Description">
        <textarea
          className="flex-1 bg-slate/60 border border-hairline text-paper text-[13px] rounded-[var(--radius-soft)] px-3 py-2 outline-none focus:border-accent/60 transition-colors min-h-[60px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </FieldRow>

      <FieldRow label="Visibility">
        <div className="flex-1 flex items-center gap-6">
          <RadioOption
            checked={visibility === 'public'}
            onChange={() => setVisibility('public')}
            label="Public"
          />
          <RadioOption
            checked={visibility === 'private'}
            onChange={() => setVisibility('private')}
            label="Private"
          />
        </div>
      </FieldRow>

      <div className="pt-4 flex items-center justify-between border-t border-hairline">
        <button
          type="submit"
          disabled={submitting}
          className="parley-button !w-auto !px-4 !py-2 !text-[13px]"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onDelete}
          className="parley-button-danger !w-auto !px-4"
        >
          Delete room
        </button>
      </div>
    </form>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-4">
      <span className="w-32 shrink-0 pt-2 text-[13px] text-mist">{label}</span>
      {children}
    </label>
  )
}

function RadioOption({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-[13px] text-bone">
      <span
        onClick={onChange}
        className={
          'relative w-4 h-4 rounded-full border transition-colors ' +
          (checked ? 'border-accent' : 'border-hairline-strong')
        }
      >
        {checked && <span className="absolute inset-[3px] rounded-full bg-accent" />}
      </span>
      <input type="radio" className="sr-only" checked={checked} onChange={onChange} />
      <span className={checked ? 'text-paper' : ''}>{label}</span>
    </label>
  )
}

// ─── Shared row action button ─────────────────────────────────────────
function RowButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'px-2.5 py-1 text-[11px] font-mono rounded-[var(--radius-soft)] border transition-colors disabled:opacity-40 ' +
        (danger
          ? 'border-rust/40 text-rust hover:bg-rust/10 hover:border-rust'
          : 'border-hairline-strong text-chalk hover:border-accent/50 hover:text-paper')
      }
    >
      {children}
    </button>
  )
}
