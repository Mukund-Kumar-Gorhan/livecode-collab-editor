import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import { validateWorkspacePath, normalizeWorkspacePath } from '../utils/pathValidation.js';
import {
  WSSharedDoc,
  ensureMultiFileStructure,
  getDefaultFileName,
  docs,
  handleMessage,
  messageSync,
} from '../sockets/collab.js';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import { prisma } from '../config/prisma.js';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

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

describe('Phase A1: Multi-file Workspace & File Explorer', () => {
  describe('1. Path Validation', () => {
    it('should normalize paths with backslashes and redundant slashes', () => {
      expect(normalizeWorkspacePath('src\\components\\App.tsx')).toBe('src/components/App.tsx');
      expect(normalizeWorkspacePath('/src//utils///math.ts/')).toBe('src/utils/math.ts');
    });

    it('should reject empty or whitespace paths', () => {
      expect(validateWorkspacePath('').valid).toBe(false);
      expect(validateWorkspacePath('   ').valid).toBe(false);
    });

    it('should reject directory traversal ("..")', () => {
      const res1 = validateWorkspacePath('../secret.env');
      expect(res1.valid).toBe(false);
      expect(res1.error).toMatch(/traversal/i);

      const res2 = validateWorkspacePath('src/../../etc/passwd');
      expect(res2.valid).toBe(false);
      expect(res2.error).toMatch(/traversal/i);
    });

    it('should reject absolute paths', () => {
      const res1 = validateWorkspacePath('/var/log/app.log');
      expect(res1.valid).toBe(false);
      expect(res1.error).toMatch(/absolute/i);

      const res2 = validateWorkspacePath('C:\\Windows\\System32');
      expect(res2.valid).toBe(false);
      expect(res2.error).toMatch(/absolute/i);
    });

    it('should reject paths exceeding 255 characters', () => {
      const longName = 'a'.repeat(256) + '.txt';
      const res = validateWorkspacePath(longName);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/255/);
    });

    it('should reject invalid filesystem characters', () => {
      const res = validateWorkspacePath('my<invalid>file.py');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/invalid characters/i);
    });

    it('should reject duplicate paths', () => {
      const existing = ['src/main.py', 'README.md'];
      const res = validateWorkspacePath('src/main.py', existing);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/already exists/i);
    });

    it('should accept valid clean paths', () => {
      const res = validateWorkspacePath('src/components/Button.tsx', ['main.py']);
      expect(res.valid).toBe(true);
      expect(res.normalizedPath).toBe('src/components/Button.tsx');
    });
  });

  describe('2. Snapshot Save & Restore of Files and Folders', () => {
    it('should persist and fully restore multiple files and empty folders via binary snapshot', () => {
      const originalDoc = new WSSharedDoc('multi-room-1', 'room-uuid-1');
      const filesMap = originalDoc.getMap('files');
      const foldersMap = originalDoc.getMap('folders');

      // Add files
      const mainPy = new Y.Text();
      mainPy.insert(0, 'print("Hello from Python")');
      filesMap.set('main.py', mainPy);

      const utilsTs = new Y.Text();
      utilsTs.insert(0, 'export const add = (a: number, b: number) => a + b;');
      filesMap.set('src/utils.ts', utilsTs);

      // Add empty folder
      foldersMap.set('empty-folder', { createdAt: Date.now() });

      // Encode state update (binary snapshot)
      const update = Y.encodeStateAsUpdate(originalDoc);
      expect(update.byteLength).toBeGreaterThan(0);

      // Restore into fresh Y.Doc
      const restoredDoc = new WSSharedDoc('multi-room-1', 'room-uuid-1');
      Y.applyUpdate(restoredDoc, update);

      const restoredFiles = restoredDoc.getMap('files');
      const restoredFolders = restoredDoc.getMap('folders');

      expect(restoredFiles.size).toBe(2);
      expect((restoredFiles.get('main.py') as Y.Text).toString()).toBe('print("Hello from Python")');
      expect((restoredFiles.get('src/utils.ts') as Y.Text).toString()).toBe(
        'export const add = (a: number, b: number) => a + b;'
      );

      expect(restoredFolders.size).toBe(1);
      expect(restoredFolders.has('empty-folder')).toBe(true);
    });
  });

  describe('3. Legacy Single-File Room Migration', () => {
    it('should map language to correct default filename', () => {
      expect(getDefaultFileName('python')).toBe('main.py');
      expect(getDefaultFileName('javascript')).toBe('index.js');
      expect(getDefaultFileName('java')).toBe('Main.java');
      expect(getDefaultFileName('cpp')).toBe('main.cpp');
    });

    it('should migrate legacy single-file monaco text into language-specific default file', () => {
      const doc = new WSSharedDoc('legacy-room', 'room-uuid-legacy');
      // Simulate old room with content in monaco Y.Text and empty files map
      doc.getText('monaco').insert(0, 'console.log("old single file content");');
      doc.getMap('metadata').set('language', 'javascript');

      expect(doc.getMap('files').size).toBe(0);

      ensureMultiFileStructure(doc, 'javascript');

      const filesMap = doc.getMap('files');
      expect(filesMap.size).toBe(1);
      expect(filesMap.has('index.js')).toBe(true);
      expect((filesMap.get('index.js') as Y.Text).toString()).toBe(
        'console.log("old single file content");'
      );
    });

    it('should initialize fresh room with starter code in default file', () => {
      const doc = new WSSharedDoc('fresh-room', 'room-uuid-fresh');
      ensureMultiFileStructure(doc, 'python');

      const filesMap = doc.getMap('files');
      expect(filesMap.size).toBe(1);
      expect(filesMap.has('main.py')).toBe(true);
      expect((filesMap.get('main.py') as Y.Text).toString()).toContain('fibonacci');
    });
  });

  describe('4. Viewer Role Blocking & Enforcement', () => {
    it('should reject document updates from VIEWER role in Yjs handleMessage', () => {
      const doc = new WSSharedDoc('perm-room', 'room-uuid-perm');
      const filesMap = doc.getMap('files');
      const fileText = new Y.Text();
      fileText.insert(0, 'original content');
      filesMap.set('main.py', fileText);

      // Create a mock websocket connection with VIEWER role
      const mockWs = { readyState: 1, send: vi.fn(), close: vi.fn() } as any;
      doc.conns.set(mockWs, {
        userId: 'viewer-user',
        role: 'VIEWER',
        controlledIds: new Set(),
      });

      // Prepare an update message from viewer trying to modify document
      const tempDoc = new Y.Doc();
      const tempText = tempDoc.getText('test');
      tempText.insert(0, 'malicious change');
      const updateData = Y.encodeStateAsUpdate(tempDoc);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, updateData);
      const payload = encoding.toUint8Array(encoder);

      // Send through handleMessage
      handleMessage(mockWs, doc, payload);

      // Content should remain untouched
      expect((filesMap.get('main.py') as Y.Text).toString()).toBe('original content');
    });
  });

  describe('5. Run Room Code with Multi-file Active File', () => {
    const ownerId = 'user-owner-1';
    const ownerToken = generateAccessToken({ userId: ownerId, email: 'owner@example.com' });
    const viewerId = 'user-viewer-1';
    const viewerToken = generateAccessToken({ userId: viewerId, email: 'viewer@example.com' });

    const mockRoom = {
      id: 'room-multi-run',
      shortId: 'multi-run-short',
      name: 'Multi Run Room',
      language: 'python',
      ownerId,
      members: [
        { userId: ownerId, role: 'OWNER' },
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

      global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
        if (url.includes('/execute')) {
          const body = JSON.parse(opts.body);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                stdout: `Executed ${body.language}: ${body.code}`,
                stderr: '',
                exitCode: 0,
                durationMs: 35,
                timedOut: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }) as any;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      docs.delete('multi-run-short');
    });

    it('should execute specific activeFile and auto-detect language from extension', async () => {
      const doc = new WSSharedDoc('multi-run-short', mockRoom.id);
      docs.set('multi-run-short', doc);
      const filesMap = doc.getMap('files');

      const cppText = new Y.Text();
      cppText.insert(0, '#include <iostream>\nint main() { return 0; }');
      filesMap.set('src/solution.cpp', cppText);

      const res = await request(app)
        .post('/api/rooms/multi-run-short/run')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ activeFile: 'src/solution.cpp' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stdout).toContain('Executed cpp:');

      // Verify ExecutionLog recorded the detected cpp language
      expect(prisma.executionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            language: 'cpp',
          }),
        })
      );
    });

    it('should return 404 if activeFile does not exist in workspace', async () => {
      const doc = new WSSharedDoc('multi-run-short', mockRoom.id);
      docs.set('multi-run-short', doc);

      const res = await request(app)
        .post('/api/rooms/multi-run-short/run')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ activeFile: 'non-existent.py' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('FILE_NOT_FOUND');
    });

    it('should reject execution of non-executable file types like markdown', async () => {
      const doc = new WSSharedDoc('multi-run-short', mockRoom.id);
      docs.set('multi-run-short', doc);
      const filesMap = doc.getMap('files');

      const mdText = new Y.Text();
      mdText.insert(0, '# Notes\nThis is markdown');
      filesMap.set('README.md', mdText);

      const res = await request(app)
        .post('/api/rooms/multi-run-short/run')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ activeFile: 'README.md' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UNSUPPORTED_LANGUAGE');
    });

    it('should reject VIEWER role from running code with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/rooms/multi-run-short/run')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ activeFile: 'main.py' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
