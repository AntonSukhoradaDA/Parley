import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { RoomsService } from '../rooms/rooms.service';
import { PresenceService, type PresenceStatus } from './presence.service';

interface AuthSocket extends Socket {
  userId: string;
  username: string;
}

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly rooms: RoomsService,
    private readonly presence: PresenceService,
  ) {}

  /* ─── Connection lifecycle ─────────────────────────── */

  async handleConnection(client: AuthSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');

      const payload = await this.jwt.verifyAsync(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true },
      });
      if (!user) throw new Error('User not found');

      client.userId = user.id;
      client.username = user.username;

      // Track presence
      const wasBefore = this.presence.getStatus(user.id);
      this.presence.addSocket(user.id, client.id);

      // Join Socket.IO rooms for all chat rooms the user belongs to
      const memberships = await this.prisma.roomMember.findMany({
        where: { userId: user.id },
        select: { roomId: true, lastReadAt: true },
      });
      for (const m of memberships) {
        client.join(`room:${m.roomId}`);
      }

      // Also join a personal channel for direct notifications
      client.join(`user:${user.id}`);

      // Send initial unread counts
      const unreadCounts = await this.getUnreadCounts(user.id, memberships);
      client.emit('unread:init', unreadCounts);

      // Broadcast presence change
      const statusNow = this.presence.getStatus(user.id);
      if (wasBefore !== statusNow) {
        await this.broadcastPresence(user.id, statusNow);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthSocket) {
    if (!client.userId) return;
    const statusBefore = this.presence.getStatus(client.userId);
    this.presence.removeSocket(client.userId, client.id);
    const statusAfter = this.presence.getStatus(client.userId);
    if (statusBefore !== statusAfter) {
      await this.broadcastPresence(client.userId, statusAfter);
    }
  }

  /* ─── Presence events ──────────────────────────────── */

  @SubscribeMessage('presence:activity')
  async onActivity(@ConnectedSocket() client: AuthSocket) {
    if (!client.userId) return;
    const before = this.presence.getStatus(client.userId);
    this.presence.reportActivity(client.userId, client.id);
    const after = this.presence.getStatus(client.userId);
    if (before !== after) {
      await this.broadcastPresence(client.userId, after);
    }
  }

  @SubscribeMessage('presence:getRoom')
  async onGetRoomPresence(
    @ConnectedSocket() _client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId: data.roomId },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);
    return this.presence.getStatusBulk(userIds);
  }

  /* ─── Messaging events ─────────────────────────────── */

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string; content: string; replyToId?: string; attachmentIds?: string[] },
  ) {
    const membership = await this.rooms.getMembership(data.roomId, client.userId);
    if (!membership) return { error: 'Not a member of this room' };

    try {
      const message = await this.messages.send(
        data.roomId,
        client.userId,
        data.content,
        data.replyToId,
        data.attachmentIds ?? [],
      );
      this.server.to(`room:${data.roomId}`).emit('message:new', message);

      // Push unread bump to all room members except sender
      this.server.to(`room:${data.roomId}`).except(`user:${client.userId}`).emit('unread:bump', {
        roomId: data.roomId,
      });

      return { ok: true, message };
    } catch (err: any) {
      return { error: err.message ?? 'Failed to send message' };
    }
  }

  @SubscribeMessage('message:edit')
  async onEdit(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string; content: string; roomId: string },
  ) {
    try {
      const message = await this.messages.edit(data.messageId, client.userId, data.content);
      this.server.to(`room:${data.roomId}`).emit('message:edited', message);
      return { ok: true, message };
    } catch (err: any) {
      return { error: err.message ?? 'Failed to edit message' };
    }
  }

  @SubscribeMessage('message:delete')
  async onDelete(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string; roomId: string },
  ) {
    try {
      await this.messages.delete(data.messageId, client.userId, data.roomId);
      this.server.to(`room:${data.roomId}`).emit('message:deleted', {
        messageId: data.messageId,
        roomId: data.roomId,
      });
      return { ok: true };
    } catch (err: any) {
      return { error: err.message ?? 'Failed to delete message' };
    }
  }

  /* ─── Room channel events ──────────────────────────── */

  @SubscribeMessage('room:join')
  async onRoomJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    const membership = await this.rooms.getMembership(data.roomId, client.userId);
    if (!membership) return { error: 'Not a member' };
    client.join(`room:${data.roomId}`);
    return { ok: true };
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(`room:${data.roomId}`);
    return { ok: true };
  }

  @SubscribeMessage('room:markRead')
  async onMarkRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    await this.messages.markRead(data.roomId, client.userId);
    return { ok: true };
  }

  /* ─── Helpers ──────────────────────────────────────── */

  private async broadcastPresence(userId: string, status: PresenceStatus) {
    // Find all rooms this user belongs to and broadcast to those rooms
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    const update = { userId, status };
    for (const m of memberships) {
      this.server.to(`room:${m.roomId}`).emit('presence:update', update);
    }
  }

  private async getUnreadCounts(
    userId: string,
    memberships: { roomId: string; lastReadAt: Date }[],
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await Promise.all(
      memberships.map(async (m) => {
        const count = await this.prisma.message.count({
          where: {
            roomId: m.roomId,
            createdAt: { gt: m.lastReadAt },
            senderId: { not: userId },
          },
        });
        if (count > 0) counts[m.roomId] = count;
      }),
    );
    return counts;
  }
}
