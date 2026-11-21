import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Y from 'yjs';
import request from 'supertest';
import path from 'path';
import JSZip from 'jszip';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { config } from '../config/index.js';
import { generateAccessToken } from '../utils/jwt.js';
import { docs, WSSharedDoc } from '../sockets/collab.js';
import {
  isIgnoredPath,
  isBinaryExtension,
  hasNullByte,
  validateUploadBatch,
  commitFilesToYDoc,
  MAX_UPLOAD_FILES,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_SIZE_BYTES,
} from '../utils/uploadValidation.js';
import {
  validateRunnerPath,
  extractJavaEntryClass,
  verifyRunnerSecret,
} from '../utils/runnerSecurity.js';

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

describe('Phase A2: Multi-file Run, ZIP Download, Folder Upload & Runner Security', () => {
  describe('1. Folder Upload Limits & Ignore Rules', () => {
    it('should ignore node_modules, .git, dist, build, __pycache__, .DS_Store', () => {
      expect(isIgnoredPath('node_modules/express/index.js')).toBe(true);
      expect(isIgnoredPath('.git/HEAD')).toBe(true);
      expect(isIgnoredPath('dist/bundle.js')).toBe(true);
      expect(isIgnoredPath('build/output.css')).toBe(true);
      expect(isIgnoredPath('src/__pycache__/app.cpython-311.pyc')).toBe(true);
      expect(isIgnoredPath('nested/folder/.DS_Store')).toBe(true);

      // Allowed source files
      expect(isIgnoredPath('src/components/Editor.tsx')).toBe(false);
      expect(isIgnoredPath('main.py')).toBe(false);
      expect(isIgnoredPath('Helper.java')).toBe(false);
      expect(isIgnoredPath('utils/calc.cpp')).toBe(false);
    });

    it('should detect binary files by extension and by null byte check', () => {
      // Binary extensions
      expect(isBinaryExtension('assets/logo.png')).toBe(true);
      expect(isBinaryExtension('bin/app.exe')).toBe(true);
      expect(isBinaryExtension('files/archive.zip')).toBe(true);
      expect(isBinaryExtension('docs/manual.pdf')).toBe(true);
      expect(isBinaryExtension('build/output.class')).toBe(true);

      // Text extensions
      expect(isBinaryExtension('main.py')).toBe(false);
      expect(isBinaryExtension('index.js')).toBe(false);
      expect(isBinaryExtension('Main.java')).toBe(false);
      expect(isBinaryExtension('main.cpp')).toBe(false);

      // Null byte detection
      const binaryBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x00, 0x6f]); // 'Hel\0o'
      expect(hasNullByte(binaryBytes)).toBe(true);
      expect(hasNullByte('Hello\0World')).toBe(true);

      const textBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // 'Hello'
      expect(hasNullByte(textBytes)).toBe(false);
      expect(hasNullByte('Hello World')).toBe(false);
    });

    it('should enforce upload limits (single file <= 200KB, max 200 files, total <= 2MB)', () => {
      const existing = new Set<string>();

      // File exceeding 200KB
      const oversized = [
        {
          path: 'huge.py',
          size: 201 * 1024,
          content: 'x'.repeat(201 * 1024),
        },
      ];
      const res1 = validateUploadBatch(oversized, existing);
      expect(res1.accepted).toHaveLength(0);
      expect(res1.skipped).toHaveLength(1);
      expect(res1.skipped[0].reason).toMatch(/200KB/i);

      // Exceeding 200 files limit
      const manyFiles = Array.from({ length: 205 }, (_, i) => ({
        path: `file_${i}.py`,
        size: 50,
        content: `print(${i})`,
      }));
      const res2 = validateUploadBatch(manyFiles, existing);
      expect(res2.accepted).toHaveLength(MAX_UPLOAD_FILES);
      expect(res2.skipped).toHaveLength(5);
      expect(res2.skipped[0].reason).toMatch(/max limit of 200 files/i);

      // Exceeding total size of 2MB (with individual files under 200KB)
      // 15 files * 150KB = 2250KB > 2048KB (2MB)
      const bigTotal = Array.from({ length: 15 }, (_, i) => ({
        path: `chunk_${i}.py`,
        size: 150 * 1024,
        content: 'print(1)',
      }));
      const res3 = validateUploadBatch(bigTotal, existing);
      expect(res3.accepted.length).toBe(13); // 13 * 150KB = 1950KB <= 2048KB
      expect(res3.skipped.length).toBe(2);
      expect(res3.skipped[0].reason).toMatch(/2MB/i);
    });

    it('should detect duplicate paths as conflicts for replace/skip/rename prompt', () => {
      const existing = new Set<string>(['src/index.js']);
      const batch = [
        { path: 'src/index.js', size: 50, content: 'console.log("new");' },
        { path: 'src/helper.js', size: 40, content: 'export const h = 1;' },
      ];

      const res = validateUploadBatch(batch, existing);
      expect(res.accepted).toHaveLength(1);
      expect(res.accepted[0].path).toBe('src/helper.js');
      expect(res.conflicts).toHaveLength(1);
      expect(res.conflicts[0].path).toBe('src/index.js');
    });

    it('should commit files into Y.Doc inside ydoc.transact and create parent folders', () => {
      const ydoc = new Y.Doc();
      const filesMap = ydoc.getMap('files');
      const foldersMap = ydoc.getMap('folders');

      let updateCount = 0;
      ydoc.on('update', () => {
        updateCount++;
      });

      const toCommit = [
        { path: 'src/components/App.tsx', content: 'export const App = 1;' },
        { path: 'src/utils/math.ts', content: 'export const add = 2;' },
        { path: 'README.md', content: '# Readme' },
      ];

      commitFilesToYDoc(ydoc, toCommit);

      expect(filesMap.get('src/components/App.tsx')?.toString()).toBe('export const App = 1;');
      expect(filesMap.get('src/utils/math.ts')?.toString()).toBe('export const add = 2;');
      expect(filesMap.get('README.md')?.toString()).toBe('# Readme');

      expect(foldersMap.has('src')).toBe(true);
      expect(foldersMap.has('src/components')).toBe(true);
      expect(foldersMap.has('src/utils')).toBe(true);

      // Single atomic transaction -> 1 update event
      expect(updateCount).toBe(1);
    });
  });

  describe('2. Download as ZIP Structure (JSZip)', () => {
    it('should generate zip preserving folder structure', async () => {
      const zip = new JSZip();
      const files = [
        { path: 'src/app.py', content: 'print("app")' },
        { path: 'src/utils/calc.py', content: 'def calc(): pass' },
        { path: 'docs/guide.md', content: '# Guide' },
      ];

      for (const f of files) {
        zip.file(f.path, f.content);
      }

      const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });
      const loadedZip = await JSZip.loadAsync(zipBlob);

      expect(loadedZip.file('src/app.py')).not.toBeNull();
      expect(await loadedZip.file('src/app.py')?.async('string')).toBe('print("app")');

      expect(loadedZip.file('src/utils/calc.py')).not.toBeNull();
      expect(await loadedZip.file('src/utils/calc.py')?.async('string')).toBe('def calc(): pass');

      expect(loadedZip.file('docs/guide.md')).not.toBeNull();
      expect(await loadedZip.file('docs/guide.md')?.async('string')).toBe('# Guide');
    });

    it('should filter files when downloading a specific folder', async () => {
      const allFiles = [
        { path: 'src/app.py', content: 'app' },
        { path: 'src/utils/helper.py', content: 'helper' },
        { path: 'tests/test_app.py', content: 'test' },
      ];

      const folderPrefix = 'src/';
      const folderZip = new JSZip();

      allFiles
        .filter((f) => f.path.startsWith(folderPrefix))
        .forEach((f) => {
          folderZip.file(f.path.slice(folderPrefix.length), f.content);
        });

      const zipBlob = await folderZip.generateAsync({ type: 'nodebuffer' });
      const loaded = await JSZip.loadAsync(zipBlob);

      expect(loaded.file('app.py')).not.toBeNull();
      expect(loaded.file('utils/helper.py')).not.toBeNull();
      expect(loaded.file('tests/test_app.py')).toBeNull();
    });
  });

  describe('3. Multi-file Run (Python & Java)', () => {
    it('should correctly extract Java entry class and package', () => {
      const codeSimple = 'public class Solution { public static void main(String[] args) {} }';
      expect(extractJavaEntryClass('Solution.java', codeSimple)).toBe('Solution');

      const codePkg = `
        package org.collab.demo;
        public class MainApp {
          public static void main(String[] args) {}
        }
      `;
      expect(extractJavaEntryClass('src/MainApp.java', codePkg)).toBe('org.collab.demo.MainApp');
    });

    it('should execute multi-file project and send shared runner secret', async () => {
      const ownerId = 'user-owner-phaseA2';
      const ownerToken = generateAccessToken({ userId: ownerId, email: 'owner@phaseA2.com' });

      const mockRoom = {
        id: 'room-phaseA2-id',
        shortId: 'multi-run-phaseA2',
        name: 'Phase A2 Multi Run Room',
        language: 'python',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);
      (prisma.snapshot.findFirst as any) = vi.fn().mockResolvedValue(null);
      (prisma.executionLog.create as any) = vi.fn().mockImplementation((args: any) =>
        Promise.resolve({ id: 'log-a2', ...args.data, createdAt: new Date() })
      );

      // Create Y.Doc with 2 Python files: main.py and helper.py
      const doc = new WSSharedDoc('multi-run-phaseA2', mockRoom.id);
      docs.set('multi-run-phaseA2', doc);
      const filesMap = doc.getMap('files');

      const helperText = new Y.Text();
      helperText.insert(0, 'def greet(name):\n    return f"Hello, {name}!"\n');
      filesMap.set('helper.py', helperText);

      const mainText = new Y.Text();
      mainText.insert(0, 'from helper import greet\nprint(greet("LiveCode"))\n');
      filesMap.set('main.py', mainText);

      // Auto-detect should pick main.py
      let capturedHeaders: any = null;
      let capturedBody: any = null;

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
        if (url.includes('/execute')) {
          capturedHeaders = opts.headers;
          capturedBody = JSON.parse(opts.body);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                stdout: 'Hello, LiveCode!\n',
                stderr: '',
                exitCode: 0,
                durationMs: 38,
                timedOut: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }) as any;

      try {
        const res = await request(app)
          .post('/api/rooms/multi-run-phaseA2/run')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.stdout).toBe('Hello, LiveCode!\n');

        // Verify shared runner secret header
        expect(capturedHeaders['x-runner-secret']).toBe(config.runnerSecret);

        // Verify multi-file payload structure
        expect(capturedBody.language).toBe('python');
        expect(capturedBody.entry).toBe('main.py');
        expect(capturedBody.files).toHaveLength(2);
        expect(capturedBody.files.find((f: any) => f.path === 'helper.py')).toBeDefined();
        expect(capturedBody.files.find((f: any) => f.path === 'main.py')).toBeDefined();
      } finally {
        global.fetch = originalFetch;
        docs.delete('multi-run-phaseA2');
      }
    });

    it('should support Java multi-file execution with 2 files', async () => {
      const ownerId = 'user-owner-java';
      const ownerToken = generateAccessToken({ userId: ownerId, email: 'owner@java.com' });

      const mockRoom = {
        id: 'room-java-id',
        shortId: 'java-multi-room',
        name: 'Java Multi Run Room',
        language: 'java',
        ownerId,
        members: [{ userId: ownerId, role: 'OWNER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);
      (prisma.snapshot.findFirst as any) = vi.fn().mockResolvedValue(null);
      (prisma.executionLog.create as any) = vi.fn().mockImplementation((args: any) =>
        Promise.resolve({ id: 'log-java', ...args.data, createdAt: new Date() })
      );

      const doc = new WSSharedDoc('java-multi-room', mockRoom.id);
      docs.set('java-multi-room', doc);
      const filesMap = doc.getMap('files');

      const helperText = new Y.Text();
      helperText.insert(
        0,
        'public class Helper {\n    public static String getMsg() { return "Java multi-file works!"; }\n}'
      );
      filesMap.set('Helper.java', helperText);

      const mainText = new Y.Text();
      mainText.insert(
        0,
        'public class Main {\n    public static void main(String[] args) {\n        System.out.println(Helper.getMsg());\n    }\n}'
      );
      filesMap.set('Main.java', mainText);

      let capturedBody: any = null;
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
        if (url.includes('/execute')) {
          capturedBody = JSON.parse(opts.body);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                stdout: 'Java multi-file works!\n',
                stderr: '',
                exitCode: 0,
                durationMs: 85,
                timedOut: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }) as any;

      try {
        const res = await request(app)
          .post('/api/rooms/java-multi-room/run')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.stdout).toBe('Java multi-file works!\n');

        expect(capturedBody.language).toBe('java');
        expect(capturedBody.entry).toBe('Main.java');
        expect(capturedBody.files).toHaveLength(2);
      } finally {
        global.fetch = originalFetch;
        docs.delete('java-multi-room');
      }
    });
  });

  describe('4. Runner Security (Path Traversal & Shared Secret)', () => {
    it('should block directory traversal attempts in validateRunnerPath', () => {
      const sandboxRoot = path.resolve('/tmp/sandboxes/exec_123');

      expect(() => validateRunnerPath('../secret.env', sandboxRoot)).toThrow(/traversal/i);
      expect(() => validateRunnerPath('src/../../etc/passwd', sandboxRoot)).toThrow(/traversal/i);
      expect(() => validateRunnerPath('..\\windows\\system32', sandboxRoot)).toThrow(/traversal/i);
      expect(() => validateRunnerPath('/etc/shadow', sandboxRoot)).toThrow(/absolute/i);
      expect(() => validateRunnerPath('C:\\boot.ini', sandboxRoot)).toThrow(/absolute/i);
      expect(() => validateRunnerPath('test\x00.py', sandboxRoot)).toThrow(/null byte/i);

      const validPath = validateRunnerPath('src/utils/calc.py', sandboxRoot);
      expect(validPath.startsWith(sandboxRoot)).toBe(true);
      expect(validPath).toContain(path.join('src', 'utils', 'calc.py'));
    });

    it('should verify runner shared secret header correctly', () => {
      const secret = 'super_secret_runner_key';
      expect(verifyRunnerSecret(undefined, secret)).toBe(false);
      expect(verifyRunnerSecret('', secret)).toBe(false);
      expect(verifyRunnerSecret('wrong_key', secret)).toBe(false);
      expect(verifyRunnerSecret(secret, secret)).toBe(true);
    });
  });

  describe('5. Viewer Role Enforcement (Upload & Run 403 Forbidden)', () => {
    it('should reject VIEWER role from running room code with 403 Forbidden', async () => {
      const viewerId = 'viewer-user-only';
      const viewerToken = generateAccessToken({ userId: viewerId, email: 'viewer@editor.com' });

      const mockRoom = {
        id: 'room-viewer-enforce',
        shortId: 'viewer-room-short',
        name: 'Viewer Protected Room',
        language: 'python',
        ownerId: 'some-owner-id',
        members: [{ userId: viewerId, role: 'VIEWER' }],
      };

      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const res = await request(app)
        .post('/api/rooms/viewer-room-short/run')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toMatch(/viewers are not permitted to run code/i);
    });
  });
});
