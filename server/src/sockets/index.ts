import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

export interface SocketsSetup {
  wss: WebSocketServer;
}

/**
 * Initializes the WebSocket server for real-time collaboration.
 * Currently handles basic connection lifecycle events (connect, ping, disconnect).
 * Future: Hooked to y-websocket provider or Redis pub/sub for multi-pod sync.
 */
export const setupSockets = (server: HttpServer): SocketsSetup => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    logger.info(`WebSocket client connected from ${clientIp}`);

    // Send welcome payload
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
        logger.debug(`Received WS message: ${message}`);

        // Simple ping-pong echo for heartbeat testing
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

    ws.on('error', (error) => {
      logger.error('WebSocket connection error:', error);
    });
  });

  logger.info('WebSocket Server registered on path /ws');

  return { wss };
};

