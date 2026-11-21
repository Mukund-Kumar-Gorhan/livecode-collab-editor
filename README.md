# LiveCode: Real-Time Collaborative Code Editor

Multiple users ek hi room me ek saath code likhte hain (Google Docs jaisa),
aur code Docker sandbox me safely run hota hai.

![LiveCode](docs/screenshot.png)

## Features

- JWT auth (access + refresh token), Owner / Editor / Viewer roles
- Real-time editing with Yjs (CRDT): live cursors, user names, conflict-free merge
- Docker sandbox execution: Python, JavaScript, Java, C, C++
- Multi-file workspace: file explorer, tabs, folder upload, ZIP download, entry file
- stdin input box, output shared with every user in the room
- 5 themes and an editable profile
- Document persistence in PostgreSQL (code survives restarts)

## Architecture

```
React + Monaco (client)
        |  HTTP + WebSocket
        v
Express + Yjs server  --->  PostgreSQL
        |
        |  (shared secret header)
        v
Runner service  --->  Docker sandbox container (per run)
```

## How it works

1. Every room has one Yjs document. Each file is a shared text inside it.
2. Edits travel over WebSocket and merge automatically (CRDT), so two people
   typing on the same line never lose each other's changes.
3. When someone presses Run, the server reads the code from its own copy of the
   room document (it never trusts code sent by the browser) and asks the runner
   to execute it.
4. The runner starts a fresh Docker container, runs the code, kills it on
   timeout, and returns the output. The result is written into the room
   document, so every user sees it at the same time.

## Security

- Sandbox container: no network, read-only filesystem, 128 MB RAM (Java 384 MB),
  0.5 CPU, limited processes, non-root user, all capabilities dropped,
  5 second run timeout
- Runner accepts requests only with a shared secret header
- Role checks are enforced on the server (a Viewer's edits are rejected on the
  WebSocket, not only disabled in the UI)
- Rate limiting, Zod input validation, path traversal checks on uploads

## Setup

Requirements: Node 20+, Docker Desktop

```bash
npm install
copy .env.example .env        # Windows (use cp on Mac/Linux)
docker compose up -d
npm run sandbox:build
cd server && npx prisma migrate dev && cd ..
npm run dev
```

Open http://localhost:5173 and use `localhost` (not an IP address).

Run tests:

```bash
npx vitest run
```

## Tech Stack

React, TypeScript, Vite, Tailwind CSS, Monaco Editor, Yjs, Node.js, Express,
Prisma, PostgreSQL, Docker, Vitest

## Known limitations

- Docker sandbox is not production-grade isolation; real platforms use gVisor
  or Firecracker
- Program input must be written in the Input box before pressing Run
  (no interactive terminal yet)
- Runs on localhost; not deployed publicly

## Roadmap

- [x] Auth and rooms
- [x] Yjs real-time sync
- [x] Docker sandbox execution
- [x] Multi-file workspace and folder upload
- [x] Themes and profile
- [ ] Members panel (change roles live)
- [ ] Interactive terminal
- [ ] More languages (TypeScript, Go)
- [ ] Redis for horizontal scaling
- [ ] Chat and version history

## Author

Mukund Kumar