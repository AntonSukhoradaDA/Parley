import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Parley API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.message.deleteMany();
    await prisma.roomBan.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.room.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.userBan.deleteMany();
    await prisma.session.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ─── State shared across tests ───────────────────────

  let aliceToken: string;
  let bobToken: string;
  let bobId: string;
  let roomId: string;

  // ─── Auth ────────────────────────────────────────────

  describe('Auth', () => {
    it('POST /api/auth/register — creates alice', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'alice-e2e@test.com',
          username: 'alice_e2e',
          password: 'password123',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.username).toBe('alice_e2e');
      aliceToken = res.body.accessToken;
    });

    it('POST /api/auth/register — creates bob', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'bob-e2e@test.com',
          username: 'bob_e2e',
          password: 'password123',
        })
        .expect(201);

      bobToken = res.body.accessToken;
      bobId = res.body.user.id;
    });

    it('POST /api/auth/register — rejects duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'alice-e2e@test.com',
          username: 'alice_e2e_2',
          password: 'password123',
        })
        .expect(409);
    });

    it('POST /api/auth/register — rejects duplicate username', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'alice-e2e-2@test.com',
          username: 'alice_e2e',
          password: 'password123',
        })
        .expect(409);
    });

    it('POST /api/auth/login — valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice-e2e@test.com', password: 'password123' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      aliceToken = res.body.accessToken;
    });

    it('POST /api/auth/login — invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice-e2e@test.com', password: 'wrong' })
        .expect(401);
    });

    it('GET /api/auth/me — returns profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.username).toBe('alice_e2e');
    });

    it('GET /api/auth/me — 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('GET /api/auth/sessions — lists sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ─── Rooms ───────────────────────────────────────────

  describe('Rooms', () => {
    it('POST /api/rooms — creates a public room', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ name: 'e2e-room', description: 'Test room', visibility: 'public' })
        .expect(201);

      expect(res.body.name).toBe('e2e-room');
      roomId = res.body.id;
    });

    it('POST /api/rooms — rejects duplicate name', async () => {
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ name: 'e2e-room', visibility: 'public' })
        .expect(409);
    });

    it('GET /api/rooms — lists my rooms', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.some((r: any) => r.name === 'e2e-room')).toBe(true);
    });

    it('GET /api/rooms/public — lists public rooms', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rooms/public')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.some((r: any) => r.name === 'e2e-room')).toBe(true);
    });

    it('POST /api/rooms/:id/join — bob joins', async () => {
      await request(app.getHttpServer())
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(200);
    });

    it('GET /api/rooms/:id/members — lists 2 members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/rooms/${roomId}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.length).toBe(2);
    });

    it('POST /api/rooms/:id/leave — bob leaves', async () => {
      await request(app.getHttpServer())
        .post(`/api/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(204);
    });

    it('POST /api/rooms/:id/leave — owner cannot leave', async () => {
      await request(app.getHttpServer())
        .post(`/api/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(400);
    });
  });

  // ─── Messages ────────────────────────────────────────

  describe('Messages', () => {
    it('GET /api/rooms/:id/messages — empty history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.messages).toEqual([]);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  // ─── Friends ─────────────────────────────────────────

  describe('Friends', () => {
    let requestId: string;

    it('POST /api/friends/request — alice sends to bob', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: 'bob_e2e', message: 'Hi!' })
        .expect(201);

      requestId = res.body.id;
    });

    it('rejects self-request', async () => {
      await request(app.getHttpServer())
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: 'alice_e2e' })
        .expect(400);
    });

    it('rejects duplicate request', async () => {
      await request(app.getHttpServer())
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: 'bob_e2e' })
        .expect(409);
    });

    it('GET /api/friends/requests — bob sees incoming', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(200);

      expect(res.body.incoming.length).toBe(1);
    });

    it('POST /api/friends/accept — bob accepts', async () => {
      await request(app.getHttpServer())
        .post(`/api/friends/accept/${requestId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(200);
    });

    it('GET /api/friends — lists friend', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/friends')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].username).toBe('bob_e2e');
    });

    it('DELETE /api/friends/:userId — removes friend', async () => {
      await request(app.getHttpServer())
        .delete(`/api/friends/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(204);
    });
  });

  // ─── User Bans ───────────────────────────────────────

  describe('User Bans', () => {
    it('POST /api/users/ban/:userId — bans user', async () => {
      await request(app.getHttpServer())
        .post(`/api/users/ban/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(204);
    });

    it('GET /api/users/bans — lists banned', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/bans')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.length).toBe(1);
    });

    it('friend request blocked by ban', async () => {
      await request(app.getHttpServer())
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ username: 'alice_e2e' })
        .expect(403);
    });

    it('DELETE /api/users/ban/:userId — unbans', async () => {
      await request(app.getHttpServer())
        .delete(`/api/users/ban/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(204);
    });
  });

  // ─── Health ──────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/health — returns ok', async () => {
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);
    });
  });
});
