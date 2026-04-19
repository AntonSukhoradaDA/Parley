import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { XmppConfig } from './xmpp.config';

/**
 * Prosody mod_auth_http calls POST /api/xmpp/auth with `{username, password}`
 * on every SASL PLAIN attempt. We verify the password against the same
 * bcrypt hash used for Parley web login.
 *
 * The endpoint is reachable through nginx (like the rest of `/api/*`), so we
 * require an `X-Parley-Bridge-Secret` header matching XMPP_COMPONENT_SECRET.
 * The secret is shared between the Parley server and the Prosody sidecar and
 * is not known by clients.
 */
@Controller('xmpp/auth')
export class XmppAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: XmppConfig,
  ) {}

  @Post()
  @HttpCode(200)
  async authenticate(
    @Headers('x-parley-bridge-secret') secret: string | undefined,
    @Body() body: { username?: string; password?: string },
  ) {
    if (!secret || secret !== this.cfg.componentSecret) {
      throw new ForbiddenException('Invalid bridge secret');
    }
    const username = (body?.username ?? '').trim();
    const password = body?.password ?? '';
    if (!username || !password) {
      throw new UnauthorizedException('Missing credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user || user.isRemote || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { ok: true };
  }
}
