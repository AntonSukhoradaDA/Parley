import { useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRoomsStore } from '@/store/rooms'
import {
  changePassword,
  deleteAccount,
  listBannedUsers,
  listSessions,
  revokeSession,
  unbanUser,
  type BannedUser,
  type SessionInfo,
} from '@/lib/profile'
import { Modal } from './Modal'

type Tab = 'password' | 'sessions' | 'bans' | 'danger'

interface Props {
  open: boolean
  initialTab?: Tab
  onClose: () => void
}

export function ProfileModal({ open, initialTab = 'password', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setError(null)
    }
  }, [open, initialTab])

  return (
    <Modal open={open} onClose={onClose} eyebrow="Profile" title="Your account" variant="drawer" width="max-w-md">
      <div className="flex gap-1 -mt-1 mb-5 border-b border-hairline">
        {(['password', 'sessions', 'bans', 'danger'] as const).map((t, i) => (
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
              {t === 'password' ? 'Password' : t === 'sessions' ? 'Sessions' : t === 'bans' ? 'Blocked' : 'Danger'}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-rust mb-3 font-mono border-l-2 border-rust pl-3 py-1">{error}</div>
      )}

      {tab === 'password' && <PasswordTab setError={setError} />}
      {tab === 'sessions' && <SessionsTab setError={setError} />}
      {tab === 'bans' && <BansTab setError={setError} />}
      {tab === 'danger' && <DangerTab setError={setError} />}
    </Modal>
  )
}

function PasswordTab({ setError }: { setError: (e: string | null) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (next.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (next !== confirm) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(current, next)
      setSuccess('Password updated. Other sessions remain active; sign them out via the Sessions tab.')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="text-sm text-bone leading-relaxed mb-5">
        Change the password for your Parley account. You will stay signed in here.
      </p>
      <div className="mb-4">
        <label className="eyebrow block mb-1.5">Current password</label>
        <input
          type="password"
          className="parley-input"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="mb-4">
        <label className="eyebrow block mb-1.5">New password</label>
        <input
          type="password"
          className="parley-input"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="mb-4">
        <label className="eyebrow block mb-1.5">Confirm new password</label>
        <input
          type="password"
          className="parley-input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      {success && (
        <div className="text-sm text-moss mb-3 font-mono border-l-2 border-moss pl-3 py-1">{success}</div>
      )}
      <button
        type="submit"
        disabled={submitting || !current || !next || !confirm}
        className="parley-button"
      >
        {submitting ? 'Saving…' : 'Update password →'}
      </button>
    </form>
  )
}

function SessionsTab({ setError }: { setError: (e: string | null) => void }) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    try {
      setSessions(await listSessions())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sessions')
    }
  }

  useEffect(() => { load() }, [])

  async function handleRevoke(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await revokeSession(id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke')
    } finally {
      setBusyId(null)
    }
  }

  if (!sessions) return <div className="text-xs text-mist font-mono">loading…</div>
  if (sessions.length === 0) {
    return <div className="text-sm text-mist">No active sessions.</div>
  }

  return (
    <ul className="divide-y divide-hairline">
      {sessions.map((s) => (
        <li key={s.id} className="py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-paper text-sm font-medium tracking-tight truncate">
              {truncateUA(s.userAgent)}
            </div>
            <div className="eyebrow mt-0.5">
              {s.ip ?? 'unknown ip'} · signed in {new Date(s.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            type="button"
            disabled={busyId === s.id}
            onClick={() => handleRevoke(s.id)}
            className="text-xs text-mist hover:text-rust font-mono"
          >
            revoke
          </button>
        </li>
      ))}
    </ul>
  )
}

function truncateUA(ua: string | null): string {
  if (!ua) return 'Unknown browser'
  if (ua.length <= 60) return ua
  return ua.slice(0, 57) + '…'
}

function BansTab({ setError }: { setError: (e: string | null) => void }) {
  const [bans, setBans] = useState<BannedUser[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    try {
      setBans(await listBannedUsers())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    }
  }

  useEffect(() => { load() }, [])

  async function handleUnban(userId: string) {
    setBusyId(userId)
    setError(null)
    try {
      await unbanUser(userId)
      await load()
      useRoomsStore.getState().refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unban')
    } finally {
      setBusyId(null)
    }
  }

  if (!bans) return <div className="text-xs text-mist font-mono">loading…</div>
  if (bans.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-paper text-lg font-medium tracking-tight mb-2">No one blocked.</div>
        <p className="text-sm text-mist">Users you block will appear here.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-hairline">
      {bans.map((b) => (
        <li key={b.userId} className="py-3 flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-slate border border-hairline flex items-center justify-center text-paper text-xs font-mono uppercase">
            {b.username.charAt(0)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-paper text-sm font-medium tracking-tight truncate">{b.username}</div>
            <div className="eyebrow">blocked {new Date(b.createdAt).toLocaleDateString()}</div>
          </div>
          <button
            type="button"
            disabled={busyId === b.userId}
            onClick={() => handleUnban(b.userId)}
            className="text-xs text-mist hover:text-accent font-mono"
          >
            unblock
          </button>
        </li>
      ))}
    </ul>
  )
}

function DangerTab({ setError }: { setError: (e: string | null) => void }) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const username = useAuthStore((s) => s.user?.username)

  async function handleDelete() {
    if (confirmText !== username) return
    setError(null)
    setSubmitting(true)
    try {
      await deleteAccount()
      useAuthStore.getState().clear()
      window.location.href = '/login'
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete account')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="text-sm text-bone leading-relaxed mb-3">
        Deleting your account is <span className="text-rust">permanent</span>. Your owned rooms
        (with all their messages and files) will be removed. Your memberships in other rooms will
        also be removed.
      </p>
      <p className="text-sm text-mist leading-relaxed mb-5">
        To confirm, type your username <span className="font-mono text-paper">{username}</span> below.
      </p>
      <input
        type="text"
        className="parley-input mb-4"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="type your username to confirm"
      />
      <button
        type="button"
        disabled={submitting || confirmText !== username}
        onClick={handleDelete}
        className="w-full px-5 py-2.5 border border-rust text-rust hover:bg-rust hover:text-ink transition-colors rounded-md text-sm tracking-tight disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-rust"
      >
        {submitting ? 'Deleting…' : 'Delete account permanently'}
      </button>
    </div>
  )
}
