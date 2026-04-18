import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonalChatsService } from '../personal-chats/personal-chats.service';

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
  attachments: {
    select: {
      id: true,
      filename: true,
      mimetype: true,
      size: true,
      comment: true,
    },
  },
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personalChats: PersonalChatsService,
  ) {}

  private async assertNotFrozen(roomId: string) {
    if (!(await this.personalChats.isPersonalRoom(roomId))) return;
    if (await this.personalChats.checkBanBetweenMembers(roomId)) {
      throw new ForbiddenException('This conversation is frozen due to a block');
    }
  }

  async send(
    roomId: string,
    senderId: string,
    content: string,
    replyToId?: string,
    attachmentIds: string[] = [],
  ) {
    if (Buffer.byteLength(content, 'utf8') > MAX_MESSAGE_BYTES) {
      throw new BadRequestException('Message exceeds 3 KB limit');
    }
    if (!content.trim() && attachmentIds.length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (replyToId) {
      const parent = await this.prisma.message.findUnique({ where: { id: replyToId } });
      if (!parent || parent.roomId !== roomId) {
        throw new BadRequestException('Replied message not found in this room');
      }
    }

    await this.assertNotFrozen(roomId);

    if (attachmentIds.length) {
      const found = await this.prisma.attachment.findMany({
        where: { id: { in: attachmentIds } },
        select: { id: true, uploaderId: true, roomId: true, messageId: true },
      });
      if (found.length !== attachmentIds.length) {
        throw new BadRequestException('Attachment not found');
      }
      for (const a of found) {
        if (a.uploaderId !== senderId) {
          throw new BadRequestException('Cannot use another user\'s attachment');
        }
        if (a.roomId !== roomId) {
          throw new BadRequestException('Attachment does not belong to this room');
        }
        if (a.messageId) {
          throw new BadRequestException('Attachment already linked');
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { roomId, senderId, content, replyToId },
        select: MESSAGE_SELECT,
      });
      if (attachmentIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: attachmentIds }, messageId: null, uploaderId: senderId },
          data: { messageId: message.id },
        });
        const attachments = await tx.attachment.findMany({
          where: { messageId: message.id },
          select: { id: true, filename: true, mimetype: true, size: true, comment: true },
        });
        return { ...message, attachments };
      }
      return message;
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

    await this.assertNotFrozen(msg.roomId);

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
