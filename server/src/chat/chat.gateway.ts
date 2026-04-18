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

      // Join Socket.IO rooms for all chat rooms the user belongs to
      const memberships = await this.prisma.roomMember.findMany({
        where: { userId: user.id },
        select: { roomId: true },
      });
      for (const m of memberships) {
        client.join(`room:${m.roomId}`);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(_client: AuthSocket) {
    // No-op for now; presence tracking comes in Phase 5
  }

  /* ─── Messaging events ─────────────────────────────── */

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string; content: string; replyToId?: string },
  ) {
    const membership = await this.rooms.getMembership(data.roomId, client.userId);
    if (!membership) return { error: 'Not a member of this room' };

    try {
      const message = await this.messages.send(
        data.roomId,
        client.userId,
        data.content,
        data.replyToId,
      );
      this.server.to(`room:${data.roomId}`).emit('message:new', message);
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
}
