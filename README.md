# LiveCode: Real-Time Collaborative Code Editor

Write and run code together in real time. Multiple users edit the same project
at once (like Google Docs), and the code runs safely inside Docker sandboxes.
Includes an admin panel to monitor and manage the platform.

![LiveCode](docs/screenshot.png)

## Features

**Collaboration**
- Real-time editing with Yjs (CRDT): live cursors, user names, conflict-free merge
- Rooms with invite link and Owner / Editor / Viewer roles
- Members panel: the owner can change roles or remove members, and the change
  applies live without a page reload
- Online/offline status for every member
- Code is saved in PostgreSQL, so it survives server restarts

**Workspace**
- Multi-file projects: file explorer, tabs, create / rename / delete
- Folder and file upload (drag and drop), download project as ZIP
- Entry file selection ("Set as entry")
- Monaco editor (the editor behind VS Code)

**Code execution**
- Python, JavaScript, Java, C and C++
- Runs inside an isolated Docker container for every run
- stdin input box (works with `scanf`, `cin`, `input()`, `Scanner`)
- Output is shared with every user in the room

**Admin panel** (`/admin`)
- Separate admin login; only accounts with `isAdmin` can enter
- Overview: total users, rooms, runs today, active now, success rate, usage charts
- Users: search, disable / enable, make or revoke admin, delete
- Rooms and run logs with filters (language, status)
- Login history: who logged in, when, from which IP and device, success or failure
- Audit log of every admin action
- Disabling a user also ends their sessions and closes their live connections

**Accounts and UI**
- JWT auth (access + refresh token), editable profile
- 5 themes: Midnight, Light, Dracula, One Dark, Cyberpunk
- Responsive layout that works on phones

![Admin panel](docs/admin.png)

## Architecture

```
React + Monaco (client, :5173)
        |  HTTP + WebSocket (Vite proxy)
        v
Express + Yjs server (:5000)  --->  PostgreSQL
        |
        |  shared secret header
        v
Runner service (:4000)  --->  Docker sandbox container (one per run)
```

## How it works

1. Every room has one Yjs document. Each file is a shared text inside it.
2. Edits travel over WebSocket and merge automatically (CRDT), so two people
   typing on the same line never lose each other's changes.
3. When someone presses Run, the server reads the code from its own copy of the
   room document (it never trusts code sent by the browser) and asks the runner
   to execute it.
4. The runner starts a fresh Docker container, runs the code, kills it on
   timeout and returns the output. The result is written into the room document,
   so every user sees it at the same time.

## Security

- Sandbox container: no network, read-only filesystem, memory and CPU limits,
  limited process count, non-root user, all capabilities dropped, 5 second run
  timeout (compile steps get a longer limit)
- The runner accepts requests only with a shared secret header
- Roles are enforced on the server: a Viewer's edits are rejected on the
  WebSocket, not only disabled in the UI
- Admin access is decided only by the `isAdmin` flag in the database, checked
  on the server for every admin request. Admin accounts can only be created
  with a command line script, never through the public API
- Disabled accounts cannot log in; their sessions and sockets are closed
- Rate limiting (runs, login, admin login), Zod input validation, path
  traversal checks on uploads and runs
- Optional invite code for registration (`REGISTRATION_CODE`)

## Setup

Requirements: Node.js 20+, Docker Desktop

```bash
# 1. Install dependencies
npm install

# 2. Create environment files
copy .env.example .env          # Windows (use cp on Mac/Linux)
copy .env server\.env           # server reads its own .env too

# 3. Start PostgreSQL and Redis
docker compose up -d

# 4. Build sandbox images (first time only, takes a few minutes)
npm run sandbox:build

# 5. Create database tables
cd server
npx prisma migrate dev
cd ..

# 6. Start client, server and runner
npm run dev
```

Open http://localhost:5173 (use `localhost`, not an IP address).

`RUNNER_SECRET` must be the same in every `.env` file. Change `JWT_SECRET` and
`RUNNER_SECRET` from their default values before sharing the app with anyone.

Run the tests:

```bash
npx vitest run
```

## Create an admin account

Admins are created only from the command line:

```bash
npm run make-admin -- admin@example.com YourStrongPassword
```

Then open http://localhost:5173/admin and sign in. Use a strong password and do
not reuse the example above.

## Share publicly with Cloudflare Tunnel

The app runs on your own machine. A quick tunnel gives it a temporary public
https link, which is enough for a demo.

1. Install cloudflared: `winget install Cloudflare.cloudflared`
2. Start the app (`docker compose up -d` and `npm run dev`)
3. In a new terminal run:

```bash
cloudflared tunnel --url http://localhost:5173
```

4. Open the `https://....trycloudflare.com` link it prints. Everyone should use
   this same link.

Notes:
- Only port 5173 is tunnelled. The runner (4000) and database (5432) stay private.
- The link changes every time and stops when you close the tunnel (`Ctrl + C`).
- The admin login page is reachable through the tunnel as well. Use a strong
  admin password, or close the tunnel while you do admin work.
- Anyone with the link can run code on your machine. Set `REGISTRATION_CODE`
  in `.env` and share the link only with people you trust.

## Project structure

```
client/     React + TypeScript + Vite + Tailwind + Monaco
server/     Express, Yjs WebSocket server, Prisma, auth, rooms, admin API
runner/     Code execution service (Docker)
docker/     Sandbox Dockerfiles for each language
docs/       Architecture notes and screenshots
```

## Tech stack

React, TypeScript, Vite, Tailwind CSS, Monaco Editor, Yjs, Node.js, Express,
Prisma, PostgreSQL, Docker, Vitest

## Known limitations

- Docker is not production-grade isolation for untrusted code; real platforms
  use gVisor or Firecracker
- Program input must be written in the Input box before pressing Run
  (there is no interactive terminal yet)
- C files are currently compiled with the C++ toolchain (g++)
- Refresh tokens are stored in the database as plain text; a production
  version should store only a hash
- Runs from a single machine, not deployed to a cloud server

## Roadmap

- [x] Auth, rooms and roles
- [x] Yjs real-time sync
- [x] Docker sandbox execution
- [x] Multi-file workspace, folder upload, ZIP download
- [x] stdin input and multi-file runs
- [x] Themes, profile and mobile layout
- [x] Members panel with live role changes
- [x] Public sharing via Cloudflare Tunnel
- [x] Admin panel with login history and audit log
- [ ] Interactive terminal
- [ ] Native gcc for C, more languages (TypeScript, Go)
- [ ] Redis for horizontal scaling
- [ ] Chat and version history

## Author

Mukund Kumar
