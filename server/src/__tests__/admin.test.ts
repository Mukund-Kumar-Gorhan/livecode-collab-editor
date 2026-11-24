import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

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
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      loginLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

describe('Admin API, Database Enforcement & Login History', () => {
  const adminUser = {
    userId: 'admin-uuid-1',
    email: 'realadmin@example.com',
  };

  const regularUser = {
    userId: 'regular-uuid-2',
    email: 'developer@example.com',
  };

  const fakeAdminEmailUser = {
    userId: 'fake-admin-uuid-3',
    email: 'admin@test.com', // Has 'admin' in email, but isAdmin is false in DB
  };

  const secondAdminUser = {
    userId: 'admin-uuid-2',
    email: 'secondadmin@example.com',
  };

  const otherUser = {
    userId: 'other-uuid-4',
    email: 'user@example.com',
  };

  let adminToken: string;
  let regularToken: string;
  let fakeAdminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = generateAccessToken(adminUser);
    regularToken = generateAccessToken(regularUser);
    fakeAdminToken = generateAccessToken(fakeAdminEmailUser);
  });

  describe('1. requireAdmin Middleware (Strict Database isAdmin Check)', () => {
    it('should return 401 Unauthorized when no Authorization token is supplied', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 Forbidden when a standard non-admin user attempts access', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: regularUser.userId,
        email: regularUser.email,
        isAdmin: false,
        isDisabled: false,
      } as any);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/admin/i);
    });

    it('should return 403 Forbidden for a user with "admin@test.com" email when isAdmin is false in DB', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: fakeAdminEmailUser.userId,
        email: fakeAdminEmailUser.email,
        isAdmin: false,
        isDisabled: false,
      } as any);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${fakeAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/admin/i);
    });

    it('should return 403 Forbidden if admin user is marked as isDisabled in DB', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: adminUser.userId,
        email: adminUser.email,
        isAdmin: true,
        isDisabled: true,
      } as any);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow access to /api/admin/stats when user has isAdmin=true in DB', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: adminUser.userId,
        email: adminUser.email,
        isAdmin: true,
        isDisabled: false,
      } as any);

      vi.mocked(prisma.user.count).mockResolvedValue(20);
      vi.mocked(prisma.room.count).mockResolvedValue(10);
      vi.mocked(prisma.executionLog.count).mockResolvedValue(35);
      vi.mocked(prisma.room.findMany).mockResolvedValueOnce([
        { language: 'python' },
        { language: 'c' },
      ] as any);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBe(20);
      expect(res.body.data.languageUsage).toBeDefined();
    });
  });

  describe('2. Dedicated Admin Login Endpoint (/api/admin/login)', () => {
    it('should reject non-admin account credentials with 403 NOT_AN_ADMIN', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: regularUser.userId,
        email: regularUser.email,
        passwordHash,
        isAdmin: false,
        isDisabled: false,
      } as any);
      vi.mocked(prisma.loginLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: regularUser.email,
          password: 'secret123',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_AN_ADMIN');
      expect(prisma.loginLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: regularUser.email,
            success: false,
          }),
        })
      );
    });

    it('should allow valid admin credentials and record successful LoginLog', async () => {
      const passwordHash = await bcrypt.hash('adminpass123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: adminUser.userId,
        name: 'Administrator',
        email: adminUser.email,
        passwordHash,
        isAdmin: true,
        isDisabled: false,
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.loginLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: adminUser.email,
          password: 'adminpass123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isAdmin).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
      expect(prisma.loginLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: adminUser.email,
            success: true,
          }),
        })
      );
    });
  });

  describe('3. Account Disabled Enforcement & Login Logging', () => {
    it('should reject login with 403 when account is disabled', async () => {
      const passwordHash = await bcrypt.hash('userpass123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: regularUser.userId,
        email: regularUser.email,
        passwordHash,
        isAdmin: false,
        isDisabled: true, // DISABLED
      } as any);
      vi.mocked(prisma.loginLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: regularUser.email,
          password: 'userpass123',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_DISABLED');
      expect(prisma.loginLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: regularUser.email,
            success: false,
          }),
        })
      );
    });

    it('should reject refresh token when account is disabled', async () => {
      const validRefreshToken = generateRefreshToken({ userId: regularUser.userId, email: regularUser.email });
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: regularUser.userId,
        email: regularUser.email,
        refreshToken: validRefreshToken,
        isDisabled: true, // DISABLED
      } as any);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('4. Self-Action & Last-Admin Protections', () => {
    beforeEach(() => {
      // Mock admin authorization for the requests
      (prisma.user.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.id === adminUser.userId) {
          return Promise.resolve({
            id: adminUser.userId,
            email: adminUser.email,
            isAdmin: true,
            isDisabled: false,
          } as any);
        }
        return Promise.resolve(null);
      });
    });

    it('should prevent admin from disabling own account (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser.userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SELF_MODIFICATION_PROHIBITED');
    });

    it('should prevent admin from revoking own admin role (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: false });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SELF_MODIFICATION_PROHIBITED');
    });

    it('should prevent admin from deleting own account (400 Bad Request)', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${adminUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SELF_DELETION_PROHIBITED');
    });

    it('should prevent disabling the last active admin account (400 LAST_ADMIN_PROTECTED)', async () => {
      (prisma.user.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.id === secondAdminUser.userId) {
          return Promise.resolve({
            id: secondAdminUser.userId,
            email: secondAdminUser.email,
            isAdmin: true,
            isDisabled: false,
          } as any);
        }
        return Promise.resolve({
          id: adminUser.userId,
          email: adminUser.email,
          isAdmin: true,
          isDisabled: false,
        } as any);
      });

      // Active admin count is 1
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1);

      const res = await request(app)
        .patch(`/api/admin/users/${secondAdminUser.userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
    });

    it('should prevent revoking admin role from the last active admin (400 LAST_ADMIN_PROTECTED)', async () => {
      (prisma.user.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.id === secondAdminUser.userId) {
          return Promise.resolve({
            id: secondAdminUser.userId,
            email: secondAdminUser.email,
            isAdmin: true,
            isDisabled: false,
          } as any);
        }
        return Promise.resolve({
          id: adminUser.userId,
          email: adminUser.email,
          isAdmin: true,
          isDisabled: false,
        } as any);
      });

      // Active admin count is 1
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1);

      const res = await request(app)
        .patch(`/api/admin/users/${secondAdminUser.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: false });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
    });
  });

  describe('5. Database Audit Logging & Session Invalidation', () => {
    it('should write to AuditLog and clear refreshToken when disabling a user', async () => {
      (prisma.user.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.id === otherUser.userId) {
          return Promise.resolve({
            id: otherUser.userId,
            email: otherUser.email,
            isAdmin: false,
            isDisabled: false,
            refreshToken: 'active-refresh-token',
          } as any);
        }
        return Promise.resolve({
          id: adminUser.userId,
          email: adminUser.email,
          isAdmin: true,
          isDisabled: false,
        } as any);
      });

      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: otherUser.userId,
        isDisabled: true,
        refreshToken: null,
      } as any);

      vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch(`/api/admin/users/${otherUser.userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' });

      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDisabled: true,
            refreshToken: null, // Token invalidated
          }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: adminUser.userId,
            action: 'USER_DISABLED',
            targetType: 'USER',
            targetId: otherUser.userId,
          }),
        })
      );
    });

    it('should write to AuditLog when promoting a user to admin', async () => {
      (prisma.user.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.id === otherUser.userId) {
          return Promise.resolve({
            id: otherUser.userId,
            email: otherUser.email,
            isAdmin: false,
            isDisabled: false,
          } as any);
        }
        return Promise.resolve({
          id: adminUser.userId,
          email: adminUser.email,
          isAdmin: true,
          isDisabled: false,
        } as any);
      });

      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: otherUser.userId,
        isAdmin: true,
      } as any);

      vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch(`/api/admin/users/${otherUser.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: true });

      expect(res.status).toBe(200);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: adminUser.userId,
            action: 'ADMIN_PROMOTED',
            targetId: otherUser.userId,
          }),
        })
      );
    });

    it('should return database-persisted LoginLog items', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: adminUser.userId,
        email: adminUser.email,
        isAdmin: true,
        isDisabled: false,
      } as any);

      vi.mocked(prisma.loginLog.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.loginLog.findMany).mockResolvedValueOnce([
        {
          id: 'log-1',
          email: otherUser.email,
          success: true,
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date(),
          user: { name: 'User', email: otherUser.email, isAdmin: false },
        },
      ] as any);

      const res = await request(app)
        .get('/api/admin/login-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].email).toBe(otherUser.email);
    });
  });
});
