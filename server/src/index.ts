import http from 'http';
import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { setupSockets } from './sockets/index.js';

// Create HTTP server and bind WebSocket handler
const httpServer = http.createServer(app);
setupSockets(httpServer);

// Start server
httpServer.listen(config.port, config.host, () => {
  logger.info(`Server listening on http://${config.host}:${config.port}`);
  logger.info(`Health check available at http://${config.host}:${config.port}/health`);
  logger.info(`WebSocket endpoint at ws://${config.host}:${config.port}/ws`);
});
