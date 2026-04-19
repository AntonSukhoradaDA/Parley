import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { XmppConfig } from './xmpp.config';
import { XmppStatsService } from './xmpp-stats.service';

@Controller('admin/xmpp')
@UseGuards(JwtAuthGuard)
export class XmppAdminController {
  constructor(
    private readonly cfg: XmppConfig,
    private readonly stats: XmppStatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  async getStats() {
    return {
      enabled: this.cfg.enabled,
      domain: this.cfg.domain,
      componentDomain: this.cfg.componentDomain,
      mucDomain: this.cfg.mucDomain,
      ...this.stats.snapshot(),
    };
  }

  @Get('sessions')
  async getSessions() {
    // Fetches live c2s Jabber-client sessions from Prosody via
    // mod_parley_admin (our custom HTTP endpoint).
    try {
      const res = await fetch(`${this.cfg.adminRestUrl}/sessions`, {
        headers: {
          Authorization: `Bearer ${this.cfg.adminRestSecret}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        return {
          available: false,
          reason: `prosody returned ${res.status}`,
          count: 0,
          sessions: [],
        };
      }
      const data = (await res.json()) as {
        count: number;
        sessions: unknown[];
      };
      return { available: true, count: data.count, sessions: data.sessions };
    } catch (err) {
      return {
        available: false,
        reason: (err as Error).message,
        count: 0,
        sessions: [],
      };
    }
  }

  @Get('federation')
  async getFederation() {
    const peers = await this.prisma.federationPeer.findMany({
      orderBy: { lastSeenAt: 'desc' },
    });
    const snap = this.stats.snapshot();
    return {
      peers: peers.map((p) => ({
        domain: p.domain,
        firstSeenAt: p.firstSeenAt,
        lastSeenAt: p.lastSeenAt,
        stanzasIn: p.stanzasIn,
        stanzasOut: p.stanzasOut,
        live: snap.perPeer[p.domain] ?? null,
      })),
      live: snap.perPeer,
    };
  }
}
