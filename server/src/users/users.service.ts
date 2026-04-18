import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  deleteAccount(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  // ─── User-to-user bans ─────────────────────────────────

  async banUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId)
      throw new BadRequestException('Cannot ban yourself');

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
    });
    if (!target) throw new NotFoundException('User not found');

    // Create ban
    try {
      await this.prisma.userBan.create({
        data: { blockerId, blockedId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('User already banned');
      }
      throw err;
    }

    // Remove any friendship between the two users
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: blockerId, addresseeId: blockedId },
          { requesterId: blockedId, addresseeId: blockerId },
        ],
      },
    });
  }

  async unbanUser(blockerId: string, blockedId: string) {
    const result = await this.prisma.userBan.deleteMany({
      where: { blockerId, blockedId },
    });
    if (result.count === 0) throw new NotFoundException('Ban not found');
  }

  async listBannedUsers(blockerId: string) {
    const bans = await this.prisma.userBan.findMany({
      where: { blockerId },
      include: { blocked: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return bans.map((b) => ({
      userId: b.blocked.id,
      username: b.blocked.username,
      createdAt: b.createdAt,
    }));
  }
}
