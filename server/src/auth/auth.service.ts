import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const REFRESH_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 10;
const RESET_TTL_MINUTES = 30;

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto, ctx: SessionContext) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
      },
    });

    return this.issueTokens(user.id, ctx);
  }

  async login(email: string, password: string, ctx: SessionContext) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user.id, ctx);
  }

  async refresh(refreshToken: string, ctx: SessionContext) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session
          .delete({ where: { id: session.id } })
          .catch(() => undefined);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate
    const newToken = this.generateRefreshToken();
    const expiresAt = this.refreshExpiry();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newToken,
        expiresAt,
        ip: ctx.ip ?? session.ip,
        userAgent: ctx.userAgent ?? session.userAgent,
      },
    });

    const accessToken = await this.signAccessToken(session.userId);
    return { userId: session.userId, accessToken, refreshToken: newToken };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    await this.prisma.session
      .delete({ where: { refreshToken } })
      .catch(() => undefined);
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // Always succeed — don't leak which emails are registered

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    // Invalidate previous outstanding tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const url = `${this.mail.appUrl()}/reset-password?token=${rawToken}`;
    await this.mail.send({
      to: user.email,
      subject: 'Reset your Parley password',
      text:
        `Hi ${user.username},\n\n` +
        `We received a request to reset your password. Open this link to set a new one:\n\n` +
        `${url}\n\n` +
        `This link expires in ${RESET_TTL_MINUTES} minutes. If you didn't request a reset, you can ignore this email.`,
      html:
        `<p>Hi ${user.username},</p>` +
        `<p>We received a request to reset your password. Click the link to set a new one:</p>` +
        `<p><a href="${url}">${url}</a></p>` +
        `<p>This link expires in ${RESET_TTL_MINUTES} minutes. If you didn't request a reset, you can ignore this email.</p>`,
    });
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = this.hashResetToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all sessions
      this.prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(next, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    // Invalidate all sessions
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  private async issueTokens(userId: string, ctx: SessionContext) {
    const refreshToken = this.generateRefreshToken();
    const expiresAt = this.refreshExpiry();
    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        expiresAt,
      },
    });
    const accessToken = await this.signAccessToken(userId);
    return { userId, accessToken, refreshToken };
  }

  private signAccessToken(userId: string) {
    const payload: JwtPayload = { sub: userId };
    return this.jwt.signAsync(payload);
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  private refreshExpiry() {
    const d = new Date();
    d.setDate(d.getDate() + REFRESH_TTL_DAYS);
    return d;
  }
}
