import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class XmppConfig {
  readonly enabled: boolean;
  readonly domain: string;
  readonly componentHost: string;
  readonly componentPort: number;
  readonly componentDomain: string;
  readonly componentSecret: string;
  readonly mucDomain: string;
  readonly adminRestUrl: string;
  readonly adminRestSecret: string;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('XMPP_ENABLED', 'true') === 'true';
    this.domain = config.get<string>('XMPP_DOMAIN', 'parley.local');
    this.componentHost = config.get<string>('XMPP_COMPONENT_HOST', 'prosody');
    this.componentPort = Number(
      config.get<string>('XMPP_COMPONENT_PORT', '5347'),
    );
    this.componentDomain = config.get<string>(
      'XMPP_COMPONENT_DOMAIN',
      `bridge.${this.domain}`,
    );
    this.componentSecret = config.get<string>(
      'XMPP_COMPONENT_SECRET',
      'parley-bridge-secret',
    );
    this.mucDomain = config.get<string>(
      'XMPP_MUC_DOMAIN',
      `conference.${this.domain}`,
    );
    this.adminRestUrl = config.get<string>(
      'XMPP_ADMIN_REST_URL',
      `http://${this.componentHost}:5280/parley_admin`,
    );
    this.adminRestSecret = config.get<string>(
      'XMPP_ADMIN_REST_SECRET',
      this.componentSecret,
    );
  }

  localJid(username: string): string {
    return `${username}@${this.domain}`;
  }

  /**
   * The address a Parley user appears under when the component sends on their
   * behalf. Prosody enforces that components can only emit stanzas from JIDs
   * within their own domain (XEP-0114), so we send from the component domain
   * and let the peer's bridge strip it back to the canonical user JID.
   */
  componentJid(username: string): string {
    return `${username}@${this.componentDomain}`;
  }

  mucJid(roomId: string): string {
    return `${roomId}@${this.mucDomain}`;
  }

  isLocalDomain(domain: string): boolean {
    return (
      domain === this.domain ||
      domain === this.componentDomain ||
      domain === this.mucDomain
    );
  }

  /**
   * Route a bare user JID `local@remote-host` through the peer's bridge
   * component so the remote Parley server's bridge can intercept delivery.
   * Example: `alice@parley-b.local` -> `alice@bridge.parley-b.local`.
   *
   * If `bareJid` already targets a bridge.* or conference.* subdomain, it's
   * returned as-is.
   */
  routeViaPeerBridge(bareJid: string): string {
    const [local, domain] = bareJid.split('@');
    if (!local || !domain) return bareJid;
    if (domain.startsWith('bridge.') || domain.startsWith('conference.')) {
      return bareJid;
    }
    return `${local}@bridge.${domain}`;
  }
}
