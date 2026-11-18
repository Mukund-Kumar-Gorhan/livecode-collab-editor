import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken } from '../utils/jwt.js';
import { docs, WSSharedDoc } from '../sockets/collab.js';

vi.mock('../config/prisma.js', () => {
  return {
    prisma: {
      room: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      roomMember: {
        findUnique: vi.fn(),
      },
      snapshot: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      executionLog: {
        create: vi.fn(),
      },
    },
  };
});

describe('POST /api/rooms/:shortId/run', () => {
  const ownerId = 'user-owner-1';
  const ownerEmail = 'owner@example.com';
  const ownerToken = generateAccessToken({ userId: ownerId, email: ownerEmail });

  const editorId = 'user-editor-2';
  const editorEmail = 'editor@example.com';
  const editorToken = generateAccessToken({ userId: editorId, email: editorEmail });

  const viewerId = 'user-viewer-3';
  const viewerEmail = 'viewer@example.com';
  const viewerToken = generateAccessToken({ userId: viewerId, email: viewerEmail });

  const strangerId = 'user-stranger-4';
  const strangerEmail = 'stranger@example.com';
  const strangerToken = generateAccessToken({ userId: strangerId, email: strangerEmail });

  const mockRoom = {
    id: 'room-uuid-101',
    shortId: 'run-test-room',
    name: 'Run Test Room',
    language: 'python',
    ownerId,
    members: [
      { userId: ownerId, role: 'OWNER' },
      { userId: editorId, role: 'EDITOR' },
      { userId: viewerId, role: 'VIEWER' },
    ],
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);
    (prisma.snapshot.findFirst as any) = vi.fn().mockResolvedValue(null);
    (prisma.executionLog.create as any) = vi.fn().mockImplementation((args: any) =>
      Promise.resolve({ id: 'log-1', ...args.data, createdAt: new Date() })
    );

    // Mock fetch to simulate Runner service
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/execute')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              stdout: 'Execution output hello world\n',
              stderr: '',
              exitCode: 0,
              durationMs: 42,
              timedOut: false,
            }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    docs.delete('run-test-room');
  });

  it('should return 401 when running code without token', async () => {
    const res = await request(app).post('/api/rooms/run-test-room/run');
    expect(res.status).toBe(401);
  });

  it('should allow OWNER to execute code and write result to Y.Doc and ExecutionLog', async () => {
    const res = await request(app)
      .post('/api/rooms/run-test-room/run')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stdout).toBe('Execution output hello world\n');
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.runBy).toBe('owner');

    // Verify ExecutionLog was saved
    expect(prisma.executionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: mockRoom.id,
          userId: ownerId,
          language: 'python',
          status: 'SUCCESS',
        }),
      })
    );

    // Verify Y.Doc map has latest execution result
    const doc = docs.get('run-test-room');
    expect(doc).toBeDefined();
    const latestRun = doc?.getMap('run').get('latest') as any;
    expect(latestRun).toBeDefined();
    expect(latestRun.stdout).toBe('Execution output hello world\n');
    expect(latestRun.runBy).toBe('owner');
  });

  it('should allow EDITOR to execute code', async () => {
    const res = await request(app)
      .post('/api/rooms/run-test-room/run')
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.runBy).toBe('editor');
  });

  it('should reject VIEWER role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/rooms/run-test-room/run')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.message).toMatch(/viewer/i);
    expect(prisma.executionLog.create).not.toHaveBeenCalled();
  });

  it('should reject stranger (non-member) with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/rooms/run-test-room/run')
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 404 if room does not exist', async () => {
    (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(null);

    const res = await request(app)
      .post('/api/rooms/non-existent-room/run')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});
