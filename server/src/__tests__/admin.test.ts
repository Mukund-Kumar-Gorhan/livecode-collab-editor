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
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      room: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      executionLog: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

describe('Admin API Routes & requireAdmin Middleware', () => {
  const adminUser = {
    userId: 'admin-123',
    email: 'admin@livecode.dev',
  };

  const regularUser = {
    userId: 'regular-user-456',
    email: 'john@example.com',
  };

  const otherUser = {
    userId: 'target-user-789',
    email: 'target@example.com',
  };

  let adminToken: string;
  let regularToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = generateAccessToken(adminUser);
    regularToken = generateAccessToken(regularUser);
  });

  describe('Admin Authorization (requireAdmin)', () => {
    it('should return 401 Unauthorized when no token is supplied', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 Forbidden when a standard non-admin user attempts access', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: regularUser.userId,
        email: regularUser.email,
        isAdmin: false,
      } as any);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/admin/i);
    });

    it('should allow access to /api/admin/stats for admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: adminUser.userId,
        email: adminUser.email,
        isAdmin: true,
      } as any);

      vi.mocked(prisma.user.count).mockResolvedValueOnce(25);
      vi.mocked(prisma.room.count).mockResolvedValueOnce(12);
      vi.mocked(prisma.executionLog.count).mockResolvedValue(50);
      vi.mocked(prisma.room.findMany).mockResolvedValueOnce([
        { language: 'python' },
        { language: 'javascript' },
      ] as any);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBe(25);
      expect(res.body.data.languageUsage).toBeDefined();
      expect(res.body.data.runsLast7Days).toBeDefined();
    });
  });

  describe('User Management (/api/admin/users)', () => {
    it('should return paginated user list', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: adminUser.userId,
        email: adminUser.email,
        isAdmin: true,
      } as any);

      vi.mocked(prisma.user.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        {
          id: otherUser.userId,
          email: otherUser.email,
          name: 'Target User',
          createdAt: new Date().toISOString(),
          _count: { ownedRooms: 2 },
        },
      ] as any);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].email).toBe(otherUser.email);
    });

    it('should reject status modification on admin own account (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser.userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot disable your own/i);
    });

    it('should reject role modification on admin own account (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot modify your own/i);
    });

    it('should reject account deletion on admin own account (400 Bad Request)', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${adminUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot delete your own/i);
    });

    it('should allow modifying status of another user', async () => {
      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch(`/api/admin/users/${otherUser.userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISABLED');
    });

    it('should allow promoting another user to admin', async () => {
      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch(`/api/admin/users/${otherUser.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAdmin).toBe(true);
    });

    it('should allow deleting another user', async () => {
      vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete(`/api/admin/users/${otherUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Room Management (/api/admin/rooms)', () => {
    it('should allow admin to delete a collaborative room', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
        name: 'Project Room',
      } as any);
      vi.mocked(prisma.room.delete).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete('/api/admin/rooms/rm-999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Audit Trail (/api/admin/audit-logs)', () => {
    it('should return chronological audit log records', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });
  });
});
