import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { STARTER_CODE } from '../utils/starterCode.js';

export const messageSync = 0;
export const messageAwareness = 1;
export const messageAuth = 2;

export interface ConnectionMeta {
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  controlledIds: Set<number>;
}

export class WSSharedDoc extends Y.Doc {
  name: string; // shortId
  roomId: string;
  conns: Map<WebSocket, ConnectionMeta> = new Map();
  awareness: awarenessProtocol.Awareness;
  saveTimeout: NodeJS.Timeout | null = null;
  initialized: boolean = false;
  initPromise: Promise<void> | null = null;

  constructor(name: string, roomId: string) {
    super({ gc: true });
    this.name = name;
    this.roomId = roomId;
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    // Broadcast awareness updates
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, originConn: WebSocket | null) => {
      const changedClients = added.concat(updated, removed);
      if (originConn) {
        const meta = this.conns.get(originConn);
        if (meta) {
          added.forEach((id) => meta.controlledIds.add(id));
          removed.forEach((id) => meta.controlledIds.delete(id));
        }
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const buff = encoding.toUint8Array(encoder);

      this.conns.forEach((_, conn) => {
        send(this, conn, buff);
      });
    });

    // Broadcast document updates to all connected clients
    this.on('update', (update: Uint8Array) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      this.conns.forEach((_, conn) => {
        send(this, conn, message);
      });

      // Schedule debounced snapshot persistence (~5s)
      this.scheduleSave();
    });

    // Track metadata changes (e.g. language sync to Room table)
    const metadata = this.getMap('metadata');
    metadata.observe((event) => {
      if (event.keysChanged.has('language')) {
        const newLang = metadata.get('language') as string;
        if (newLang) {
          try {
            const updatePromise = prisma.room.update({
              where: { id: this.roomId },
              data: { language: newLang },
            });
            if (updatePromise && typeof updatePromise.catch === 'function') {
              updatePromise.catch((err) => {
                logger.error(`Failed to update room language for ${this.name}:`, err);
              });
            }
          } catch (err) {
            logger.error(`Failed to dispatch room language update for ${this.name}:`, err);
          }
        }
      }
    });
  }

  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(async () => {
      await saveSnapshot(this);
    }, 5000);
  }
}

// Active documents map: shortId -> WSSharedDoc
export const docs = new Map<string, WSSharedDoc>();

/**
 * Persists document state as base64 encoded binary update in Postgres Snapshot table.
 */
export const saveSnapshot = async (doc: WSSharedDoc): Promise<void> => {
  try {
    const update = Y.encodeStateAsUpdate(doc);
    const base64Content = Buffer.from(update).toString('base64');

    await prisma.snapshot.create({
      data: {
        roomId: doc.roomId,
        content: base64Content,
      },
    });

    logger.info(`Snapshot persisted for room ${doc.name} (${update.byteLength} bytes)`);
  } catch (error) {
    logger.error(`Error saving snapshot for room ${doc.name}:`, error);
  }
};

export const getDefaultFileName = (language: string): string => {
  switch (language?.toLowerCase()) {
    case 'python':
      return 'main.py';
    case 'javascript':
      return 'index.js';
    case 'java':
      return 'Main.java';
    case 'cpp':
      return 'main.cpp';
    default:
      return 'main.py';
  }
};

/**
 * Ensures a document has the multi-file structure.
 * Migrates legacy single-file rooms if files map is empty.
 */
export const ensureMultiFileStructure = (
  doc: WSSharedDoc,
  initialLanguage: string = 'python'
): void => {
  const filesMap = doc.getMap('files');
  if (filesMap.size === 0) {
    const oldText = doc.getText('monaco');
    const lang = (doc.getMap('metadata').get('language') as string) || initialLanguage || 'python';
    const defaultFileName = getDefaultFileName(lang);

    if (oldText.length > 0) {
      // Migrate legacy single-file room
      const fileText = new Y.Text();
      fileText.insert(0, oldText.toString());
      filesMap.set(defaultFileName, fileText);
      logger.info(`Migrated legacy monaco single-file content to files["${defaultFileName}"] for room ${doc.name}`);
    } else {
      // Fresh room: create starter file
      const starterText = STARTER_CODE[lang] || STARTER_CODE.python;
      const fileText = new Y.Text();
      fileText.insert(0, starterText);
      filesMap.set(defaultFileName, fileText);
      oldText.insert(0, starterText); // legacy fallback
      logger.info(`Initialized fresh multi-file Y.Doc with ${defaultFileName} (${lang}) for room ${doc.name}`);
    }

    const ymeta = doc.getMap('metadata');
    if (!ymeta.get('language')) {
      ymeta.set('language', lang);
    }
  }
};

