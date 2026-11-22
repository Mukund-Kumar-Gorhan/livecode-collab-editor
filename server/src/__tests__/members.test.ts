import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Y from 'yjs';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken } from '../utils/jwt.js';
import {
  docs,
  WSSharedDoc,
  handleMessage,
  updateMemberRoleInCollab,
  kickMemberFromCollab,
  setupCollabConnection,
} from '../sockets/collab.js';
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
        update: vi.fn(),
        delete: vi.fn(),
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

describe('Feature: Members Panel & Live Role Changes', () => {
  const ownerId = 'user-owner-999';
  const ownerToken = generateAccessToken({ userId: ownerId, email: 'owner@editor.com' });
  const editorId = 'user-editor-888';
  const editorToken = generateAccessToken({ userId: editorId, email: 'editor@editor.com' });
  const viewerId = 'user-viewer-777';
  const viewerToken = generateAccessToken({ userId: viewerId, email: 'viewer@editor.com' });

  const roomId = 'room-members-test';
  const shortId = 'members-room';

  const mockRoom = {
    id: roomId,
    shortId,
    name: 'Members Test Room',
    language: 'python',
    ownerId,
    members: [
      { id: 'mem-1', roomId, userId: ownerId, role: 'OWNER' },
      { id: 'mem-2', roomId, userId: editorId, role: 'EDITOR' },
      { id: 'mem-3', roomId, userId: viewerId, role: 'VIEWER' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Owner Role Management & Non-Owner 403', () => {
    it('should allow owner to update member role from EDITOR to VIEWER', async () => {
      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);
      (prisma.roomMember.findUnique as any) = vi.fn().mockResolvedValue({
        id: 'mem-2',
        roomId,
        userId: editorId,
        role: 'EDITOR',
      });
      (prisma.roomMember.update as any) = vi.fn().mockResolvedValue({
        id: 'mem-2',
        roomId,
        userId: editorId,
        role: 'VIEWER',
        user: { id: editorId, name: 'Editor User', email: 'editor@editor.com' },
      });

      const res = await request(app)
        .patch(`/api/rooms/${shortId}/members/${editorId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.member.role).toBe('VIEWER');
      expect(prisma.roomMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId_userId: { roomId, userId: editorId } },
          data: { role: 'VIEWER' },
        })
      );
    });

    it('should reject non-owner role change with 403 Forbidden', async () => {
      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const res = await request(app)
        .patch(`/api/rooms/${shortId}/members/${viewerId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ role: 'EDITOR' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toMatch(/only room owner can change member roles/i);
    });

    it('should reject non-owner member removal with 403 Forbidden', async () => {
      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const res = await request(app)
        .delete(`/api/rooms/${shortId}/members/${viewerId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toMatch(/only room owner can remove members/i);
    });

    it('should prevent owner from changing their own role (400 Bad Request)', async () => {
      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const res = await request(app)
        .patch(`/api/rooms/${shortId}/members/${ownerId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CANNOT_CHANGE_OWNER_ROLE');
    });

    it('should prevent owner from kicking / removing themselves (400 Bad Request)', async () => {
      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);

      const res = await request(app)
        .delete(`/api/rooms/${shortId}/members/${ownerId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CANNOT_REMOVE_OWNER');
    });
  });

  describe('2. Live Role Enforcement in Yjs Collab WebSocket', () => {
    it('should immediately reject document updates from a demoted VIEWER', () => {
      const doc = new WSSharedDoc(shortId, roomId);
      docs.set(shortId, doc);

      const mockConn: any = {
        binaryType: 'arraybuffer',
        readyState: 1, // OPEN
        on: vi.fn(),
        send: vi.fn(),
      };

      // Initially connect user as EDITOR
      setupCollabConnection(mockConn, doc, { userId: editorId, role: 'EDITOR' });
      expect(doc.conns.get(mockConn)?.role).toBe('EDITOR');

      const filesMap = doc.getMap('files');
      const testFile = new Y.Text();
      testFile.insert(0, 'original editor content');
      filesMap.set('main.py', testFile);

      // Live role update: OWNER changes EDITOR to VIEWER
      updateMemberRoleInCollab(shortId, editorId, 'VIEWER');

      // Connection role must be updated to VIEWER
      expect(doc.conns.get(mockConn)?.role).toBe('VIEWER');
      expect(doc.getMap('roles').get(editorId)).toBe('VIEWER');

      // Attempt to send document update as demoted VIEWER
      const tempDoc = new Y.Doc();
      const tempFiles = tempDoc.getMap('files');
      const tempText = new Y.Text();
      tempText.insert(0, 'viewer should not be able to write');
      tempFiles.set('main.py', tempText);
      const updateData = Y.encodeStateAsUpdate(tempDoc);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // messageSync
      syncProtocol.writeUpdate(encoder, updateData);
      const rawMessage = encoding.toUint8Array(encoder);

      handleMessage(mockConn, doc, rawMessage);

      // Content must remain untouched because role is now VIEWER
      expect((filesMap.get('main.py') as Y.Text).toString()).toBe('original editor content');

      docs.delete(shortId);
    });

    it('should close connection and broadcast KICKED when a member is removed', async () => {
      (prisma.room.findUnique as any) = vi.fn().mockResolvedValue(mockRoom);
      (prisma.roomMember.findUnique as any) = vi.fn().mockResolvedValue({
        id: 'mem-2',
        roomId,
        userId: editorId,
      });
      (prisma.roomMember.delete as any) = vi.fn().mockResolvedValue({
        id: 'mem-2',
        roomId,
        userId: editorId,
      });

      const doc = new WSSharedDoc(shortId, roomId);
      docs.set(shortId, doc);

      let closed = false;
      const mockConn: any = {
        binaryType: 'arraybuffer',
        readyState: 1, // OPEN
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn().mockImplementation(() => {
          closed = true;
        }),
      };

      setupCollabConnection(mockConn, doc, { userId: editorId, role: 'EDITOR' });
      expect(doc.conns.has(mockConn)).toBe(true);

      // Owner kicks member
      const res = await request(app)
        .delete(`/api/rooms/${shortId}/members/${editorId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Connection must be closed
      expect(mockConn.close).toHaveBeenCalled();
      expect(doc.conns.has(mockConn)).toBe(false);

      // Roles map broadcasts 'KICKED'
      expect(doc.getMap('roles').get(editorId)).toBe('KICKED');

      docs.delete(shortId);
    });
  });
});
