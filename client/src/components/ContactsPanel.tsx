import { useEffect, useState } from 'react'
import {
  listFriends,
  listRequests,
  acceptRequest,
  rejectRequest,
  removeFriend,
  banUser,
  sendFriendRequest,
  type Friend,
  type FriendRequests,
} from '@/lib/friends'
import { usePresenceStore, type PresenceStatus } from '@/store/presence'
import { ApiError } from '@/lib/api'
import { Modal } from './Modal'

export function ContactsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const statuses = usePresenceStore((s) => s.statuses)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [f, r] = await Promise.all([listFriends(), listRequests()])
      setFriends(f)
      setRequests(r)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const pendingCount = requests.incoming.length

  return (
    <Modal open={open} onClose={onClose} eyebrow="Contacts" title="Your circle" variant="drawer" width="max-w-sm">
      <div className="flex gap-1 -mt-1 mb-5 border-b border-hairline">
        {(['friends', 'requests', 'add'] as const).map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(null) }}
            className={
              'group px-3 py-2.5 -mb-px border-b transition-colors flex items-baseline gap-1.5 ' +
              (tab === t ? 'border-accent text-paper' : 'border-transparent text-mist hover:text-chalk')
            }
          >
            <span className="font-mono text-[10px] text-accent/60">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-sm">
              {t === 'friends' ? 'Friends' : t === 'requests' ? 'Requests' : 'Add'}
            </span>
            {t === 'requests' && pendingCount > 0 && (
              <span className="min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-accent text-ink text-[9px] font-mono font-bold px-1">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">{error}</div>
      )}

      {loading && <div className="text-xs text-mist font-mono">loading…</div>}

      {!loading && tab === 'friends' && (
        <FriendsTab friends={friends} statuses={statuses} onAction={load} setError={setError} />
      )}
      {!loading && tab === 'requests' && (
        <RequestsTab requests={requests} onAction={load} setError={setError} />
      )}
      {!loading && tab === 'add' && (
        <AddFriendTab onSent={load} setError={setError} />
      )}
    </Modal>
  )
}

function FriendsTab({
  friends,
  statuses,
  onAction,
  setError,
}: {
  friends: Friend[]
  statuses: Record<string, PresenceStatus>
  onAction: () => void
  setError: (e: string | null) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  if (friends.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-paper text-lg font-medium tracking-tight mb-2">No friends yet.</div>
        <p className="text-sm text-mist">Use the Add tab to send a friend request.</p>
      </div>
    )
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this friend?')) return
    setBusyId(userId)
    setError(null)
    try {
      await removeFriend(userId)
      onAction()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleBan(userId: string) {
    if (!confirm('Ban this user? This will also remove them from your friends.')) return
    setBusyId(userId)
    setError(null)
    try {
      await banUser(userId)
      onAction()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ul className="divide-y divide-hairline">
      {friends.map((f) => {
        const status = statuses[f.userId] ?? 'offline'
        const dotColor = status === 'online' ? 'bg-moss' : status === 'afk' ? 'bg-yellow-500' : 'bg-stone'
        return (
          <li key={f.userId} className="py-3 flex items-center gap-3 group">
            <div className="relative">
              <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-paper text-xs font-mono uppercase">
                {f.username.charAt(0)}
              </span>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-vellum ${dotColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-paper text-sm font-medium tracking-tight truncate">{f.username}</div>
              <div className="eyebrow">{status}</div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
              <button
                type="button"
                disabled={busyId === f.userId}
                onClick={() => handleRemove(f.userId)}
                className="text-[10px] text-mist hover:text-rust font-mono"
              >
                remove
              </button>
              <button
                type="button"
                disabled={busyId === f.userId}
                onClick={() => handleBan(f.userId)}
                className="text-[10px] text-mist hover:text-rust font-mono"
              >
                ban
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function RequestsTab({
  requests,
  onAction,
  setError,
}: {
  requests: FriendRequests
  onAction: () => void
  setError: (e: string | null) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handle(id: string, action: 'accept' | 'reject') {
    setBusyId(id)
    setError(null)
    try {
      if (action === 'accept') await acceptRequest(id)
      else await rejectRequest(id)
      onAction()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  if (requests.incoming.length === 0 && requests.outgoing.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-paper text-lg font-medium tracking-tight mb-2">No pending requests.</div>
      </div>
    )
  }

  return (
    <div>
      {requests.incoming.length > 0 && (
        <>
          <div className="eyebrow text-accent/80 mb-2">Incoming</div>
          <ul className="divide-y divide-hairline mb-5">
            {requests.incoming.map((r) => (
              <li key={r.id} className="py-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-paper text-xs font-mono uppercase">
                  {r.username.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-paper text-sm font-medium tracking-tight">{r.username}</div>
                  {r.message && <div className="text-xs text-mist mt-0.5 truncate">{r.message}</div>}
                </div>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handle(r.id, 'accept')}
                  className="parley-button-ghost !py-1 !px-3 !text-xs"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handle(r.id, 'reject')}
                  className="text-xs text-mist hover:text-rust font-mono"
                >
                  decline
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {requests.outgoing.length > 0 && (
        <>
          <div className="eyebrow text-accent/80 mb-2">Outgoing</div>
          <ul className="divide-y divide-hairline">
            {requests.outgoing.map((r) => (
              <li key={r.id} className="py-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-paper text-xs font-mono uppercase">
                  {r.username.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-paper text-sm font-medium tracking-tight">{r.username}</div>
                  <div className="eyebrow">pending</div>
                </div>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handle(r.id, 'reject')}
                  className="text-xs text-mist hover:text-rust font-mono"
                >
                  cancel
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AddFriendTab({
  onSent,
  setError,
}: {
  onSent: () => void
  setError: (e: string | null) => void
}) {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      await sendFriendRequest(username.trim(), message.trim() || undefined)
      setSuccess(`Request sent to ${username}`)
      setUsername('')
      setMessage('')
      onSent()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="text-sm text-bone leading-relaxed mb-5">
        Send a friend request by username. They must accept before you can exchange direct messages.
      </p>
      <div className="mb-4">
        <label className="eyebrow block mb-1.5">Username</label>
        <input
          type="text"
          className="parley-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="who would you like to add?"
          required
        />
      </div>
      <div className="mb-4">
        <label className="eyebrow block mb-1.5">Message (optional)</label>
        <input
          type="text"
          className="parley-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="a note to accompany your request"
          maxLength={500}
        />
      </div>
      {success && (
        <div className="text-sm text-moss mb-3 font-mono border-l-2 border-moss pl-3 py-1">{success}</div>
      )}
      <button type="submit" disabled={submitting || !username.trim()} className="parley-button">
        {submitting ? 'Sending…' : 'Send request →'}
      </button>
    </form>
  )
}
