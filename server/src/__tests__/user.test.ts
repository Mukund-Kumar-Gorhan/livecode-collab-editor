import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
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

describe('User Profile API Routes', () => {
  const mockUser = {
    id: 'user-profile-123',
    email: 'dev@example.com',
    name: 'Developer Alice',
    bio: 'Fullstack developer & code lover',
    avatarColor: '#0ea5e9',
    avatarUrl: '/uploads/avatars/default.png',
    theme: 'midnight',
    editorFontSize: 14,
    defaultLanguage: 'python',
    tabSize: 2,
    passwordHash: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validToken = generateAccessToken({ userId: mockUser.id, email: mockUser.email });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUser.passwordHash = await bcrypt.hash('secretOldPassword123', 10);
  });

  describe('GET /api/users/me', () => {
    it('should return 401 when token is missing', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return user profile when authenticated', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(mockUser.id);
      expect(res.body.data.user.email).toBe(mockUser.email);
      expect(res.body.data.user.theme).toBe('midnight');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ name: 'Bob' });
      expect(res.status).toBe(401);
    });

    it('should reject invalid name (too short)', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'A' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid theme', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'solarized-invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid editorFontSize (< 10 or > 24)', async () => {
      const res1 = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ editorFontSize: 8 });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ editorFontSize: 28 });
      expect(res2.status).toBe(400);
    });

    it('should reject invalid tabSize', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ tabSize: 3 });

      expect(res.status).toBe(400);
    });

    it('should reject invalid avatarColor hex', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ avatarColor: 'red-not-hex' });

      expect(res.status).toBe(400);
    });

    it('should successfully update valid profile fields', async () => {
      const updatedUser = {
        ...mockUser,
        name: 'Alice Wonder',
        bio: 'Building realtime software',
        avatarColor: '#ec4899',
        theme: 'cyberpunk',
        editorFontSize: 16,
        defaultLanguage: 'javascript',
        tabSize: 4,
      };

      vi.mocked(prisma.user.update).mockResolvedValueOnce(updatedUser as any);

      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Alice Wonder',
          bio: 'Building realtime software',
          avatarColor: '#ec4899',
          theme: 'cyberpunk',
          editorFontSize: 16,
          defaultLanguage: 'javascript',
          tabSize: 4,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Alice Wonder');
      expect(res.body.data.user.theme).toBe('cyberpunk');
      expect(res.body.data.user.editorFontSize).toBe(16);
      expect(res.body.data.user.tabSize).toBe(4);
    });
  });

  describe('POST /api/users/me/avatar', () => {
    it('should reject avatar exceeding 200KB', async () => {
      const oversizedBuffer = Buffer.alloc(205 * 1024); // 205KB > 200KB
      // Mock valid PNG magic header
      oversizedBuffer[0] = 0x89;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;

      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'image/png')
        .send(oversizedBuffer);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/200KB/i);
    });

    it('should reject invalid image type (non-png/jpg/webp magic header)', async () => {
      const textBuffer = Buffer.from('plain text file masquerading as image');

      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'image/png')
        .send(textBuffer);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Only PNG, JPEG, and WebP/i);
    });

    it('should successfully upload valid PNG image and update avatarUrl', async () => {
      // Valid PNG header (8 bytes)
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        ...mockUser,
        avatarUrl: '/uploads/avatars/user-profile-123-12345.png',
      } as any);

      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'image/png')
        .send(validPng);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.avatarUrl).toContain('/uploads/avatars/');
    });
  });

  describe('DELETE /api/users/me/avatar', () => {
    it('should delete avatar and clear avatarUrl', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        ...mockUser,
        avatarUrl: null,
      } as any);

      const res = await request(app)
        .delete('/api/users/me/avatar')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.avatarUrl).toBeNull();
    });
  });

  describe('PATCH /api/users/me/password', () => {
    it('should reject if current password does not match', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'wrongPassword123',
          newPassword: 'newValidPassword888',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Current password is incorrect/i);
    });

    it('should reject if new password is too short (< 8 chars)', async () => {
      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'secretOldPassword123',
          newPassword: 'short',
        });

      expect(res.status).toBe(400);
    });

    it('should update password and invalidate refresh token on success', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'secretOldPassword123',
          newPassword: 'brandNewSecurePassword999',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refreshToken: null,
          }),
        })
      );
    });
  });
});
