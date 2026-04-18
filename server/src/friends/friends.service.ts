import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(requesterId: string, username: string, message?: string) {
    if (!username) throw new BadRequestException('Username is required');

    const target = await this.prisma.user.findUnique({ where: { username } });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === requesterId) throw new BadRequestException('Cannot send a friend request to yourself');

    // Check user-to-user ban in either direction
    const ban = await this.prisma.userBan.findFirst({
      where: {
        OR: [
          { blockerId: requesterId, blockedId: target.id },
          { blockerId: target.id, blockedId: requesterId },
        ],
      },
    });
    if (ban) throw new ForbiddenException('Cannot send friend request — user is blocked');

    // Check for existing friendship in either direction
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: requesterId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'accepted') {
        throw new ConflictException('Already friends');
      }
      throw new ConflictException('Friend request already pending');
    }

    return this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId: target.id,
        message: message || null,
      },
      include: {
        addressee: { select: { id: true, username: true } },
      },
    });
  }

  async listRequests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { addresseeId: userId, status: 'pending' },
        include: { requester: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: userId, status: 'pending' },
        include: { addressee: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      incoming: incoming.map((f) => ({
        id: f.id,
        userId: f.requester.id,
        username: f.requester.username,
        message: f.message,
        createdAt: f.createdAt,
      })),
      outgoing: outgoing.map((f) => ({
        id: f.id,
        userId: f.addressee.id,
        username: f.addressee.username,
        message: f.message,
        createdAt: f.createdAt,
      })),
    };
  }

  async accept(userId: string, requestId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!friendship) throw new NotFoundException('Friend request not found');
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('You can only accept requests sent to you');
    }
    if (friendship.status === 'accepted') {
      throw new ConflictException('Already accepted');
    }

    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: 'accepted' },
    });
  }

  async reject(userId: string, requestId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!friendship) throw new NotFoundException('Friend request not found');
    // Either side can cancel/reject
    if (friendship.addresseeId !== userId && friendship.requesterId !== userId) {
      throw new ForbiddenException('Not your friend request');
    }

    await this.prisma.friendship.delete({ where: { id: requestId } });
  }

  async removeFriend(userId: string, friendUserId: string) {
    const result = await this.prisma.friendship.deleteMany({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, addresseeId: friendUserId },
          { requesterId: friendUserId, addresseeId: userId },
        ],
      },
    });
    if (result.count === 0) throw new NotFoundException('Friendship not found');
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return friendships.map((f) => {
      const friend =
        f.requesterId === userId ? f.addressee : f.requester;
      return {
        friendshipId: f.id,
        userId: friend.id,
        username: friend.username,
      };
    });
  }
}
