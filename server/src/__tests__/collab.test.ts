import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { setupSockets } from '../sockets/index.js';
import { docs, messageSync } from '../sockets/collab.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken } from '../utils/jwt.js';

vi.mock('../config/prisma.js', () => {
  return {
    prisma: {
      room: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      snapshot: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

describe('Yjs Realtime Collab WebSocket Integration', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    docs.clear();

    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    setupSockets(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    docs.clear();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should reject connection when token is missing or invalid', async () => {
    const wsNoToken = new WebSocket(`ws://127.0.0.1:${port}/collab/room101`);
    const statusNoToken = await new Promise<number>((resolve) => {
      wsNoToken.on('unexpected-response', (_req, res) => {
        resolve(res.statusCode ?? 500);
      });
    });
    expect(statusNoToken).toBe(401);

    const wsBadToken = new WebSocket(`ws://127.0.0.1:${port}/collab/room101?token=bad-token`);
    const statusBadToken = await new Promise<number>((resolve) => {
      wsBadToken.on('unexpected-response', (_req, res) => {
        resolve(res.statusCode ?? 500);
      });
    });
    expect(statusBadToken).toBe(401);
  });

  it('should reject connection when user is not a member of the room', async () => {
    const token = generateAccessToken({ userId: 'stranger-id', email: 'stranger@example.com' });

    vi.mocked(prisma.room.findUnique).mockResolvedValueOnce({
      id: 'room-uuid',
      shortId: 'room101',
      name: 'Test Room',
      slug: 'test-room',
      language: 'python',
      description: null,
      isPublic: false,
      ownerId: 'owner-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'member-1',
          roomId: 'room-uuid',
          userId: 'editor-id',
          role: 'EDITOR',
          joinedAt: new Date(),
        },
      ],
    } as any);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/collab/room101?token=${token}`);
    const statusCode = await new Promise<number>((resolve) => {
      ws.on('unexpected-response', (_req, res) => {
        resolve(res.statusCode ?? 500);
      });
    });

    expect(statusCode).toBe(403);
  });

  it('should allow two users to connect and sync real-time document edits', async () => {
    const ownerToken = generateAccessToken({ userId: 'owner-id', email: 'owner@example.com' });
    const editorToken = generateAccessToken({ userId: 'editor-id', email: 'editor@example.com' });

    const mockRoom = {
      id: 'room-uuid',
      shortId: 'room101',
      name: 'Collab Room',
      slug: 'collab-room',
      language: 'python',
      description: null,
      isPublic: false,
      ownerId: 'owner-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'member-1',
          roomId: 'room-uuid',
          userId: 'editor-id',
          role: 'EDITOR',
          joinedAt: new Date(),
        },
      ],
    };

    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.snapshot.findFirst).mockResolvedValue(null);

    const client1Doc = new Y.Doc();
    const client2Doc = new Y.Doc();

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/collab/room101?token=${ownerToken}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/collab/room101?token=${editorToken}`);

    // Wire sync handling for client1
    ws1.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const msgType = decoding.readVarUint(decoder);
      if (msgType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, client1Doc, ws1);
        if (encoding.length(encoder) > 1) {
          ws1.send(encoding.toUint8Array(encoder));
        }
      }
    });

    // Wire sync handling for client2
    ws2.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const msgType = decoding.readVarUint(decoder);
      if (msgType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, client2Doc, ws2);
        if (encoding.length(encoder) > 1) {
          ws2.send(encoding.toUint8Array(encoder));
        }
      }
    });

    await Promise.all([
      new Promise<void>((resolve) => ws1.on('open', () => resolve())),
      new Promise<void>((resolve) => ws2.on('open', () => resolve())),
    ]);

    // Send initial sync step 1 from both clients to handshake
    const enc1 = encoding.createEncoder();
    encoding.writeVarUint(enc1, messageSync);
    syncProtocol.writeSyncStep1(enc1, client1Doc);
    ws1.send(encoding.toUint8Array(enc1));

    const enc2 = encoding.createEncoder();
    encoding.writeVarUint(enc2, messageSync);
    syncProtocol.writeSyncStep1(enc2, client2Doc);
    ws2.send(encoding.toUint8Array(enc2));

    // Wait 100ms for initial sync to settle
    await new Promise((r) => setTimeout(r, 100));

    // Client 1 types text
    const text1 = client1Doc.getText('monaco');
    client1Doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== ws1) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        ws1.send(encoding.toUint8Array(encoder));
      }
    });

    text1.insert(0, '# LiveCode Realtime Sync Working!\n');

    // Wait for update propagation to Client 2
    await new Promise((r) => setTimeout(r, 200));

    const text2 = client2Doc.getText('monaco');
    expect(text2.toString()).toContain('# LiveCode Realtime Sync Working!');

    ws1.close();
    ws2.close();
  });

  it('should reject and ignore updates from VIEWER role', async () => {
    const ownerToken = generateAccessToken({ userId: 'owner-id', email: 'owner@example.com' });
    const viewerToken = generateAccessToken({ userId: 'viewer-id', email: 'viewer@example.com' });

    const mockRoom = {
      id: 'room-uuid',
      shortId: 'room101',
      name: 'Collab Room',
      slug: 'collab-room',
      language: 'python',
      description: null,
      isPublic: false,
      ownerId: 'owner-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'member-viewer',
          roomId: 'room-uuid',
          userId: 'viewer-id',
          role: 'VIEWER',
          joinedAt: new Date(),
        },
      ],
    };

    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.snapshot.findFirst).mockResolvedValue(null);

    const ownerDoc = new Y.Doc();
    const viewerDoc = new Y.Doc();

    const wsOwner = new WebSocket(`ws://127.0.0.1:${port}/collab/room101?token=${ownerToken}`);
    const wsViewer = new WebSocket(`ws://127.0.0.1:${port}/collab/room101?token=${viewerToken}`);

    wsOwner.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const msgType = decoding.readVarUint(decoder);
      if (msgType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, ownerDoc, wsOwner);
        if (encoding.length(encoder) > 1) {
          wsOwner.send(encoding.toUint8Array(encoder));
        }
      }
    });

    wsViewer.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const msgType = decoding.readVarUint(decoder);
      if (msgType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, viewerDoc, wsViewer);
        if (encoding.length(encoder) > 1) {
          wsViewer.send(encoding.toUint8Array(encoder));
        }
      }
    });

    await Promise.all([
      new Promise<void>((resolve) => wsOwner.on('open', () => resolve())),
      new Promise<void>((resolve) => wsViewer.on('open', () => resolve())),
    ]);

    // Initial handshake
    const encO = encoding.createEncoder();
    encoding.writeVarUint(encO, messageSync);
    syncProtocol.writeSyncStep1(encO, ownerDoc);
    wsOwner.send(encoding.toUint8Array(encO));

    const encV = encoding.createEncoder();
    encoding.writeVarUint(encV, messageSync);
    syncProtocol.writeSyncStep1(encV, viewerDoc);
    wsViewer.send(encoding.toUint8Array(encV));

    await new Promise((r) => setTimeout(r, 100));

    // Viewer attempts to inject code
    viewerDoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== wsViewer) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        wsViewer.send(encoding.toUint8Array(encoder));
      }
    });

    const viewerText = viewerDoc.getText('monaco');
    viewerText.insert(0, 'MALICIOUS_VIEWER_EDIT');

    await new Promise((r) => setTimeout(r, 200));

    // Verify server document does not contain viewer update
    const serverDoc = docs.get('room101');
    expect(serverDoc).toBeDefined();
    expect(serverDoc!.getText('monaco').toString()).not.toContain('MALICIOUS_VIEWER_EDIT');

    // Owner doc does not contain viewer update
    const ownerText = ownerDoc.getText('monaco');
    expect(ownerText.toString()).not.toContain('MALICIOUS_VIEWER_EDIT');

    wsOwner.close();
    wsViewer.close();
  });
});
