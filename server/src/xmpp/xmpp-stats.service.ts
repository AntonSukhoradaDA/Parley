import { Injectable } from '@nestjs/common';

export interface XmppStatsSnapshot {
  uptimeSeconds: number;
  connected: boolean;
  reconnects: number;
  stanzasIn: number;
  stanzasOut: number;
  bytesIn: number;
  bytesOut: number;
  lastErrors: { at: string; message: string }[];
  perPeer: Record<string, { in: number; out: number; lastSeen: string }>;
}

@Injectable()
export class XmppStatsService {
  private startedAt = Date.now();
  private connected = false;
  private reconnects = 0;
  private stanzasIn = 0;
  private stanzasOut = 0;
  private bytesIn = 0;
  private bytesOut = 0;
  private lastErrors: { at: string; message: string }[] = [];
  private perPeer = new Map<string, { in: number; out: number; lastSeen: Date }>();

  setConnected(v: boolean) {
    this.connected = v;
    if (!v) return;
    this.startedAt = Date.now();
  }

  noteReconnect() {
    this.reconnects += 1;
  }

  noteInbound(fromDomain: string, size = 0) {
    this.stanzasIn += 1;
    this.bytesIn += size;
    this.bumpPeer(fromDomain, 1, 0);
  }

  noteOutbound(toDomain: string, size = 0) {
    this.stanzasOut += 1;
    this.bytesOut += size;
    this.bumpPeer(toDomain, 0, 1);
  }

  noteError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    this.lastErrors.unshift({ at: new Date().toISOString(), message });
    if (this.lastErrors.length > 50) this.lastErrors.pop();
  }

  private bumpPeer(domain: string, inc: number, outc: number) {
    if (!domain) return;
    const cur = this.perPeer.get(domain) ?? {
      in: 0,
      out: 0,
      lastSeen: new Date(),
    };
    cur.in += inc;
    cur.out += outc;
    cur.lastSeen = new Date();
    this.perPeer.set(domain, cur);
  }

  snapshot(): XmppStatsSnapshot {
    const perPeer: XmppStatsSnapshot['perPeer'] = {};
    for (const [domain, s] of this.perPeer.entries()) {
      perPeer[domain] = {
        in: s.in,
        out: s.out,
        lastSeen: s.lastSeen.toISOString(),
      };
    }
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      connected: this.connected,
      reconnects: this.reconnects,
      stanzasIn: this.stanzasIn,
      stanzasOut: this.stanzasOut,
      bytesIn: this.bytesIn,
      bytesOut: this.bytesOut,
      lastErrors: [...this.lastErrors],
      perPeer,
    };
  }
}
