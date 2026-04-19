import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getXmppFederation,
  getXmppSessions,
  getXmppStats,
  type XmppFederation,
  type XmppSessionsResponse,
  type XmppStats,
} from '@/lib/admin'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

const POLL_MS = 3000

function formatUptime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ${seconds % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function AdminPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<XmppStats | null>(null)
  const [sessions, setSessions] = useState<XmppSessionsResponse | null>(null)
  const [federation, setFederation] = useState<XmppFederation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [s, sess, fed] = await Promise.all([
          getXmppStats(),
          getXmppSessions(),
          getXmppFederation(),
        ])
        if (!mounted) return
        setStats(s)
        setSessions(sess)
        setFederation(fed)
        setError(null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      }
    }
    void load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline/60">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="eyebrow">{t('admin.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to="/chats" className="parley-button-ghost text-[13px]">
            {t('admin.backToChat')}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="border border-rust/60 bg-rust/10 text-paper rounded px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <section>
          <h2 className="eyebrow mb-3">{t('admin.bridge')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label={t('admin.status')}
              value={
                stats?.connected
                  ? t('admin.online')
                  : stats?.enabled
                    ? t('admin.offline')
                    : t('admin.disabled')
              }
              tone={stats?.connected ? 'good' : 'bad'}
            />
            <StatCard
              label={t('admin.uptime')}
              value={stats ? formatUptime(stats.uptimeSeconds) : '-'}
            />
            <StatCard
              label={t('admin.stanzasIn')}
              value={stats?.stanzasIn?.toLocaleString() ?? '-'}
            />
            <StatCard
              label={t('admin.stanzasOut')}
              value={stats?.stanzasOut?.toLocaleString() ?? '-'}
            />
            <StatCard
              label={t('admin.bytesIn')}
              value={stats ? formatBytes(stats.bytesIn) : '-'}
            />
            <StatCard
              label={t('admin.bytesOut')}
              value={stats ? formatBytes(stats.bytesOut) : '-'}
            />
            <StatCard
              label={t('admin.reconnects')}
              value={stats?.reconnects?.toString() ?? '-'}
            />
            <StatCard
              label={t('admin.domain')}
              value={stats?.domain ?? '-'}
            />
          </div>
        </section>

        <section>
          <h2 className="eyebrow mb-3">{t('admin.federation')}</h2>
          {federation && federation.peers.length > 0 ? (
            <div className="border border-hairline rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate/30 text-stone">
                  <tr>
                    <th className="text-left px-3 py-2">{t('admin.peerDomain')}</th>
                    <th className="text-right px-3 py-2">{t('admin.stanzasIn')}</th>
                    <th className="text-right px-3 py-2">{t('admin.stanzasOut')}</th>
                    <th className="text-left px-3 py-2">{t('admin.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {federation.peers.map((p) => (
                    <tr key={p.domain} className="border-t border-hairline/50">
                      <td className="px-3 py-2 font-mono text-paper">{p.domain}</td>
                      <td className="px-3 py-2 text-right">{p.stanzasIn}</td>
                      <td className="px-3 py-2 text-right">{p.stanzasOut}</td>
                      <td className="px-3 py-2 text-stone">
                        {new Date(p.lastSeenAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-stone text-sm">{t('admin.noPeers')}</p>
          )}
        </section>

        <section>
          <h2 className="eyebrow mb-3">
            {t('admin.sessions')}
            {sessions?.available && (
              <span className="ml-2 text-stone text-xs">({sessions.count})</span>
            )}
          </h2>
          {!sessions?.available ? (
            <p className="text-stone text-sm">
              {sessions?.reason
                ? `${t('admin.sessionsUnavailable')}: ${sessions.reason}`
                : t('admin.sessionsUnavailable')}
            </p>
          ) : sessions.sessions.length === 0 ? (
            <p className="text-stone text-sm">{t('admin.noSessions')}</p>
          ) : (
            <div className="border border-hairline rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate/30 text-stone">
                  <tr>
                    <th className="text-left px-3 py-2">JID</th>
                    <th className="text-left px-3 py-2">{t('admin.ip')}</th>
                    <th className="text-left px-3 py-2">TLS</th>
                    <th className="text-left px-3 py-2">{t('admin.since')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.sessions.map((s) => (
                    <tr key={s.jid} className="border-t border-hairline/50">
                      <td className="px-3 py-2 font-mono text-paper">{s.jid}</td>
                      <td className="px-3 py-2 text-stone font-mono">
                        {s.ip ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-stone">
                        {s.secure ? 'yes' : 'no'}
                      </td>
                      <td className="px-3 py-2 text-stone">
                        {s.since
                          ? new Date(s.since * 1000).toLocaleString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {stats && stats.lastErrors.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">{t('admin.recentErrors')}</h2>
            <ul className="space-y-1 text-xs font-mono">
              {stats.lastErrors.slice(0, 10).map((e, idx) => (
                <li key={idx} className="text-rust">
                  <span className="text-stone mr-2">{e.at}</span>
                  {e.message}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  const valueCls =
    tone === 'good' ? 'text-moss' : tone === 'bad' ? 'text-rust' : 'text-paper'
  return (
    <div className="border border-hairline rounded p-3 bg-slate/20">
      <div className="text-[11px] uppercase tracking-wide text-stone">{label}</div>
      <div className={`mt-1 text-lg font-mono ${valueCls}`}>{value}</div>
    </div>
  )
}
