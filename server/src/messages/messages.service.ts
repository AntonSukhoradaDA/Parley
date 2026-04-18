import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_MESSAGE_BYTES = 3072; // 3 KB
const PAGE_SIZE = 50;

const MESSAGE_SELECT = {
  id: true,
  roomId: true,
  content: true,
  editedAt: true,
  createdAt: true,
  replyToId: true,
  sender: { select: { id: true, username: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      sender: { select: { id: true, username: true } },
    },
  },
} as const;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(roomId: string, senderId: string, content: string, replyToId?: string) {
    if (Buffer.byteLength(content, 'utf8') > MAX_MESSAGE_BYTES) {
      throw new BadRequestException('Message exceeds 3 KB limit');
    }
    if (!content.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (replyToId) {
      const parent = await this.prisma.message.findUnique({ where: { id: replyToId } });
      if (!parent || parent.roomId !== roomId) {
        throw new BadRequestException('Replied message not found in this room');
      }
    }

    return this.prisma.message.create({
      data: { roomId, senderId, content, replyToId },
      select: MESSAGE_SELECT,
    });
  }

  async edit(messageId: string, userId: string, content: string) {
    if (Buffer.byteLength(content, 'utf8') > MAX_MESSAGE_BYTES) {
      throw new BadRequestException('Message exceeds 3 KB limit');
    }
    if (!content.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('You can only edit your own messages');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      select: MESSAGE_SELECT,
    });
  }

  async delete(messageId: string, userId: string, roomId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.roomId !== roomId) throw new BadRequestException('Message not in this room');

    // Author can always delete. Admins/owners can delete in their rooms.
    if (msg.senderId !== userId) {
      const membership = await this.prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });
      if (!membership || membership.role === 'member') {
        throw new ForbiddenException('You can only delete your own messages');
      }
    }

    await this.prisma.message.delete({ where: { id: messageId } });
  }

  async history(roomId: string, cursor?: string, limit = PAGE_SIZE) {
    const take = Math.min(limit, 100);
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });

    const hasMore = messages.length > take;
    if (hasMore) messages.pop();

    return {
      messages: messages.reverse(),
      nextCursor: hasMore ? messages[0]?.id : null,
    };
  }

  async markRead(roomId: string, userId: string) {
    await this.prisma.roomMember.updateMany({
      where: { roomId, userId },
      data: { lastReadAt: new Date() },
    });
  }
}
