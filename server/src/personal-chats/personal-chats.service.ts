import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersonalChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async openOrCreate(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('Cannot start a chat with yourself');
    }

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, username: true },
    });
    if (!other) throw new NotFoundException('User not found');

    // Must be friends
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) {
      throw new ForbiddenException('You must be friends to message this user');
    }

    // Neither side may have banned the other
    const ban = await this.prisma.userBan.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
    });
    if (ban) {
      throw new ForbiddenException('Messaging is blocked between you');
    }

    // Look for an existing personal chat with both users
    const existing = await this.prisma.room.findFirst({
      where: {
        isPersonal: true,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      return this.formatChat(existing.id, userId);
    }

    // Create a new personal room
    const created = await this.prisma.room.create({
      data: {
        name: `dm:${[userId, otherUserId].sort().join(':')}`,
        isPersonal: true,
        visibility: 'private',
        ownerId: null,
        members: {
          create: [
            { userId, role: RoomMemberRole.member },
            { userId: otherUserId, role: RoomMemberRole.member },
          ],
        },
      },
      select: { id: true },
    });
    return this.formatChat(created.id, userId);
  }

  async list(userId: string) {
    const rooms = await this.prisma.room.findMany({
      where: {
        isPersonal: true,
        members: { some: { userId } },
      },
      select: {
        id: true,
        createdAt: true,
        members: {
          where: { userId: { not: userId } },
          select: { user: { select: { id: true, username: true } } },
        },
      },
    });

    return Promise.all(
      rooms.map(async (r) => {
        const partner = r.members[0]?.user;
        if (!partner) return null;

        const ban = await this.prisma.userBan.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: partner.id },
              { blockerId: partner.id, blockedId: userId },
            ],
          },
          select: { blockerId: true },
        });

        return {
          id: r.id,
          partner,
          createdAt: r.createdAt,
          frozen: !!ban,
          frozenByMe: ban?.blockerId === userId,
        };
      }),
    ).then((results) => results.filter(Boolean));
  }

  private async formatChat(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        createdAt: true,
        members: {
          where: { userId: { not: userId } },
          select: { user: { select: { id: true, username: true } } },
        },
      },
    });
    if (!room) throw new NotFoundException('Chat not found');
    const partner = room.members[0]?.user;
    if (!partner) throw new NotFoundException('Partner not found');

    const ban = await this.prisma.userBan.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: partner.id },
          { blockerId: partner.id, blockedId: userId },
        ],
      },
      select: { blockerId: true },
    });

    return {
      id: room.id,
      partner,
      createdAt: room.createdAt,
      frozen: !!ban,
      frozenByMe: ban?.blockerId === userId,
    };
  }

  async isPersonalRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { isPersonal: true },
    });
    return !!room?.isPersonal;
  }

  async checkBanBetweenMembers(roomId: string): Promise<boolean> {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      select: { userId: true },
    });
    if (members.length !== 2) return false;
    const [a, b] = members;
    const ban = await this.prisma.userBan.findFirst({
      where: {
        OR: [
          { blockerId: a.userId, blockedId: b.userId },
          { blockerId: b.userId, blockedId: a.userId },
        ],
      },
    });
    return !!ban;
  }
}
