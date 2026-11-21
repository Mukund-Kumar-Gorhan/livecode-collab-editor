import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Y from 'yjs';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken } from '../utils/jwt.js';
import { docs, WSSharedDoc, handleMessage } from '../sockets/collab.js';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';

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

describe('Feature: Program Input (stdin) Support', () => {
  const ownerId = 'user-owner-101';
  const ownerToken = generateAccessToken({ userId: ownerId, email: 'owner@editor.com' });
  const viewerId = 'user-viewer-202';
  const viewerToken = generateAccessToken({ userId: viewerId, email: 'viewer@editor.com' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Zod Validation (10KB limit)', () => {
    it('should reject stdin larger than 10KB with 400 Bad Request', async () => {
      const mockRoom = {
        id: 'room-stdin-val',
        shortId: 'stdin-val-room',
        name: 'Stdin Validation Room',
        language: 'python',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const oversizedStdin = 'A'.repeat(10 * 1024 + 1); // 10241 bytes > 10KB

      const res = await request(app)
        .post('/api/rooms/stdin-val-room/run')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ stdin: oversizedStdin });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/10KB/i);
    });

    it('should accept stdin up to 10KB (e.g. 5KB)', async () => {
      const mockRoom = {
        id: 'room-stdin-valid',
        shortId: 'stdin-valid-room',
        name: 'Stdin Valid Room',
        language: 'python',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const validDoc = new WSSharedDoc('stdin-valid-room', 'room-stdin-valid');
      const filesMap = validDoc.getMap('files');
      const pyText = new Y.Text();
      pyText.insert(0, 'name = input()\nprint(f"Hello {name}")\n');
      filesMap.set('main.py', pyText);
      docs.set('stdin-valid-room', validDoc);

      const originalFetch = global.fetch;
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            stdout: 'Hello World\n',
            stderr: '',
            exitCode: 0,
            durationMs: 120,
            timedOut: false,
          }),
        };
      }) as any;

      try {
        const inputContent = 'World\n';
        const res = await request(app)
          .post('/api/rooms/stdin-valid-room/run')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ activeFile: 'main.py', stdin: inputContent });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(capturedBody).toBeDefined();
        expect(capturedBody.stdin).toBe(inputContent);
        expect(res.body.data.stdin).toBe(inputContent);
        expect(res.body.data.stdout).toBe('Hello World\n');
      } finally {
        global.fetch = originalFetch;
        docs.delete('stdin-valid-room');
      }
    });
  });

  describe('2. Viewer Role Blocking (Run & Stdin Edit Block)', () => {
    it('should reject VIEWER role from running code with 403 Forbidden', async () => {
      const mockRoom = {
        id: 'room-viewer-stdin',
        shortId: 'viewer-stdin-room',
        name: 'Viewer Stdin Protected Room',
        language: 'cpp',
        ownerId,
        members: [
          { userId: ownerId, role: 'OWNER' },
          { userId: viewerId, role: 'VIEWER' },
        ],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const res = await request(app)
        .post('/api/rooms/viewer-stdin-room/run')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ stdin: '42\n' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toMatch(/viewers are not permitted/i);
    });

    it('should block VIEWER role from applying Yjs updates to metadata (stdin edit block)', () => {
      const mockDoc = new WSSharedDoc('viewer-edit-room', 'room-viewer-edit');
      const mockConn: any = {
        readyState: 1, // OPEN
        send: vi.fn(),
      };

      // Set connection metadata as VIEWER
      mockDoc.conns.set(mockConn, {
        userId: viewerId,
        role: 'VIEWER',
        controlledIds: new Set(),
      });

      // Construct a Yjs messageSync with SyncStep2 / update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // messageSync
      encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate); // update
      encoding.writeVarUint8Array(encoder, new Uint8Array([0, 0])); // dummy update
      const rawMessage = encoding.toUint8Array(encoder);

      // Attempt to handle message from viewer
      handleMessage(mockConn, mockDoc, rawMessage);

      // Verify metadata stdin was not modified by viewer update
      expect(mockDoc.getMap('metadata').get('stdin')).toBeUndefined();
    });
  });

  describe('3. Multi-language Stdin Execution (C++, Python, Java)', () => {
    it('should pass stdin to C++ runner and capture input in run result', async () => {
      const mockRoom = {
        id: 'room-cpp-stdin',
        shortId: 'cpp-stdin-room',
        name: 'C++ Stdin Room',
        language: 'cpp',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const doc = new WSSharedDoc('cpp-stdin-room', 'room-cpp-stdin');
      const filesMap = doc.getMap('files');
      const cppText = new Y.Text();
      cppText.insert(
        0,
        '#include <stdio.h>\nint main() { int a, b; scanf("%d %d", &a, &b); printf("Sum = %d\\n", a + b); return 0; }\n'
      );
      filesMap.set('main.cpp', cppText);
      docs.set('cpp-stdin-room', doc);

      const originalFetch = global.fetch;
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            stdout: 'Sum = 30\n',
            stderr: '',
            exitCode: 0,
            durationMs: 310,
            timedOut: false,
          }),
        };
      }) as any;

      try {
        const stdinInput = '10 20\n';
        const res = await request(app)
          .post('/api/rooms/cpp-stdin-room/run')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ activeFile: 'main.cpp', stdin: stdinInput });

        expect(res.status).toBe(200);
        expect(capturedBody.language).toBe('cpp');
        expect(capturedBody.stdin).toBe(stdinInput);
        expect(res.body.data.stdout).toBe('Sum = 30\n');
        expect(res.body.data.stdin).toBe(stdinInput);

        // Verify latest run in Y.Doc has stdin recorded
        const latestRun = doc.getMap('run').get('latest') as any;
        expect(latestRun.stdin).toBe(stdinInput);
      } finally {
        global.fetch = originalFetch;
        docs.delete('cpp-stdin-room');
      }
    });

    it('should read stdin from Y.Doc metadata if not passed in request body (Python)', async () => {
      const mockRoom = {
        id: 'room-py-stdin',
        shortId: 'py-stdin-room',
        name: 'Python Stdin Room',
        language: 'python',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const doc = new WSSharedDoc('py-stdin-room', 'room-py-stdin');
      const filesMap = doc.getMap('files');
      const pyText = new Y.Text();
      pyText.insert(0, 'x = input()\nprint(f"Echo: {x}")\n');
      filesMap.set('main.py', pyText);

      // Set stdin in Yjs metadata map
      doc.getMap('metadata').set('stdin', 'Shared Input Line\n');
      docs.set('py-stdin-room', doc);

      const originalFetch = global.fetch;
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            stdout: 'Echo: Shared Input Line\n',
            stderr: '',
            exitCode: 0,
            durationMs: 80,
            timedOut: false,
          }),
        };
      }) as any;

      try {
        const res = await request(app)
          .post('/api/rooms/py-stdin-room/run')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ activeFile: 'main.py' }); // no stdin in body, reads from metadata

        expect(res.status).toBe(200);
        expect(capturedBody.stdin).toBe('Shared Input Line\n');
        expect(res.body.data.stdin).toBe('Shared Input Line\n');
        expect(res.body.data.stdout).toBe('Echo: Shared Input Line\n');
      } finally {
        global.fetch = originalFetch;
        docs.delete('py-stdin-room');
      }
    });

    it('should pass stdin to Java Scanner runner', async () => {
      const mockRoom = {
        id: 'room-java-stdin',
        shortId: 'java-stdin-room',
        name: 'Java Stdin Room',
        language: 'java',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const doc = new WSSharedDoc('java-stdin-room', 'room-java-stdin');
      const filesMap = doc.getMap('files');
      const javaText = new Y.Text();
      javaText.insert(
        0,
        'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt();\n    System.out.println("N=" + n);\n  }\n}\n'
      );
      filesMap.set('Main.java', javaText);
      docs.set('java-stdin-room', doc);

      const originalFetch = global.fetch;
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            stdout: 'N=99\n',
            stderr: '',
            exitCode: 0,
            durationMs: 850,
            timedOut: false,
          }),
        };
      }) as any;

      try {
        const res = await request(app)
          .post('/api/rooms/java-stdin-room/run')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ activeFile: 'Main.java', stdin: '99\n' });

        expect(res.status).toBe(200);
        expect(capturedBody.language).toBe('java');
        expect(capturedBody.stdin).toBe('99\n');
        expect(res.body.data.stdout).toBe('N=99\n');
      } finally {
        global.fetch = originalFetch;
        docs.delete('java-stdin-room');
      }
    });
  });
});
