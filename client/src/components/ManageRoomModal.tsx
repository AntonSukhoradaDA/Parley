import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api'
import {
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
import { Modal } from './Modal'
import { buttonClass, FormField, inputClass } from './AuthCard'

type Tab = 'members' | 'admins' | 'banned' | 'invitations' | 'settings'

export function ManageRoomModal({
  open,
  room,
  onClose,
  onChanged,
  onLeft,
}: {
  open: boolean
  room: Room | null
  onClose: () => void
  onChanged: () => void
  onLeft: () => void
}) {
  const [tab, setTab] = useState<Tab>('members')

  if (!room) return null

  const isOwner = room.role === 'owner'
  const isAdminPlus = isOwner || room.role === 'admin'

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'members', label: 'Members', visible: true },
    { id: 'admins', label: 'Admins', visible: isOwner },
    { id: 'banned', label: 'Banned', visible: isAdminPlus },
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
      eyebrow="Room ledger"
      title={room.name}
      width="max-w-xl"
      variant="drawer"
    >
      <div className="flex flex-wrap gap-x-1 gap-y-2 -mt-1 mb-6 border-b border-hairline">
        {tabs
          .filter((t) => t.visible)
          .map((t, i) => (
            <TabButton
              key={t.id}
              index={i + 1}
              label={t.label}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            />
          ))}
      </div>

      {tab === 'members' && (
        <MembersTab room={room} onChanged={onChanged} canKick={isAdminPlus} />
      )}
      {tab === 'admins' && isOwner && <AdminsTab room={room} onChanged={onChanged} />}
      {tab === 'banned' && isAdminPlus && <BannedTab room={room} onChanged={onChanged} />}
      {tab === 'invitations' && isAdminPlus && (
        <InvitationsTab room={room} onChanged={onChanged} />
      )}
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
  index,
  label,
  active,
  onClick,
}: {
  index: number
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'group px-3 py-2.5 -mb-px border-b transition-colors flex items-baseline gap-1.5 ' +
        (active
          ? 'border-accent text-paper'
          : 'border-transparent text-mist hover:text-chalk')
      }
    >
      <span className="font-mono text-[10px] text-accent/60 group-hover:text-accent/80">
        {String(index).padStart(2, '0')}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  )
}

function ListShell({
  empty,
  loading,
  error,
  children,
}: {
  empty?: boolean
  loading: boolean
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      {error && (
        <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">
          {error}
        </div>
      )}
      {loading && <div className="text-xs text-mist font-mono">loading…</div>}
      {!loading && empty && (
        <div className="text-paper text-base font-medium tracking-tight py-4">
          Nothing here yet.
        </div>
      )}
      {children}
    </div>
  )
}

function RoleBadge({ role }: { role: 'owner' | 'admin' | 'member' }) {
  const cls =
    role === 'owner'
      ? 'text-accent'
      : role === 'admin'
        ? 'text-chalk'
        : 'text-mist'
  return (
    <span className={'eyebrow ' + cls}>{role}</span>
  )
}

