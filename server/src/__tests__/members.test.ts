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
import * as awarenessProtocol from 'y-protocols/awareness';
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

  describe('3. Members Online Status via Awareness States', () => {
    // Online status evaluator matching MembersPanel & RoomPage awareness logic
    const checkMemberOnline = (
      member: any,
      activeUsers: Array<{ clientId: number; userId?: string | number; isCurrentUser?: boolean }>,
      currentUserId?: string | number
    ): boolean => {
      const candidateIds: string[] = [];
      if (member.userId !== undefined && member.userId !== null) {
        candidateIds.push(String(member.userId).trim());
      }
      if (member.user?.id !== undefined && member.user?.id !== null) {
        candidateIds.push(String(member.user.id).trim());
      }
      if (candidateIds.length === 0 && member.id !== undefined && member.id !== null) {
        candidateIds.push(String(member.id).trim());
      }

      if (candidateIds.length === 0) return false;

      const currentUserIdStr =
        currentUserId !== undefined && currentUserId !== null ? String(currentUserId).trim() : null;

      return activeUsers.some((u) => {
        if (!u) return false;
        if (u.userId !== undefined && u.userId !== null) {
          const activeUserIdStr = String(u.userId).trim();
          if (candidateIds.includes(activeUserIdStr)) {
            return true;
          }
        }
        if (u.isCurrentUser && currentUserIdStr && candidateIds.includes(currentUserIdStr)) {
          return true;
        }
        return false;
      });
    };

    it('should show both users online when connected in the same room (not grey dot for other user)', () => {
      const doc = new WSSharedDoc(shortId, roomId);
      docs.set(shortId, doc);

      // Two users connected to the room
      const member1 = { id: 'mem-1', roomId, userId: ownerId, role: 'OWNER' };
      const member2 = { id: 'mem-2', roomId, userId: editorId, role: 'EDITOR' };

      // Awareness state with both users active
      const activeUsers = [
        { clientId: 101, userId: ownerId, isCurrentUser: true },
        { clientId: 102, userId: editorId, isCurrentUser: false },
      ];

      // From User 1's perspective (currentUserId = ownerId):
      // User 1 must be online (green) AND User 2 must also be online (green)
      const user1Online = checkMemberOnline(member1, activeUsers, ownerId);
      const user2Online = checkMemberOnline(member2, activeUsers, ownerId);

      expect(user1Online).toBe(true);
      expect(user2Online).toBe(true);

      docs.delete(shortId);
    });

    it('should resolve online status correctly with string vs number userId type mismatch', () => {
      // Member has numeric userId, awareness has string userId
      const memberNumeric = { id: 'mem-num', roomId, userId: 12345, role: 'EDITOR' };
      const activeUsersWithString = [
        { clientId: 201, userId: '12345', isCurrentUser: false },
      ];
      expect(checkMemberOnline(memberNumeric, activeUsersWithString, 'other-user')).toBe(true);

      // Member has string userId, awareness has numeric userId
      const memberString = { id: 'mem-str', roomId, userId: '99999', role: 'VIEWER' };
      const activeUsersWithNumber = [
        { clientId: 202, userId: 99999, isCurrentUser: false },
      ];
      expect(checkMemberOnline(memberString, activeUsersWithNumber, 'other-user')).toBe(true);

      // Member user.id nested field matching
      const memberNested = {
        id: 'mem-nested',
        roomId,
        userId: 'user-nested-id',
        user: { id: 'user-nested-id', name: 'Nested User', email: 'nested@test.com' },
      };
      const activeNested = [
        { clientId: 203, userId: 'user-nested-id', isCurrentUser: false },
      ];
      expect(checkMemberOnline(memberNested, activeNested, 'other-user')).toBe(true);
    });

    it('should remain online when a user has multiple tabs open and one disconnects, and turn grey when all disconnect', () => {
      const doc = new WSSharedDoc(shortId, roomId);
      docs.set(shortId, doc);

      const targetMember = { id: 'mem-2', roomId, userId: editorId, role: 'EDITOR' };

      // User has 2 tabs open (clientId 301 and clientId 302)
      let activeUsers = [
        { clientId: 101, userId: ownerId, isCurrentUser: true },
        { clientId: 301, userId: editorId, isCurrentUser: false },
        { clientId: 302, userId: editorId, isCurrentUser: false },
      ];

      // Initially online with 2 tabs
      expect(checkMemberOnline(targetMember, activeUsers, ownerId)).toBe(true);

      // User closes Tab 1 (clientId 301 disconnected)
      activeUsers = activeUsers.filter((u) => u.clientId !== 301);
      // User must STILL be online because Tab 2 (clientId 302) is still open
      expect(checkMemberOnline(targetMember, activeUsers, ownerId)).toBe(true);

      // User closes Tab 2 (clientId 302 disconnected)
      activeUsers = activeUsers.filter((u) => u.clientId !== 302);
      // User must now be OFFLINE (grey dot)
      expect(checkMemberOnline(targetMember, activeUsers, ownerId)).toBe(false);

      docs.delete(shortId);
    });

    it('should track multi-tab and disconnects natively in Yjs Awareness protocol', () => {
      const doc = new WSSharedDoc(shortId, roomId);
      docs.set(shortId, doc);

      // Two tabs with separate client Y.Docs and Awareness instances
      const tab1Doc = new Y.Doc();
      const tab1Awareness = new awarenessProtocol.Awareness(tab1Doc);
      tab1Awareness.setLocalState({ user: { userId: editorId, name: 'Editor Tab 1' } });

      const tab2Doc = new Y.Doc();
      const tab2Awareness = new awarenessProtocol.Awareness(tab2Doc);
      tab2Awareness.setLocalState({ user: { userId: editorId, name: 'Editor Tab 2' } });

      const tab1ClientId = tab1Awareness.clientID;
      const tab2ClientId = tab2Awareness.clientID;

      // Apply updates from both tabs to doc.awareness
      const update1 = awarenessProtocol.encodeAwarenessUpdate(tab1Awareness, [tab1ClientId]);
      awarenessProtocol.applyAwarenessUpdate(doc.awareness, update1, null);

      const update2 = awarenessProtocol.encodeAwarenessUpdate(tab2Awareness, [tab2ClientId]);
      awarenessProtocol.applyAwarenessUpdate(doc.awareness, update2, null);

      const extractActiveUsers = () => {
        const active: Array<{ clientId: number; userId?: string }> = [];
        doc.awareness.getStates().forEach((state: any, clientId: number) => {
          if (state?.user?.userId) {
            active.push({ clientId, userId: state.user.userId });
          }
        });
        return active;
      };

      // Both tabs are active
      let active = extractActiveUsers();
      expect(active.length).toBe(2);
      expect(checkMemberOnline({ userId: editorId }, active, ownerId)).toBe(true);

      // Disconnect Tab 1
      awarenessProtocol.removeAwarenessStates(doc.awareness, [tab1ClientId], null);
      active = extractActiveUsers();
      expect(active.length).toBe(1);
      expect(active[0].clientId).toBe(tab2ClientId);
      expect(checkMemberOnline({ userId: editorId }, active, ownerId)).toBe(true);

      // Disconnect Tab 2
      awarenessProtocol.removeAwarenessStates(doc.awareness, [tab2ClientId], null);
      active = extractActiveUsers();
      expect(active.length).toBe(0);
      expect(checkMemberOnline({ userId: editorId }, active, ownerId)).toBe(false);

      tab1Awareness.destroy();
      tab2Awareness.destroy();
      tab1Doc.destroy();
      tab2Doc.destroy();
      docs.delete(shortId);
    });
  });
});
