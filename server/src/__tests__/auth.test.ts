import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { config } from '../config/index.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

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
      loginLog: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe('Auth API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully without returning password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should return 409 if email is already registered', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'existing-id',
        email: 'test@example.com',
      } as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Existing User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EMAIL_EXISTS');
    });

    it('should return 400 validation error if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration when REGISTRATION_CODE is set and code is missing or wrong', async () => {
      const originalCode = config.registrationCode;
      config.registrationCode = 'INVITE_SECRET_2026';

      try {
        // Missing code
        const resMissing = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'New Dev',
            email: 'newdev@example.com',
            password: 'password123',
          });
        expect(resMissing.status).toBe(403);
        expect(resMissing.body.code).toBe('INVALID_INVITE_CODE');

        // Wrong code
        const resWrong = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'New Dev',
            email: 'newdev@example.com',
            password: 'password123',
            inviteCode: 'WRONG_CODE',
          });
        expect(resWrong.status).toBe(403);
        expect(resWrong.body.code).toBe('INVALID_INVITE_CODE');

        // Correct code
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
        vi.mocked(prisma.user.create).mockResolvedValueOnce({
          id: 'user-with-invite',
          name: 'New Dev',
          email: 'newdev@example.com',
          createdAt: new Date(),
        } as any);

        const resSuccess = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'New Dev',
            email: 'newdev@example.com',
            password: 'password123',
            inviteCode: 'INVITE_SECRET_2026',
          });
        expect(resSuccess.status).toBe(201);
        expect(resSuccess.body.success).toBe(true);
      } finally {
        config.registrationCode = originalCode;
      }
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login and return access token with httpOnly refresh cookie', async () => {
      const passwordHash = await bcrypt.hash('secretPass123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'secretPass123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArr.some((c) => typeof c === 'string' && c.includes('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('should return 401 on incorrect credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token using valid refresh token cookie', async () => {
      const userId = 'user-refresh-1';
      const email = 'refresh@example.com';
      const token = generateRefreshToken({ userId, email });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: userId,
        email,
        name: 'Refresh User',
        refreshToken: token,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should return 401 if refresh token is missing', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when valid bearer token is provided', async () => {
      const userId = 'user-me-1';
      const email = 'me@example.com';
      const accessToken = generateAccessToken({ userId, email });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: userId,
        email,
        name: 'Me User',
        avatarUrl: null,
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
    });

    it('should return 401 when authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/auth/config', () => {
    it('should report inviteCodeRequired false when REGISTRATION_CODE is unset', async () => {
      const originalCode = config.registrationCode;
      config.registrationCode = '';
      try {
        const res = await request(app).get('/api/auth/config');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.inviteCodeRequired).toBe(false);
      } finally {
        config.registrationCode = originalCode;
      }
    });

    it('should report inviteCodeRequired true when REGISTRATION_CODE is configured', async () => {
      const originalCode = config.registrationCode;
      config.registrationCode = 'VIP_ONLY_2026';
      try {
        const res = await request(app).get('/api/auth/config');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.inviteCodeRequired).toBe(true);
      } finally {
        config.registrationCode = originalCode;
      }
    });
  });

  describe('Cookie Security & HTTPS Proxy Forwarding', () => {
    it('should set Secure cookie attribute when x-forwarded-proto is https', async () => {
      const passwordHash = await bcrypt.hash('secretPass123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-https-1',
        email: 'https@example.com',
        name: 'Https User',
        passwordHash,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-proto', 'https')
        .send({
          email: 'https@example.com',
          password: 'secretPass123',
        });

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArr.some((c) => typeof c === 'string' && c.includes('Secure'))).toBe(true);
      expect(cookieArr.some((c) => typeof c === 'string' && c.includes('SameSite=Lax'))).toBe(true);
    });
  });

  describe('GET /api/runner/health (Runner Proxy)', () => {
    it('should proxy runner health without exposing internal port 4000', async () => {
      const originalFetch = globalThis.fetch;
      try {
        // Mock internal runner responding ok
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'ok',
            service: 'collab-editor-runner',
            supportedLanguages: ['python', 'javascript'],
            queue: { activeJobs: 0, queuedJobs: 0, maxConcurrency: 3 },
          }),
        } as any);

        const res = await request(app).get('/api/runner/health');
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('collab-editor-runner');
        expect(res.body.queue.maxConcurrency).toBe(3);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should return 503 when runner service is unavailable', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));

        const res = await request(app).get('/api/runner/health');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('unavailable');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
