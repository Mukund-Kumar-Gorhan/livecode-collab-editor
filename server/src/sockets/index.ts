import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { getOrCreateDoc, setupCollabConnection } from './collab.js';

export interface SocketsSetup {
  collabWss: WebSocketServer;
  defaultWss: WebSocketServer;
}

/**
 * Initializes WebSocket servers on the existing HTTP server.
 * Handles:
 * 1. /collab/:shortId -> Yjs collaborative code editing with JWT auth and role enforcement.
 * 2. /ws -> General utility / heartbeat socket.
 */
export const setupSockets = (server: HttpServer): SocketsSetup => {
  const collabWss = new WebSocketServer({ noServer: true });
  const defaultWss = new WebSocketServer({ noServer: true });

  // Handle standard /ws connections
  defaultWss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    logger.info(`WebSocket client connected from ${clientIp}`);

    ws.send(
      JSON.stringify({
        type: 'SYSTEM_EVENT',
        event: 'CONNECTED',
        message: 'Connected to Collaborative Code Editor WebSocket Server',
        timestamp: new Date().toISOString(),
      })
    );

    ws.on('message', (data) => {
      try {
        const message = data.toString();
        if (message === 'ping') {
          ws.send('pong');
        }
      } catch (err) {
        logger.error('Failed to parse WebSocket message:', err);
      }
    });

    ws.on('close', (code, reason) => {
      logger.info(`WebSocket client disconnected (code: ${code}, reason: "${reason.toString()}")`);
    });
  });

  // Intercept HTTP upgrade requests
  server.on('upgrade', async (req, socket, head) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // Check for /collab/:shortId
      const collabMatch = pathname.match(/^\/collab\/([^/?]+)$/);
      if (collabMatch) {
        const shortId = collabMatch[1];
        const token = url.searchParams.get('token');

        if (!token) {
          logger.warn(`Collab connection rejected for room ${shortId}: Missing auth token`);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        let payload: TokenPayload;
        try {
          payload = verifyAccessToken(token);
        } catch {
          logger.warn(`Collab connection rejected for room ${shortId}: Invalid or expired token`);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Verify room existence and user membership
        const room = await prisma.room.findUnique({
          where: { shortId },
          include: { members: true },
        });

        if (!room) {
          logger.warn(`Collab connection rejected: Room ${shortId} not found`);
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        let role: 'OWNER' | 'EDITOR' | 'VIEWER' | null = null;
        if (room.ownerId === payload.userId) {
          role = 'OWNER';
        } else {
          const member = room.members.find((m) => m.userId === payload.userId);
          if (member) {
            role = member.role as 'OWNER' | 'EDITOR' | 'VIEWER';
          }
        }

        if (!role) {
          logger.warn(`Collab connection rejected: User ${payload.userId} is not a member of room ${shortId}`);
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        collabWss.handleUpgrade(req, socket, head, async (ws) => {
          try {
            const doc = await getOrCreateDoc(shortId, room);
            setupCollabConnection(ws, doc, { userId: payload.userId, role: role! });
          } catch (err) {
            logger.error(`Error completing collab upgrade for room ${shortId}:`, err);
            ws.close(1011, 'Internal server error');
          }
        });
        return;
      }

      // Check for /ws
      if (pathname === '/ws') {
        defaultWss.handleUpgrade(req, socket, head, (ws) => {
          defaultWss.emit('connection', ws, req);
        });
        return;
      }

      // Not found
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    } catch (err) {
      logger.error('Error during WebSocket upgrade:', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  logger.info('Collab WebSocket Server registered on path /collab/:shortId');
  logger.info('Default WebSocket Server registered on path /ws');

  return { collabWss, defaultWss };
};
