import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      userBan: { findFirst: jest.fn() },
      friendship: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(FriendsService);
  });

  describe('sendRequest', () => {
    it('throws if username is empty', async () => {
      await expect(service.sendRequest('u1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if target user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.sendRequest('u1', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if trying to friend yourself', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'self' });
      await expect(service.sendRequest('u1', 'self')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if user is blocked', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', username: 'bob' });
      prisma.userBan.findFirst.mockResolvedValue({ id: 'ban1' });
      await expect(service.sendRequest('u1', 'bob')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws if friendship already exists (accepted)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', username: 'bob' });
      prisma.userBan.findFirst.mockResolvedValue(null);
      prisma.friendship.findFirst.mockResolvedValue({
        status: 'accepted',
      });
      await expect(service.sendRequest('u1', 'bob')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws if request already pending', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', username: 'bob' });
      prisma.userBan.findFirst.mockResolvedValue(null);
      prisma.friendship.findFirst.mockResolvedValue({
        status: 'pending',
      });
      await expect(service.sendRequest('u1', 'bob')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates friendship on success', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', username: 'bob' });
      prisma.userBan.findFirst.mockResolvedValue(null);
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendship.create.mockResolvedValue({ id: 'f1' });

      const result = await service.sendRequest('u1', 'bob', 'Hello!');
      expect(prisma.friendship.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requesterId: 'u1',
            addresseeId: 'u2',
            message: 'Hello!',
          }),
        }),
      );
      expect(result).toEqual({ id: 'f1' });
    });
  });

  describe('accept', () => {
    it('throws if request not found', async () => {
      prisma.friendship.findUnique.mockResolvedValue(null);
      await expect(service.accept('u2', 'f1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if caller is not the addressee', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'u2',
        status: 'pending',
      });
      await expect(service.accept('u1', 'f1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updates status to accepted', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'u2',
        status: 'pending',
      });
      prisma.friendship.update.mockResolvedValue({ id: 'f1', status: 'accepted' });

      const result = await service.accept('u2', 'f1');
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { status: 'accepted' },
      });
      expect(result.status).toBe('accepted');
    });
  });

  describe('removeFriend', () => {
    it('throws if friendship not found', async () => {
      prisma.friendship.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeFriend('u1', 'u2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the friendship', async () => {
      prisma.friendship.deleteMany.mockResolvedValue({ count: 1 });
      await service.removeFriend('u1', 'u2');
      expect(prisma.friendship.deleteMany).toHaveBeenCalled();
    });
  });
});
