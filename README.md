# Parley

> A classic self-hosted web chat server -- rooms, direct messages, file sharing, and moderation.

Parley is a web-based chat application supporting public and private rooms, one-to-one direct messaging, contacts and friend lists, file and image sharing, moderation tools, and persistent message history. It is designed to be **self-hosted** and **easy to deploy** -- one `docker compose up` and you have your own chat server running.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Local Development](#local-development)
- [API Reference](#api-reference)
- [Capacity and Performance](#capacity-and-performance)

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### Run

```bash
git clone <repo-url>
cd parley
docker compose up
```

That's it. Open **http://localhost:8080** in your browser. No external services, no manual database setup, no configuration needed.

The first `docker compose up` will:
1. Pull PostgreSQL 16 and Mailpit images
2. Build the server (NestJS) and client (React + nginx) images
3. Start all 4 services
4. Run database migrations automatically
5. Serve the app on port 8080

### Stop

```bash
docker compose down
```

To also remove persistent data (database + uploaded files):

```bash
docker compose down -v
```

### Available Services

| Service | URL | Description |
|---------|-----|-------------|
| App | http://localhost:8080 | Main application |
| Mail UI | http://localhost:8025 | Mailpit -- catches all outgoing emails (password resets) |

---

## Features

### Accounts and Sessions
- Self-registration with email, username, and password
- Persistent login across browser restarts (httpOnly refresh cookie)
- Multi-session support -- view and revoke active sessions individually
- Secure password hashing (bcrypt), password reset via email, password change
- Self-service account deletion (cascades owned rooms and data)

### Messaging
- Public and private chat rooms
- One-to-one personal / direct messaging
- Message replies with visual quoting
- Message editing (with "edited" indicator) and deletion
- UTF-8 multiline text, up to 3 KB per message
- Full message history with infinite scroll (cursor-based pagination)
- Messages to offline users are persisted and delivered on reconnect

### Attachments
- Upload files (up to 20 MB) and images (up to 3 MB) via button or copy-paste
- Original filename preserved, optional comment per attachment
- Access scoped to current room members only
- Inline image preview in messages, file download links

### Contacts and Friends
- Personal friend list with presence indicators
- Send friend requests by username (with optional message)
- Accept, decline, or cancel requests
- Remove friends
- User-to-user ban (blocks DMs; existing history becomes read-only; auto-removes friendship)

### Moderation
- Room owner + admins model
- Admins can delete messages, remove/ban members, manage the ban list
- Owner can promote/demote admins, delete the room
- Removing a user from a room counts as a ban (cannot rejoin until unbanned)
- Room capacity enforced at 1000 members

### Presence
- Online / AFK / Offline statuses
- Multi-tab aware -- AFK only triggers when all tabs are idle for >1 minute
- Low-latency presence updates via WebSocket

### Notifications
- Unread message badges on rooms and DMs in the sidebar
- Cleared when the chat is opened

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Node.js + NestJS (TypeScript) | Node 20, NestJS 11 |
| **Database** | PostgreSQL | 16 |
| **ORM** | Prisma | 6 |
| **Auth** | JWT (access + refresh tokens) + bcrypt | |
| **Real-time** | Socket.IO (via NestJS WebSocket Gateway) | |
| **Email** | Nodemailer (Mailpit in dev) | |
| **Frontend** | React + Vite (TypeScript) | React 19, Vite 8 |
| **State** | Zustand | 5 |
| **Styling** | Tailwind CSS | 4 |
| **Routing** | React Router | 7 |
| **Containerization** | Docker + Docker Compose | |
| **Web Server** | nginx (SPA + reverse proxy) | alpine |

---

## Project Structure

```
parley/
  client/                          # Frontend (React SPA)
    src/
      components/                  # UI components
        AttachmentView.tsx         #   File/image attachment display
        AuthCard.tsx               #   Auth page layout wrapper
        ContactsPanel.tsx          #   Friends list, requests, add friend
        CreateRoomModal.tsx        #   Create room form
        Logo.tsx                   #   Logo mark + wordmark
        ManageRoomModal.tsx        #   Room management (members, admins, bans, settings)
        MemberPanel.tsx            #   Right-side member list with presence
        MessageInput.tsx           #   Message composer (text, reply, edit, attach)
        MessageList.tsx            #   Scrollable message feed with infinite scroll
        Modal.tsx                  #   Reusable modal / drawer
        ProfileModal.tsx           #   Password change, sessions, blocked users, delete account
        ProtectedRoute.tsx         #   Auth route guards
        PublicRoomsModal.tsx       #   Browse + join public rooms
        RoomSidebar.tsx            #   Left sidebar (rooms, DMs, unread badges)
        ThemeToggle.tsx            #   Dark/light mode switch
      lib/                         # API client functions
        api.ts                     #   Fetch wrapper with auto token refresh
        attachments.ts             #   Upload/download API
        auth.ts                    #   Login, register, logout, bootstrap
        friends.ts                 #   Friend requests, bans
        personal-chats.ts          #   DM conversation API
        profile.ts                 #   Password, sessions management
        rooms.ts                   #   Room CRUD, membership, moderation
        send-message.ts            #   Message sending helper
        socket.ts                  #   Socket.IO client + activity tracking
      pages/                       # Route-level components
        ChatPage.tsx               #   Main chat interface
        ForgotPasswordPage.tsx     #   Password reset request
        LoginPage.tsx              #   Sign in
        RegisterPage.tsx           #   Create account
        ResetPasswordPage.tsx      #   Set new password (from email link)
      store/                       # Zustand state stores
        auth.ts                    #   User session + token
        pending.ts                 #   Pending attachment uploads
        presence.ts                #   Online/AFK/offline statuses, unread counts
        rooms.ts                   #   Room list + selected room
        theme.ts                   #   Dark/light theme preference
      App.tsx                      # Router configuration
      main.tsx                     # React entry point
      index.css                    # Tailwind + design system tokens
    nginx.conf                     # SPA routing + API/WS proxy config
    Dockerfile                     # Multi-stage: build -> nginx

  server/                          # Backend (NestJS)
    src/
      attachments/                 # File upload/download module
        attachments.controller.ts  #   POST /upload, GET /:id/download
        attachments.module.ts
        attachments.service.ts     #   Disk storage, access control
      auth/                        # Authentication module
        auth.controller.ts         #   Register, login, refresh, password reset
        auth.module.ts
        auth.service.ts            #   JWT issuance, token rotation, bcrypt
        decorators/
          current-user.decorator.ts #  @CurrentUser() parameter decorator
        dto/
          forgot-password.dto.ts
          login.dto.ts
          register.dto.ts
        guards/
          jwt-auth.guard.ts        #   @UseGuards(JwtAuthGuard)
        strategies/
          jwt.strategy.ts          #   Passport JWT extraction + validation
      chat/                        # WebSocket gateway module
        chat.gateway.ts            #   Socket.IO gateway (messaging + presence events)
        chat.module.ts
        presence.service.ts        #   In-memory presence tracking per socket
      friends/                     # Friend system module
        friends.controller.ts      #   Request, accept, reject, list, remove
        friends.module.ts
        friends.service.ts         #   Friendship logic, ban checks
      health/                      # Health check module
        health.controller.ts       #   GET /api/health
        health.module.ts
      mail/                        # Email module (global)
        mail.module.ts
        mail.service.ts            #   Nodemailer transporter
      messages/                    # Message module
        messages.controller.ts     #   GET history (cursor-based)
        messages.module.ts
        messages.service.ts        #   Send, edit, delete, paginate
      personal-chats/              # Direct message module
        personal-chats.controller.ts  # List DMs, open DM
        personal-chats.module.ts
        personal-chats.service.ts  #   Create personal room, freeze on ban
      prisma/                      # Database module (global)
        prisma.module.ts
        prisma.service.ts          #   PrismaClient lifecycle
      rooms/                       # Room module
        rooms.controller.ts        #   Full room CRUD + moderation endpoints
        rooms.module.ts
        rooms.service.ts           #   Membership, bans, capacity, admin logic
        dto/
          create-room.dto.ts       #   CreateRoomDto, UpdateRoomDto, InviteUserDto
      users/                       # User module
        users.controller.ts        #   Delete account, user-to-user bans
        users.module.ts
        users.service.ts           #   Profile, ban/unban logic
      app.module.ts                # Root module (imports all feature modules)
      main.ts                      # Bootstrap (port, prefix, validation pipe)
    prisma/
      schema.prisma                # Database schema (10 models)
      migrations/                  # Auto-generated SQL migrations
    Dockerfile                     # Multi-stage: build -> production node

  docs/
    architecture.md                # Detailed architecture diagrams and decisions

  docker-compose.yml               # 4-service orchestration
  .env.example                     # Environment variable template
  INSTRUCTIONS.md                  # Original product requirements
  PLAN.MD                          # Implementation plan (9 phases)
```

---

## Architecture

See [`docs/architecture.md`](./docs/architecture.md) for full diagrams covering:
- System overview and Docker service topology
- Backend module dependency graph
- Authentication and JWT refresh flow
- WebSocket event protocol
- Presence state machine
- Frontend component tree and state management
- Database entity relationships
- Complete API endpoint reference
- WebSocket event catalog

### High-Level Overview

```
Browser (React SPA)
    |
    | :8080
    v
nginx (static files + reverse proxy)
    |
    | /api/* and /socket.io/*
    v
NestJS Server (REST API + Socket.IO Gateway)
    |
    +---> PostgreSQL 16 (data)
    +---> Local filesystem (uploaded files)
    +---> Mailpit (dev email)
```

### Key Design Decisions

1. **Personal chats as rooms** -- DMs are modeled as rooms with `isPersonal=true` and exactly 2 members. This unifies the messaging code path.

2. **Cursor-based pagination** -- Message history uses cursor-based pagination (`id` as cursor) for efficient infinite scroll over large histories.

3. **In-memory presence** -- At 300 users, presence tracking lives in-memory on the server process via a simple `Map<userId, SocketEntry[]>`. No Redis needed.

4. **JWT with DB-stored refresh tokens** -- Access tokens are stateless (15min TTL). Refresh tokens are stored in the `sessions` table, enabling session listing and per-device revocation with token rotation.

5. **File access control at API level** -- Files stored with UUID names. Downloads go through an authenticated endpoint that verifies room membership.

6. **Socket.IO rooms for broadcasting** -- Each chat room maps to a Socket.IO room. Efficient broadcasting without iterating connected clients.

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed. For local development, the defaults work out of the box.

| Variable | Default | Description |
|----------|---------|-------------|
| `PARLEY_PORT` | `8080` | Host port for the web UI |
| `APP_URL` | `http://localhost:8080` | Public URL (used in email links) |
| `JWT_SECRET` | `parley-dev-secret...` | JWT signing secret. **Override in production** |
| `MAILHOG_UI_PORT` | `8025` | Mailpit web UI port |
| `SMTP_HOST` | `mailhog` | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_USER` | (empty) | SMTP auth username |
| `SMTP_PASS` | (empty) | SMTP auth password |
| `SMTP_SECURE` | `false` | Use TLS for SMTP |
| `MAIL_FROM` | `Parley <noreply@parley.local>` | Sender address |

### Production Checklist

1. Set a strong `JWT_SECRET` (`openssl rand -hex 48`)
2. Point `SMTP_*` at your real SMTP relay
3. Set `APP_URL` to your public domain
4. Consider removing the `mailhog` service
5. Remove the `db` port mapping (no need to expose PostgreSQL)

---

## Local Development

### Without Docker (for active development)

**Prerequisites:** Node.js 20+, PostgreSQL 16 running locally

```bash
# 1. Start PostgreSQL (via Docker or local install)
docker compose up -d db mailhog

# 2. Backend
cd server
cp .env.example .env        # or use existing .env
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev            # http://localhost:3000

# 3. Frontend (separate terminal)
cd client
npm install
npm run dev                  # http://localhost:5173 (proxies API to :3000)
```

The Vite dev server proxies `/api/*` and `/socket.io/*` to `localhost:3000`.

### With Docker (production-like)

```bash
docker compose up --build
```

### Running Tests

```bash
cd server
npm test                     # Unit tests
npm run test:e2e             # End-to-end tests
```

### Database Migrations

```bash
cd server

# Create a new migration after schema changes
npx prisma migrate dev --name <migration-name>

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require `Authorization: Bearer <token>`.

Full endpoint documentation with payloads and WebSocket events is in [`docs/architecture.md`](./docs/architecture.md#api-endpoints).

### Summary

| Module | Base Path | Endpoints |
|--------|-----------|-----------|
| Auth | `/api/auth` | register, login, refresh, logout, forgot-password, reset-password, me, change-password, sessions |
| Rooms | `/api/rooms` | CRUD, join, leave, invite, members, bans, admins |
| Messages | `/api/rooms/:roomId/messages` | Paginated history |
| Friends | `/api/friends` | list, requests, send, accept, reject, remove |
| Users | `/api/users` | delete account, ban/unban users |
| Personal Chats | `/api/personal-chats` | list DMs, open DM |
| Attachments | `/api/attachments` | upload, download |
| Health | `/api/health` | service health check |

### WebSocket

Connect to `/socket.io` with `{ auth: { token } }`. Events documented in [`docs/architecture.md`](./docs/architecture.md#websocket-events).

---

## Capacity and Performance

| Metric | Target |
|--------|--------|
| Concurrent users | 300 |
| Max room size | 1,000 members |
| Message delivery latency | < 3 seconds |
| Presence update latency | < 2 seconds |
| Room history | 10,000+ messages (infinite scroll) |
| Max file size | 20 MB |
| Max image size | 3 MB |
| Message text limit | 3 KB (UTF-8) |

---

## License

MIT