function MembersTab({
  room,
  onChanged,
  canKick,
}: {
  room: Room
  onChanged: () => void
  canKick: boolean
}) {
  const me = useAuthStore((s) => s.user)
  const [members, setMembers] = useState<RoomMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setError(null)
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

  async function onKick(userId: string) {
    if (!confirm('Kick (and ban) this member?')) return
    setBusyId(userId)
    try {
      await kickMember(room.id, userId)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to kick')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ListShell loading={!members} error={error} empty={members?.length === 0}>
      <ul className="divide-y divide-hairline">
        {members?.map((m) => (
          <li key={m.userId} className="py-3 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-paper text-xs font-mono uppercase">
              {m.username.charAt(0)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-paper text-sm font-medium tracking-tight leading-none">
                {m.username}
              </div>
              <div className="eyebrow mt-1">
                joined {new Date(m.joinedAt).toLocaleDateString()}
              </div>
            </div>
            <RoleBadge role={m.role} />
            {canKick && m.role !== 'owner' && m.userId !== me?.id && (
              <button
                type="button"
                disabled={busyId === m.userId}
                onClick={() => onKick(m.userId)}
                className="text-xs text-rust hover:underline ml-1 font-mono"
              >
                kick
              </button>
            )}
          </li>
        ))}
      </ul>
    </ListShell>
  )
}

function AdminsTab({ room, onChanged }: { room: Room; onChanged: () => void }) {
  const [members, setMembers] = useState<RoomMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setError(null)
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

  async function toggle(userId: string, makeAdmin: boolean) {
    setBusyId(userId)
    try {
      await setAdmin(room.id, userId, makeAdmin)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const candidates = members?.filter((m) => m.role !== 'owner') ?? null

  return (
    <ListShell
      loading={!members}
      error={error}
      empty={candidates?.length === 0}
    >
      <ul className="divide-y divide-hairline">
        {candidates?.map((m) => (
          <li key={m.userId} className="py-3 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-paper text-xs font-mono uppercase">
              {m.username.charAt(0)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-paper text-sm font-medium tracking-tight leading-none">
                {m.username}
              </div>
              <div className="eyebrow mt-1">{m.role}</div>
            </div>
            <button
              type="button"
              disabled={busyId === m.userId}
              onClick={() => toggle(m.userId, m.role !== 'admin')}
              className="parley-button-ghost !py-1 !px-3 !text-xs"
            >
              {m.role === 'admin' ? 'Demote' : 'Promote'}
            </button>
          </li>
        ))}
      </ul>
    </ListShell>
  )
}

function BannedTab({ room, onChanged }: { room: Room; onChanged: () => void }) {
  const [bans, setBans] = useState<RoomBan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setError(null)
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

  async function unban(userId: string) {
    setBusyId(userId)
    try {
      await unbanUser(room.id, userId)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ListShell
      loading={!bans}
      error={error}
      empty={bans?.length === 0}
    >
      <ul className="divide-y divide-hairline">
        {bans?.map((b) => (
          <li key={b.userId} className="py-3 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-stone border border-rust/40 flex items-center justify-center text-rust text-xs font-mono uppercase">
              {b.username.charAt(0)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-paper text-sm font-medium tracking-tight leading-none line-through decoration-rust/60">
                {b.username}
              </div>
              <div className="eyebrow mt-1">
                by {b.bannedByUsername} · {new Date(b.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === b.userId}
              onClick={() => unban(b.userId)}
              className="parley-button-ghost !py-1 !px-3 !text-xs"
            >
              Unban
            </button>
          </li>
        ))}
      </ul>
    </ListShell>
  )
}

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
      <p className="text-sm text-bone leading-relaxed mb-5">
        Private rooms are joined by invitation. Send one by username.
      </p>
      <FormField label="Username">
        <input
          type="text"
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="who do you wish to call in?"
          required
        />
      </FormField>
      {error && (
        <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-moss mb-3 font-mono border-l-2 border-moss pl-3 py-1">
          {success}
        </div>
      )}
      <button type="submit" disabled={submitting} className={buttonClass}>
        {submitting ? 'Sending…' : 'Send invitation →'}
      </button>
    </form>
  )
}

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
    if (!confirm(`Delete #${room.name}? This removes all messages and files.`)) return
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
    if (!confirm(`Leave #${room.name}?`)) return
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
        {error && (
          <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">
            {error}
          </div>
        )}
        <p className="text-sm text-bone leading-relaxed mb-5">
          You are a guest in this room. The owner controls its settings — but
          you may take your leave at any time.
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={onLeave}
          className="parley-button-danger"
        >
          Leave room
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSave}>
      <FormField label="Name">
        <input
          type="text"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={64}
          required
        />
      </FormField>
      <FormField label="Description">
        <textarea
          className={inputClass + ' min-h-[88px]'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </FormField>
      <FormField label="Visibility">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVisibility('public')}
            className={
              'rounded-[6px] px-3 py-2 border text-sm transition-colors text-left ' +
              (visibility === 'public'
                ? 'border-accent bg-slate text-paper'
                : 'border-hairline-strong text-bone hover:border-mist')
            }
          >
            <span className="font-mono mr-2 text-mist">#</span>
            <span className="font-medium">Public</span>
          </button>
          <button
            type="button"
            onClick={() => setVisibility('private')}
            className={
              'rounded-[6px] px-3 py-2 border text-sm transition-colors text-left ' +
              (visibility === 'private'
                ? 'border-accent bg-slate text-paper'
                : 'border-hairline-strong text-bone hover:border-mist')
            }
          >
            <span className="font-mono mr-2 text-accent">◆</span>
            <span className="font-medium">Private</span>
          </button>
        </div>
      </FormField>
      {error && (
        <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-moss mb-3 font-mono border-l-2 border-moss pl-3 py-1">
          {success}
        </div>
      )}
      <button type="submit" disabled={submitting} className={buttonClass}>
        {submitting ? 'Saving…' : 'Save changes →'}
      </button>

      <div className="my-7 divider-dotted" />

      <div className="eyebrow text-rust mb-2">Danger zone</div>
      <button
        type="button"
        disabled={submitting}
        onClick={onDelete}
        className="parley-button-danger"
      >
        Delete this room
      </button>
    </form>
  )
}
