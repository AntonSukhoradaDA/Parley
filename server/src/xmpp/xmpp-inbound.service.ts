import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoomMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { XmppConfig } from './xmpp.config';
import {
  InboundMessage,
  XmppBridgeService,
} from './xmpp-bridge.service';

const MESSAGE_SELECT = {
  id: true,
  roomId: true,
  content: true,
  editedAt: true,
  createdAt: true,
  replyToId: true,
  sender: { select: { id: true, username: true } },
} as const;

/**
 * Broadcaster interface lets us avoid circular DI with the chat module.
 * ChatGateway registers itself on init via registerBroadcaster().
 */
export interface ChatBroadcaster {
  emitRoomMessage: (
    roomId: string,
    memberUserIds: string[],
    message: unknown,
  ) => void;
  emitUnreadBump: (roomId: string, excludeUserId: string) => void;
}

@Injectable()
export class XmppInboundService implements OnModuleInit {
  private readonly logger = new Logger(XmppInboundService.name);
  private broadcaster: ChatBroadcaster | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: XmppConfig,
    private readonly bridge: XmppBridgeService,
  ) {}

  registerBroadcaster(b: ChatBroadcaster) {
    this.broadcaster = b;
  }

  onModuleInit() {
    this.bridge.registerInbound((msg) => this.handle(msg));
  }

  private async handle(msg: InboundMessage) {
    const sender = await this.resolveRemoteUser(msg.fromLocal, msg.fromDomain);
    if (!sender) {
      this.logger.warn(`could not resolve sender ${msg.fromJid}`);
      return;
    }

    if (msg.kind === 'chat') {
      await this.handleDm(sender, msg);
    } else {
      await this.handleGroupchat(sender, msg);
    }
  }

  private async resolveRemoteUser(local: string, domain: string) {
    const jid = `${local}@${domain}`;
    // If the message is actually addressed from our own domain, find the local user.
    if (this.cfg.isLocalDomain(domain)) {
      return this.prisma.user.findUnique({ where: { username: local } });
    }
    const existing = await this.prisma.user.findUnique({
      where: { xmppJid: jid },
    });
    if (existing) return existing;

    const username = this.buildRemoteUsername(local, domain);
    try {
      return await this.prisma.user.upsert({
        where: { xmppJid: jid },
        update: {},
        create: {
          username,
          isRemote: true,
          xmppJid: jid,
          remoteDomain: domain,
        },
      });
    } catch {
      // Lost a race - re-read
      return this.prisma.user.findUnique({ where: { xmppJid: jid } });
    }
  }

  private buildRemoteUsername(local: string, domain: string): string {
    // Collisions with local usernames are avoided by qualifying with the remote domain.
    return `${local}@${domain}`.slice(0, 64);
  }

  private async handleDm(
    sender: { id: string; username: string },
    msg: InboundMessage,
  ) {
    // Find the local recipient by the bare local part of the to address.
    const recipient = await this.prisma.user.findUnique({
      where: { username: msg.toLocal },
    });
    if (!recipient || recipient.isRemote) {
      this.logger.warn(`DM to unknown local user ${msg.toLocal}`);
      return;
    }

    const room = await this.findOrCreatePersonalRoom(sender.id, recipient.id);

    const message = await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: sender.id,
        content: msg.body.slice(0, 3072),
      },
      select: MESSAGE_SELECT,
    });

    this.broadcaster?.emitRoomMessage(
      room.id,
      [sender.id, recipient.id],
      message,
    );
    this.broadcaster?.emitUnreadBump(room.id, sender.id);
  }

  private async handleGroupchat(
    sender: { id: string; username: string },
    msg: InboundMessage,
  ) {
    // Expect to-local to be the Parley room UUID
    const room = await this.prisma.room.findUnique({
      where: { id: msg.toLocal },
    });
    if (!room) {
      this.logger.warn(`Groupchat to unknown room ${msg.toLocal}`);
      return;
    }

    // Ensure sender is a member so Message.senderId FK holds and they show in UI.
    await this.prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: sender.id } },
      create: {
        roomId: room.id,
        userId: sender.id,
        role: RoomMemberRole.member,
      },
      update: {},
    });

    const message = await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: sender.id,
        content: msg.body.slice(0, 3072),
      },
      select: MESSAGE_SELECT,
    });

    const memberIds = await this.prisma.roomMember
      .findMany({
        where: { roomId: room.id },
        select: { userId: true },
      })
      .then((rows) => rows.map((r) => r.userId));
    this.broadcaster?.emitRoomMessage(room.id, memberIds, message);
    this.broadcaster?.emitUnreadBump(room.id, sender.id);
  }

  private async findOrCreatePersonalRoom(userAId: string, userBId: string) {
    const name = `dm:${[userAId, userBId].sort().join(':')}`;
    const existing = await this.prisma.room.findFirst({
      where: {
        isPersonal: true,
        AND: [
          { members: { some: { userId: userAId } } },
          { members: { some: { userId: userBId } } },
        ],
      },
      select: { id: true },
    });
    if (existing) return existing;

    try {
      return await this.prisma.room.create({
        data: {
          name,
          isPersonal: true,
          visibility: 'private',
          ownerId: null,
          members: {
            create: [
              { userId: userAId, role: RoomMemberRole.member },
              { userId: userBId, role: RoomMemberRole.member },
            ],
          },
        },
        select: { id: true },
      });
    } catch {
      // Concurrent inbound created it - re-read by unique name
      const found = await this.prisma.room.findUnique({
        where: { name },
        select: { id: true },
      });
      if (found) return found;
      throw new Error('Failed to create or find personal room');
    }
  }
}
