import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomMemberRole, RoomVisibility } from '@prisma/client';
import { unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/create-room.dto';

const MAX_ROOM_MEMBERS = 1000;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoomDto) {
    try {
      return await this.prisma.room.create({
        data: {
          name: dto.name,
          description: dto.description ?? '',
          visibility: dto.visibility ?? RoomVisibility.public,
          ownerId: userId,
          members: {
            create: { userId, role: RoomMemberRole.owner },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Room name already taken');
      }
      throw err;
    }
  }

  async listMine(userId: string) {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId, room: { isPersonal: false } },
      orderBy: { joinedAt: 'asc' },
      include: {
        room: {
          include: { _count: { select: { members: true } } },
        },
      },
    });
    return memberships.map((m) => ({
      id: m.room.id,
      name: m.room.name,
      description: m.room.description,
      visibility: m.room.visibility,
      ownerId: m.room.ownerId,
      role: m.role,
      memberCount: m.room._count.members,
      joinedAt: m.joinedAt,
    }));
  }

  async listPublic(userId: string, search?: string) {
    const where: Prisma.RoomWhereInput = {
      visibility: RoomVisibility.public,
      isPersonal: false,
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const rooms = await this.prisma.room.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { members: true } },
        members: { where: { userId }, select: { userId: true } },
      },
    });
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      visibility: r.visibility,
      ownerId: r.ownerId,
      memberCount: r._count.members,
      isMember: r.members.length > 0,
      createdAt: r.createdAt,
    }));
  }

  async getById(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { _count: { select: { members: true } } },
    });
    if (!room || room.isPersonal) throw new NotFoundException('Room not found');

    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership && room.visibility === RoomVisibility.private) {
      throw new NotFoundException('Room not found');
    }
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      visibility: room.visibility,
      ownerId: room.ownerId,
      memberCount: room._count.members,
      role: membership?.role ?? null,
      createdAt: room.createdAt,
    };
  }

  async update(userId: string, roomId: string, dto: UpdateRoomDto) {
    const room = await this.requireRoom(roomId);
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can update this room');
    }
    try {
      return await this.prisma.room.update({
        where: { id: roomId },
        data: { ...dto },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Room name already taken');
      }
      throw err;
    }
  }

  async delete(userId: string, roomId: string) {
    const room = await this.requireRoom(roomId);
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this room');
    }
    const attachments = await this.prisma.attachment.findMany({
      where: { roomId },
      select: { storagePath: true },
    });
    await this.prisma.room.delete({ where: { id: roomId } });
    for (const a of attachments) {
      try { unlinkSync(a.storagePath); } catch { /* ignore */ }
    }
  }

  async join(userId: string, roomId: string) {
    const room = await this.requireRoom(roomId);
    if (room.visibility !== RoomVisibility.public) {
      throw new ForbiddenException('Room is private — invitation required');
    }
    await this.assertNotBanned(roomId, userId);
    await this.assertCapacity(roomId);

    return this.prisma.roomMember
      .create({
        data: { roomId, userId, role: RoomMemberRole.member },
      })
      .catch((err) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('Already a member of this room');
        }
        throw err;
      });
  }

  async leave(userId: string, roomId: string) {
    const room = await this.requireRoom(roomId);
    if (room.ownerId === userId) {
      throw new BadRequestException(
        'Owner cannot leave the room — transfer ownership or delete it',
      );
    }
    const result = await this.prisma.roomMember.deleteMany({
      where: { roomId, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Not a member of this room');
    }
  }

  async invite(userId: string, roomId: string, username: string) {
    const room = await this.requireRoom(roomId);
    const inviter = await this.requireMember(roomId, userId);
    if (inviter.role === RoomMemberRole.member) {
      throw new ForbiddenException('Only owner or admins can invite');
    }
    if (room.visibility === RoomVisibility.public) {
      throw new BadRequestException('Public rooms do not require invitations');
    }
    const target = await this.prisma.user.findUnique({ where: { username } });
    if (!target) throw new NotFoundException('User not found');
    await this.assertNotBanned(roomId, target.id);
    await this.assertCapacity(roomId);

    return this.prisma.roomMember
      .create({
        data: { roomId, userId: target.id, role: RoomMemberRole.member },
      })
      .catch((err) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('User is already a member');
        }
        throw err;
      });
  }

  async listMembers(userId: string, roomId: string) {
    await this.requireMember(roomId, userId);
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
    return members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  // ─── Moderation ──────────────────────────────────────────

  async setAdmin(actorId: string, roomId: string, targetUserId: string, makeAdmin: boolean) {
    const room = await this.requireRoom(roomId);
    if (room.ownerId !== actorId) {
      throw new ForbiddenException('Only the owner can manage admins');
    }
    if (targetUserId === room.ownerId) {
      throw new BadRequestException('Owner role cannot be changed');
    }
    const target = await this.requireMember(roomId, targetUserId);
    if (makeAdmin && target.role === RoomMemberRole.admin) return;
    if (!makeAdmin && target.role !== RoomMemberRole.admin) return;
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role: makeAdmin ? RoomMemberRole.admin : RoomMemberRole.member },
    });
  }

  async ban(actorId: string, roomId: string, targetUserId: string) {
    const room = await this.requireRoom(roomId);
    const actor = await this.requireMember(roomId, actorId);
    if (actor.role === RoomMemberRole.member) {
      throw new ForbiddenException('Only owner or admins can ban');
    }
    if (targetUserId === room.ownerId) {
      throw new BadRequestException('Owner cannot be banned');
    }
    if (targetUserId === actorId) {
      throw new BadRequestException('Cannot ban yourself');
    }
    const target = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (
      target?.role === RoomMemberRole.admin &&
      actor.role !== RoomMemberRole.owner
    ) {
      throw new ForbiddenException('Only the owner can ban another admin');
    }

    await this.prisma.$transaction([
      this.prisma.roomMember.deleteMany({
        where: { roomId, userId: targetUserId },
      }),
      this.prisma.roomBan.upsert({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        create: { roomId, userId: targetUserId, bannedById: actorId },
        update: { bannedById: actorId, createdAt: new Date() },
      }),
    ]);
  }

  async unban(actorId: string, roomId: string, targetUserId: string) {
    await this.requireRoom(roomId);
    const actor = await this.requireMember(roomId, actorId);
    if (actor.role === RoomMemberRole.member) {
      throw new ForbiddenException('Only owner or admins can unban');
    }
    await this.prisma.roomBan.deleteMany({
      where: { roomId, userId: targetUserId },
    });
  }

  async listBans(actorId: string, roomId: string) {
    const actor = await this.requireMember(roomId, actorId);
    if (actor.role === RoomMemberRole.member) {
      throw new ForbiddenException('Only owner or admins can view bans');
    }
    const bans = await this.prisma.roomBan.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true } },
        bannedBy: { select: { id: true, username: true } },
      },
    });
    return bans.map((b) => ({
      userId: b.user.id,
      username: b.user.username,
      bannedById: b.bannedBy.id,
      bannedByUsername: b.bannedBy.username,
      createdAt: b.createdAt,
    }));
  }

  async kick(actorId: string, roomId: string, targetUserId: string) {
    // Kick = ban semantics per plan ("DELETE /api/rooms/:id/members/:userId — remove member (= ban)")
    return this.ban(actorId, roomId, targetUserId);
  }

  // ─── Public helpers (used by chat gateway) ───────────────

  async getMembership(roomId: string, userId: string) {
    return this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async requireRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.isPersonal) throw new NotFoundException('Room not found');
    return room;
  }

  private async requireMember(roomId: string, userId: string) {
    const m = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a member of this room');
    return m;
  }

  private async assertNotBanned(roomId: string, userId: string) {
    const banned = await this.prisma.roomBan.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (banned) throw new ForbiddenException('You are banned from this room');
  }

  private async assertCapacity(roomId: string) {
    const count = await this.prisma.roomMember.count({ where: { roomId } });
    if (count >= MAX_ROOM_MEMBERS) {
      throw new ConflictException(
        `Room is at capacity (${MAX_ROOM_MEMBERS} members)`,
      );
    }
  }
}