/**
 * Retrieves existing or initializes a new WSSharedDoc for a room.
 * Ensures default starter code is inserted exactly once when room is first loaded.
 */
export const getOrCreateDoc = async (
  shortId: string,
  room: { id: string; language: string }
): Promise<WSSharedDoc> => {
  let doc = docs.get(shortId);
  if (doc) {
    if (doc.initPromise) {
      await doc.initPromise;
    }
    return doc;
  }

  doc = new WSSharedDoc(shortId, room.id);
  docs.set(shortId, doc);

  doc.initPromise = (async () => {
    try {
      const latestSnapshot = await prisma.snapshot.findFirst({
        where: { roomId: room.id },
        orderBy: { createdAt: 'desc' },
      });

      if (latestSnapshot && latestSnapshot.content) {
        try {
          const buffer = Buffer.from(latestSnapshot.content, 'base64');
          Y.applyUpdate(doc, new Uint8Array(buffer));
          logger.info(`Restored snapshot for room ${shortId}`);
        } catch (e) {
          logger.warn(`Failed to parse base64 snapshot for room ${shortId}, checking raw text fallback`);
          const ytext = doc.getText('monaco');
          if (ytext.length === 0) {
            ytext.insert(0, latestSnapshot.content);
          }
        }
      }

      // Ensure multi-file workspace files map is populated and migrated if needed
      ensureMultiFileStructure(doc, room.language || 'python');
      doc.initialized = true;
    } catch (err) {
      logger.error(`Error initializing Y.Doc for room ${shortId}:`, err);
    }
  })();

  await doc.initPromise;
  return doc;
};

/**
 * Safely send binary message to a WebSocket connection.
 */
export const send = (doc: WSSharedDoc, conn: WebSocket, message: Uint8Array): void => {
  if (conn.readyState !== WebSocket.CONNECTING && conn.readyState !== WebSocket.OPEN) {
    closeConn(doc, conn);
    return;
  }
  try {
    conn.send(message, { binary: true }, (err) => {
      if (err) {
        closeConn(doc, conn);
      }
    });
  } catch {
    closeConn(doc, conn);
  }
};

/**
 * Handles incoming WebSocket message from client with role enforcement.
 */
export const handleMessage = (
  conn: WebSocket,
  doc: WSSharedDoc,
  message: Uint8Array
): void => {
  const meta = doc.conns.get(conn);
  if (!meta) return;

  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync: {
        encoding.writeVarUint(encoder, messageSync);
        const syncMessageType = decoding.readVarUint(decoder);

        if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
          // Both viewers and editors can read initial sync step
          syncProtocol.readSyncStep1(decoder, encoder, doc);
          if (encoding.length(encoder) > 1) {
            send(doc, conn, encoding.toUint8Array(encoder));
          }
        } else if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
          if (meta.role === 'VIEWER') {
            logger.warn(`VIEWER ${meta.userId} attempted SyncStep2 write in room ${doc.name}. Ignored.`);
          } else {
            syncProtocol.readSyncStep2(decoder, doc, conn);
          }
        } else if (syncMessageType === syncProtocol.messageYjsUpdate) {
          if (meta.role === 'VIEWER') {
            logger.warn(`VIEWER ${meta.userId} attempted document update in room ${doc.name}. Ignored.`);
          } else {
            syncProtocol.readUpdate(decoder, doc, conn);
          }
        }
        break;
      }

      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn
        );
        break;
      }

      default:
        logger.debug(`Unhandled collab message type: ${messageType}`);
    }
  } catch (err) {
    logger.error(`Error processing collab message in room ${doc.name}:`, err);
  }
};

/**
 * Cleans up connection and triggers memory cleanup when last client disconnects.
 */
