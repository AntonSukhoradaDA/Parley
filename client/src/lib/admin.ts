import { api } from '@/lib/api'

export interface XmppStats {
  enabled: boolean
  domain: string
  componentDomain: string
  mucDomain: string
  uptimeSeconds: number
  connected: boolean
  reconnects: number
  stanzasIn: number
  stanzasOut: number
  bytesIn: number
  bytesOut: number
  lastErrors: { at: string; message: string }[]
  perPeer: Record<string, { in: number; out: number; lastSeen: string }>
}

export interface XmppSession {
  jid: string
  username: string
  resource?: string
  ip?: string
  since?: number
  secure?: boolean
}

export interface XmppSessionsResponse {
  available: boolean
  reason?: string
  count: number
  sessions: XmppSession[]
}

export interface XmppFederation {
  peers: {
    domain: string
    firstSeenAt: string
    lastSeenAt: string
    stanzasIn: number
    stanzasOut: number
    live: { in: number; out: number; lastSeen: string } | null
  }[]
  live: Record<string, { in: number; out: number; lastSeen: string }>
}

export function getXmppStats() {
  return api<XmppStats>('/api/admin/xmpp/stats')
}

export function getXmppSessions() {
  return api<XmppSessionsResponse>('/api/admin/xmpp/sessions')
}

export function getXmppFederation() {
  return api<XmppFederation>('/api/admin/xmpp/federation')
}
