# System Architecture: Real-Time Collaborative Code Editor

This document details the high-level architecture, subsystem boundaries, data flow, and security execution model for the Real-Time Collaborative Code Editor (LiveCode).

---

## 1. High-Level Subsystems

```
                                  +-----------------------+
                                  |   Web Browser Client  |
                                  | (React + Monaco + Yjs)|
                                  +-----------+-----------+
                                              |
                   +--------------------------+--------------------------+
                   | HTTP (REST)                                         | WebSocket (CRDT Sync)
                   v                                                     v
        +---------------------+                               +---------------------+
        |   API / Web Server  |                               |   WebSocket Server  |
        |  (Express + Prisma) |                               |     (ws / Y-ws)     |
        +----------+----------+                               +----------+----------+
                   |                                                     |
                   |                                                     | Pub/Sub & Awareness
                   +--------------------------+--------------------------+
                                              |
                   +--------------------------+--------------------------+
                   |                                                     |
                   v                                                     v
        +---------------------+                               +---------------------+
        |    PostgreSQL 16    |                               |       Redis 7       |
        |   (Users, Rooms,    |                               |  (Presence, Room    |
        |  Members, History)  |                               |   Pub/Sub, Queue)   |
        +---------------------+                               +----------+----------+
                                                                         |
                                                                         | Job Dispatch
                                                                         v
                                                              +---------------------+
                                                              |   Runner Service    |
                                                              |  (Express Sandbox)  |
                                                              +----------+----------+
                                                                         |
                                                                         | Docker CLI / API
                                                                         v
                                                              +---------------------+
                                                              |  Isolated Sandbox   |
                                                              |    Containers       |
                                                              | (Python/Node/Java/C)|
                                                              +---------------------+
```

---

## 2. Collaborative Sync Model (CRDT / Yjs)

1. **Document Representation**: The shared code document is modeled as a Yjs `Y.Text` CRDT type.
2. **Conflict Resolution**: Operations (insertions, deletions) are commutative and mathematically guaranteed to converge across all connected peers without central locking.
3. **Transport Layer**:
   - Clients connect via WebSocket to `/ws`.
   - Rooms are sharded by `roomId`.
   - Redis Pub/Sub broadcasts update vectors across multiple horizontal server instances.
4. **Persistence & Snapshots**:
   - Updates are periodically compressed and saved to PostgreSQL as `Snapshot` records for fast initial document loads.

---

## 3. Sandbox Execution & Security Architecture

When a user triggers code execution:
1. Client requests `POST /execute` (or sends execution request via Server to Runner).
2. The Runner validates payload size and language identifier.
3. An ephemeral Docker container is created from minimal pre-built images with strict sandboxing:
   - **Network**: `--network=none` prevents network egress/SSRF.
   - **Memory**: `--memory=128m` prevents memory exhaustion.
   - **CPU**: `--cpus=0.5` throttles CPU compute consumption.
   - **PID Limit**: `--pids-limit=64` stops fork bombs.
   - **Timeout**: Enforced 5-second kill timer.
   - **Filesystem**: `--read-only` root with restricted `/tmp` tmpfs.
   - **Privilege**: Executed under unprivileged UID `sandbox`.
4. Output (stdout/stderr) and exit codes are captured and returned to the caller.