export const closeConn = (doc: WSSharedDoc, conn: WebSocket): void => {
  const meta = doc.conns.get(conn);
  if (meta) {
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      Array.from(meta.controlledIds),
      null
    );

    // If last user disconnected, persist final state and destroy Y.Doc for memory cleanup
    if (doc.conns.size === 0) {
      if (doc.saveTimeout) {
        clearTimeout(doc.saveTimeout);
        doc.saveTimeout = null;
      }

      // Persist state immediately before destroying
      saveSnapshot(doc)
        .catch((err) => logger.error(`Failed to save final snapshot on exit:`, err))
        .finally(() => {
          doc.destroy();
          docs.delete(doc.name);
          logger.info(`All clients disconnected. Cleaned up memory for room ${doc.name}`);
        });
    }
  }

  try {
    conn.close();
  } catch {
    // Ignore close error if already closed
  }
};

/**
 * Sets up a y-websocket compatible connection with authentication and role awareness.
 */
export const setupCollabConnection = (
  conn: WebSocket,
  doc: WSSharedDoc,
  meta: { userId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' }
): void => {
  conn.binaryType = 'arraybuffer';
  doc.conns.set(conn, {
    userId: meta.userId,
    role: meta.role,
    controlledIds: new Set<number>(),
  });

  conn.on('message', (data: ArrayBuffer | Buffer) => {
    const uint8 = new Uint8Array(data as ArrayBuffer);
    handleMessage(conn, doc, uint8);
  });

  // Heartbeat ping-pong to detect dead connections
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch {
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, 30000);

  conn.on('pong', () => {
    pongReceived = true;
  });

  conn.on('close', () => {
    clearInterval(pingInterval);
    closeConn(doc, conn);
  });

  conn.on('error', (err) => {
    logger.error(`WebSocket error in room ${doc.name}:`, err);
    clearInterval(pingInterval);
    closeConn(doc, conn);
  });

  // Initial Sync Step 1: Send server state vector to client
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(doc, conn, encoding.toUint8Array(encoder));

  // Send current awareness states to client
  const awarenessStates = doc.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        doc.awareness,
        Array.from(awarenessStates.keys())
      )
    );
    send(doc, conn, encoding.toUint8Array(awarenessEncoder));
  }

  logger.info(`User ${meta.userId} (${meta.role}) connected to room ${doc.name}. Total clients: ${doc.conns.size}`);
};

/**
 * Updates a member's role in active Y.Doc connection metadata and broadcasts change via roles map.
 */
export const updateMemberRoleInCollab = (
  shortId: string,
  userId: string,
  newRole: 'OWNER' | 'EDITOR' | 'VIEWER'
): void => {
  const doc = docs.get(shortId);
  if (!doc) return;

  // 1. Update live socket connection meta role
  doc.conns.forEach((meta) => {
    if (meta.userId === userId) {
      meta.role = newRole;
    }
  });

  // 2. Broadcast role change via Y.Doc Y.Map("roles")
  doc.getMap('roles').set(userId, newRole);
  logger.info(`Updated collab live role for user ${userId} in room ${shortId} to ${newRole}`);
};

/**
 * Kicks a member from active Y.Doc session: broadcasts 'KICKED' and immediately closes connection.
 */
export const kickMemberFromCollab = (shortId: string, userId: string): void => {
  const doc = docs.get(shortId);
  if (!doc) return;

  // Broadcast kicked status so connected client reacts immediately
  doc.getMap('roles').set(userId, 'KICKED');

  // Close live socket connections for this user
  doc.conns.forEach((meta, conn) => {
    if (meta.userId === userId) {
      closeConn(doc, conn);
    }
  });
  logger.info(`Kicked user ${userId} from live collab room ${shortId}`);
};

/**
 * Closes all live WebSocket connections across all rooms for a disabled user.
 */
export const kickUserFromAllCollab = (userId: string): void => {
  docs.forEach((doc, shortId) => {
    let closedCount = 0;
    doc.conns.forEach((meta, conn) => {
      if (meta.userId === userId) {
        doc.getMap('roles').set(userId, 'KICKED');
        closeConn(doc, conn);
        closedCount++;
      }
    });
    if (closedCount > 0) {
      logger.info(`Terminated ${closedCount} active connection(s) for disabled user ${userId} in room ${shortId}`);
    }
  });
};
