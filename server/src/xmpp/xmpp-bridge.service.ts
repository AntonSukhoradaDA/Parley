import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XmppConfig } from './xmpp.config';
import { XmppStatsService } from './xmpp-stats.service';

// xmpp.js packages are ESM; loaded lazily so this file still compiles/tests without them installed.
type Xml = any;
type ComponentXmpp = any;

export interface ParleyMessagePayload {
  id: string;
  roomId: string;
  content: string;
  senderUsername: string;
}

export interface InboundMessage {
  fromJid: string;
  fromDomain: string;
  fromLocal: string;
  toJid: string;
  toLocal: string;
  toDomain: string;
  body: string;
  kind: 'chat' | 'groupchat';
  stanzaId?: string;
}

type InboundHandler = (msg: InboundMessage) => Promise<void> | void;

@Injectable()
export class XmppBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XmppBridgeService.name);
  private xmpp: ComponentXmpp | null = null;
  private xml: ((name: string, attrs?: any, ...children: any[]) => Xml) | null =
    null;
  private started = false;
  private onInbound: InboundHandler | null = null;

  constructor(
    private readonly cfg: XmppConfig,
    private readonly prisma: PrismaService,
    private readonly stats: XmppStatsService,
  ) {}

  registerInbound(handler: InboundHandler) {
    this.onInbound = handler;
  }

  async onModuleInit() {
    if (!this.cfg.enabled) {
      this.logger.log('XMPP bridge disabled via XMPP_ENABLED=false');
      return;
    }
    try {
      // Dynamic import: xmpp.js ships as ESM.
      const componentMod: any = await import('@xmpp/component');
      const xmlMod: any = await import('@xmpp/xml');
      const component = componentMod.component ?? componentMod.default?.component;
      this.xml = xmlMod.default ?? xmlMod;

      this.xmpp = component({
        service: `xmpp://${this.cfg.componentHost}:${this.cfg.componentPort}`,
        domain: this.cfg.componentDomain,
        password: this.cfg.componentSecret,
      });

      this.xmpp.on('error', (err: Error) => {
        this.logger.error(`XMPP error: ${err.message}`);
        this.stats.noteError(err);
      });
      this.xmpp.on('offline', () => {
        this.logger.warn('XMPP component offline');
        this.stats.setConnected(false);
      });
      this.xmpp.on('online', () => {
        this.logger.log(
          `XMPP component online as ${this.cfg.componentDomain}`,
        );
        this.stats.setConnected(true);
      });
      this.xmpp.on('reconnecting', () => {
        this.stats.noteReconnect();
      });
      this.xmpp.on('stanza', (stanza: Xml) => this.handleStanza(stanza));

      await this.xmpp.start();
      this.started = true;
    } catch (err) {
      this.logger.error(
        `Failed to start XMPP bridge: ${(err as Error).message}`,
      );
      this.stats.noteError(err);
    }
  }

  async onModuleDestroy() {
    if (this.started && this.xmpp) {
      try {
        await this.xmpp.stop();
      } catch {
        /* noop */
      }
    }
  }

  private async handleStanza(stanza: Xml) {
    if (stanza.name !== 'message') return;
    const type = stanza.attrs.type ?? 'chat';
    if (type !== 'chat' && type !== 'groupchat') return;
    const body = stanza.getChildText?.('body');
    if (!body) return;

    const from = stanza.attrs.from as string | undefined;
    const to = stanza.attrs.to as string | undefined;
    if (!from || !to) return;

    const [fromLocal, fromRawDomain] = from.split('/')[0].split('@');
    const [toLocal, toRawDomain] = to.split('/')[0].split('@');
    if (!fromLocal || !fromRawDomain || !toLocal || !toRawDomain) return;

    // Peers send stanzas from their bridge component domain; unwrap so the
    // shadow user is keyed by the canonical user domain.
    const fromDomain = fromRawDomain.startsWith('bridge.')
      ? fromRawDomain.slice('bridge.'.length)
      : fromRawDomain;
    const toDomain = toRawDomain;

    const msg: InboundMessage = {
      fromJid: `${fromLocal}@${fromDomain}`,
      fromDomain,
      fromLocal,
      toJid: `${toLocal}@${toDomain}`,
      toLocal,
      toDomain,
      body,
      kind: type,
      stanzaId: stanza.attrs.id,
    };

    this.stats.noteInbound(fromDomain, body.length);

    try {
      await this.persistPeer(fromDomain, 1, 0);
      if (this.onInbound) await this.onInbound(msg);
    } catch (err) {
      this.logger.error(`Inbound handler failed: ${(err as Error).message}`);
      this.stats.noteError(err);
    }
  }

  /* ─── Outbound ──────────────────────────────────────── */

  async sendDm(
    fromUsername: string,
    toJid: string,
    payload: ParleyMessagePayload,
  ): Promise<void> {
    // Remote recipient (cross-server): route through the peer's bridge.
    const routedTo = this.cfg.routeViaPeerBridge(toJid);
    await this.sendChat(fromUsername, routedTo, payload);
  }

  /**
   * Send a chat stanza to a local Parley user so Prosody can deliver it to
   * their c2s Jabber client session (if any). Includes the `no-store` hint
   * so Prosody does not persist a copy -- Parley owns the DB-backed history.
   */
  async sendLocalDm(
    fromUsername: string,
    toUsername: string,
    payload: ParleyMessagePayload,
  ): Promise<void> {
    const toJid = this.cfg.localJid(toUsername);
    await this.sendChat(fromUsername, toJid, payload, { noStore: true });
  }

  private async sendChat(
    fromUsername: string,
    toJid: string,
    payload: ParleyMessagePayload,
    opts: { noStore?: boolean } = {},
  ): Promise<void> {
    if (!this.xmpp || !this.xml) return;
    const fromJid = this.cfg.componentJid(fromUsername);
    const children = [this.xml('body', {}, payload.content)];
    if (opts.noStore) {
      children.push(this.xml('no-store', { xmlns: 'urn:xmpp:hints' }));
      children.push(this.xml('no-permanent-store', { xmlns: 'urn:xmpp:hints' }));
    }
    const stanza = this.xml(
      'message',
      { from: fromJid, to: toJid, type: 'chat', id: payload.id },
      ...children,
    );
    await this.safeSend(stanza, this.domainOf(toJid), payload.content.length);
  }

  async sendMuc(
    fromUsername: string,
    roomId: string,
    payload: ParleyMessagePayload,
    recipientDomains: string[],
  ): Promise<void> {
    if (!this.xmpp || !this.xml) return;
    // Broadcast to each remote user via chat-type message (avoids requiring MUC
    // occupancy from remote servers). Using addressing by individual JID.
    for (const toJid of recipientDomains) {
      const routedTo = this.cfg.routeViaPeerBridge(toJid);
      const stanza = this.xml(
        'message',
        {
          from: this.cfg.componentJid(fromUsername),
          to: routedTo,
          type: 'chat',
          id: payload.id,
        },
        this.xml('body', {}, payload.content),
        this.xml(
          'x',
          { xmlns: 'parley:muc' },
          this.xml('room', {}, roomId),
        ),
      );
      await this.safeSend(
        stanza,
        this.domainOf(routedTo),
        payload.content.length,
      );
    }
  }

  private async safeSend(stanza: Xml, peerDomain: string, size: number) {
    if (!this.xmpp) return;
    try {
      await this.xmpp.send(stanza);
      this.stats.noteOutbound(peerDomain, size);
      await this.persistPeer(peerDomain, 0, 1);
    } catch (err) {
      this.logger.error(`Failed to send stanza: ${(err as Error).message}`);
      this.stats.noteError(err);
    }
  }

  private domainOf(jid: string): string {
    const bare = jid.split('/')[0];
    const parts = bare.split('@');
    return parts[1] ?? '';
  }

  private async persistPeer(domain: string, inc: number, outc: number) {
    if (!domain || domain === this.cfg.domain) return;
    try {
      await this.prisma.federationPeer.upsert({
        where: { domain },
        create: { domain, stanzasIn: inc, stanzasOut: outc },
        update: {
          lastSeenAt: new Date(),
          stanzasIn: { increment: inc },
          stanzasOut: { increment: outc },
        },
      });
    } catch {
      /* non-fatal */
    }
  }
}
