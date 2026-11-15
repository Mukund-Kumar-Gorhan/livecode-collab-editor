# Real-Time Collaborative Code Editor (LiveCode)

An advanced real-time collaborative code editor monorepo (mini VS Code Live Share / Replit) engineered with modern full-stack web technologies and sandboxed multi-language code execution.

---

## 1. Project Overview

- **Monorepo Architecture**: Clean separation of concerns with npm workspaces (`client`, `server`, `runner`).
- **Real-Time Collaboration**: Built for Yjs CRDT-based multi-user synchronization with cursor awareness.
- **Sandboxed Code Execution**: Dedicated runner service invoking security-hardened Docker containers with strict resource and network isolation.
- **Enterprise-Grade Stack**: Node.js, Express, React, TypeScript, Monaco Editor, Tailwind CSS, PostgreSQL 16 (via Prisma ORM), and Redis 7.

---

## 2. ASCII Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              CLIENT BROWSER                             |
|    React 18 + Vite + Monaco Editor (@monaco-editor/react) + Tailwind    |
|                 Yjs CRDT Document + Monaco Binding                      |
+---------------------+-------------------------------+-------------------+
                      | HTTP (REST)                   | WebSocket (ws)
                      v                               v
+-------------------------------------------------------------------------+
|                               SERVER POD                                |
|             Node.js + Express + TypeScript + Prisma ORM                 |
|   - REST API (/health, /api/auth, /api/rooms)                           |
|   - WebSocket Gateway (/ws - connection lifecycle & sync)               |
+---------------------+-------------------------------+-------------------+
                      |                               |
                      v                               v
       +------------------------------+  +-------------------------------+
       |        PostgreSQL 16         |  |            Redis 7            |
       |  - Users, Rooms, Members     |  |  - Pub/Sub Room Messaging     |
       |  - Snapshots, ExecutionLogs  |  |  - Presence & Ephemeral State |
       +------------------------------+  +---------------+---------------+
                                                         |
                                                         | Job Dispatch
                                                         v
+-------------------------------------------------------------------------+
|                             RUNNER SERVICE                              |
|           Node.js + Express (POST /execute) + Concurrency Queue         |
|   - Security Constraints: --network=none --memory=128m --cpus=0.5       |
|     --pids-limit=64 --timeout=5s --user sandbox                         |
+------------------------------------+------------------------------------+
                                     |
                                     v
                   +-----------------------------------+
                   |     EPHEMERAL DOCKER SANDBOX      |
                   |  Python 3.11 | Node 20 | Java 17  |
                   |               C++ (g++)           |
                   +-----------------------------------+
```

---

## 3. Directory Structure

```
collab-editor/
├── client/                     # Vite + React + Monaco Editor + Tailwind
│   └── src/
│       ├── components/         # CodeEditor, EditorHeader
│       ├── pages/              # RoomPage
│       ├── hooks/              # useSocket
│       ├── services/           # api client
│       ├── store/              # editorStore
│       └── types/              # TypeScript definitions
├── server/                     # Express REST & WebSocket API
│   ├── src/
│   │   ├── config/             # dotenv config loader
│   │   ├── controllers/        # auth & room controllers
│   │   ├── middleware/         # centralized error handling
│   │   ├── routes/             # auth & room routes
│   │   ├── services/           # room & snapshot service
│   │   ├── sockets/            # WebSocket connection handler
│   │   └── utils/              # logger
│   └── prisma/schema.prisma    # PostgreSQL Schema
├── runner/                     # Code Execution Engine
│   └── src/
│       ├── executor/           # Docker sandboxing engine (stub)
│       ├── queue/              # In-memory / Redis queue
│       └── languages/          # Language run configurations
├── docker/
│   └── sandbox/                # Minimal sandbox Dockerfiles (non-root)
│       ├── python.Dockerfile
│       ├── node.Dockerfile
│       ├── java.Dockerfile
│       └── cpp.Dockerfile
├── docs/
│   └── architecture.md         # System Architecture & Specs
├── docker-compose.yml          # PostgreSQL 16 & Redis 7
├── .env.example                # Environment variables template
├── .gitignore
├── .editorconfig
└── README.md
```

---

## 4. Setup & Running Instructions

### Prerequisites
- Node.js >= 18 (Recommended Node 20 or 22)
- npm >= 9
- Docker & Docker Compose

### Step 1: Clone and Configure Environment
```bash
cd collab-editor
cp .env.example .env
```

### Step 2: Spin Up Infrastructure (PostgreSQL 16 & Redis 7)
```bash
# Start PostgreSQL & Redis in background
npm run docker:up

# Verify running containers
docker ps
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Run Prisma Setup (Database Migration)
```bash
# Generate Prisma Client
npm run prisma:generate --workspace=server

# Push schema to PostgreSQL (when Docker is running)
# npm run prisma:migrate --workspace=server
```

### Step 5: Start All Services Concurrently
```bash
npm run dev
```

This single command boots all 3 subsystems simultaneously:
- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:5000` (Health: `/health`, WS: `/ws`)
- **Runner**: `http://localhost:4000` (Health: `/health`, Execute: `/execute`)

Or run each service individually:
```bash
# Client only
npm run dev:client

# Server only
npm run dev:server

# Runner only
npm run dev:runner
```

---

## 5. Feature Roadmap Checklist

- [x] **Monorepo Scaffolding & Workspaces** (Client, Server, Runner)
- [x] **Database Schema & ORM** (User, Room, RoomMember, Snapshot, ExecutionLog via Prisma)
- [x] **Container Infrastructure** (Postgres 16, Redis 7 with healthchecks)
- [x] **Minimal Working Sandbox Dockerfiles** (Python, Node, Java, C++ with non-root user)
- [x] **Interactive Frontend Skeleton** (Monaco Editor, Language Switcher, Styled Run Button)
- [ ] **Authentication System** (JWT access/refresh tokens, bcrypt password hashing, auth middleware)
- [ ] **Room & Workspace Management** (Room CRUD, invitation links, role RBAC: OWNER/EDITOR/VIEWER)
- [ ] **Yjs Real-Time CRDT Synchronization** (y-websocket provider, Monaco cursor awareness, shared buffers)
- [ ] **Redis Multi-Pod Scaling** (Redis Pub/Sub adapter for horizontal WebSocket scaling)
- [ ] **Docker Sandbox Production Execution** (dockerode integration, cgroup limits, tmpfs mounting)
- [ ] **In-Editor Chat & User Presence** (Side panel chat, live cursor name tags, active peer avatars)
- [ ] **Version History & Time-Travel** (Snapshot diff viewer, restore previous snapshot)
- [ ] **Automated Testing Suite** (Unit tests with Vitest, E2E collaboration tests with Playwright)
- [ ] **CI/CD Pipeline** (GitHub Actions for linting, type-check, automated tests, Docker image builds)

