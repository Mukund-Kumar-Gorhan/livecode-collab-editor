import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken } from '../utils/jwt.js';

vi.mock('../config/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      room: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      roomMember: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('Room API Routes', () => {
  const ownerId = 'user-owner-1';
  const ownerEmail = 'owner@example.com';
  const ownerToken = generateAccessToken({ userId: ownerId, email: ownerEmail });

  const otherId = 'user-other-2';
  const otherEmail = 'other@example.com';
  const otherToken = generateAccessToken({ userId: otherId, email: otherEmail });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/rooms', () => {
    it('should create room with unique shortId and set creator as OWNER', async () => {
      (prisma.room.create as any) = vi.fn().mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'room-1',
          shortId: args.data.shortId,
          name: args.data.name,
          language: args.data.language,
          ownerId,
          owner: { id: ownerId, name: 'Owner', email: ownerEmail },
          members: [{ userId: ownerId, role: 'OWNER' }],
        });
      });

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'My Team Room',
          language: 'python',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.room.name).toBe('My Team Room');
      expect(res.body.data.room.shortId).toBeDefined();
      expect(res.body.data.role).toBe('OWNER');
    });

    it('should return 401 when creating room without token', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ name: 'Unauth Room' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/rooms', () => {
    it('should return list of rooms with user role', async () => {
      vi.mocked(prisma.roomMember.findMany).mockResolvedValueOnce([
        {
          id: 'rm-1',
          roomId: 'room-1',
          userId: ownerId,
          role: 'OWNER',
          room: {
            id: 'room-1',
            shortId: 'abc123xyz',
            name: 'Python Project',
            language: 'python',
            owner: { id: ownerId, name: 'Owner', email: ownerEmail },
            _count: { members: 2 },
          },
        },
      ] as any);

      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rooms).toHaveLength(1);
      expect(res.body.data.rooms[0].role).toBe('OWNER');
      expect(res.body.data.rooms[0].shortId).toBe('abc123xyz');
    });
  });

  describe('GET /api/rooms/:shortId', () => {
    it('should return room details and current user role', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        shortId: 'abc123xyz',
        name: 'Shared Room',
        language: 'javascript',
        ownerId,
        owner: { id: ownerId, name: 'Owner', email: ownerEmail },
        members: [
          { userId: ownerId, role: 'OWNER', user: { id: ownerId, name: 'Owner' } },
        ],
      } as any);

      const res = await request(app)
        .get('/api/rooms/abc123xyz')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.room.shortId).toBe('abc123xyz');
      expect(res.body.data.role).toBe('OWNER');
    });

    it('should return 404 if room does not exist', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/rooms/nonexistent')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('POST /api/rooms/:shortId/join', () => {
    it('should allow user to join room with EDITOR role', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        shortId: 'abc123xyz',
        name: 'Collab Room',
        members: [],
      } as any);

      vi.mocked(prisma.roomMember.create).mockResolvedValueOnce({
        id: 'rm-2',
        roomId: 'room-1',
        userId: otherId,
        role: 'EDITOR',
      } as any);

      const res = await request(app)
        .post('/api/rooms/abc123xyz/join')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('EDITOR');
    });
  });

  describe('PATCH /api/rooms/:shortId/members/:userId', () => {
    it('should allow OWNER to update member role to VIEWER', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        shortId: 'abc123xyz',
        ownerId,
      } as any);

      vi.mocked(prisma.roomMember.findUnique).mockResolvedValueOnce({
        id: 'rm-2',
        roomId: 'room-1',
        userId: otherId,
        role: 'EDITOR',
      } as any);

      vi.mocked(prisma.roomMember.update).mockResolvedValueOnce({
        id: 'rm-2',
        roomId: 'room-1',
        userId: otherId,
        role: 'VIEWER',
      } as any);

      const res = await request(app)
        .patch(`/api/rooms/abc123xyz/members/${otherId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.member.role).toBe('VIEWER');
    });

    it('should reject role update with 403 if requester is not OWNER', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        shortId: 'abc123xyz',
        ownerId,
      } as any);

      const res = await request(app)
        .patch(`/api/rooms/abc123xyz/members/${otherId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/rooms/:shortId', () => {
    it('should allow OWNER to delete room', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        shortId: 'abc123xyz',
        ownerId,
      } as any);

      vi.mocked(prisma.room.delete).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete('/api/rooms/abc123xyz')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Room deleted successfully');
    });

    it('should reject room deletion with 403 if requester is not OWNER', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        shortId: 'abc123xyz',
        ownerId,
      } as any);

      const res = await request(app)
        .delete('/api/rooms/abc123xyz')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
