# Parley - Implementation Plan

## 1. Project Summary

Parley is a classic web-based chat application supporting:
- User registration/authentication with persistent sessions
- Public and private chat rooms (up to 1000 members each)
- One-to-one personal messaging (functionally equivalent to 2-person rooms)
- Contacts/friends system with friend requests, confirmations, and user-to-user bans
- File/image sharing with access control
- Moderation: room owner/admin hierarchy, bans, message deletion
- Persistent message history with infinite scroll
- Real-time presence (online/AFK/offline) with multi-tab awareness
- Unread message indicators
- Target: 300 concurrent users, <3s message delivery, <2s presence updates
- Deployment via `docker compose up`
- Optional: XMPP/Jabber federation

---

## 2. Monorepo Structure

```
parley/
  client/              # Frontend SPA
  server/              # Backend API + WebSocket server
  docker-compose.yml   # Orchestration
  Dockerfile.client    # Frontend build/serve
  Dockerfile.server    # Backend
  .env.example         # Environment template
  package.json         # Root workspace (optional scripts)
  INSTRUCTIONS.MD
  PLAN.MD
  README.md
```

---

## 3. Technology Options

### 3.1 Backend Runtime

| Option | Pros | Cons |
|--------|------|------|
| **A. Node.js + NestJS (TypeScript)** | Structured, modular, built-in WebSocket gateway, great TypeScript support, large ecosystem | Heavier framework, steeper learning curve |
| **B. Node.js + Express + Socket.IO (TypeScript)** | Simple, widely known, Socket.IO handles reconnection/rooms/fallback out of the box | Less structured, needs manual organization at scale |
| **C. Node.js + Fastify + ws (TypeScript)** | Fast, low overhead, schema validation built-in | Raw WebSocket means manual room/presence management |

**Recommendation: Option A (NestJS)** - The app has significant complexity (auth, rooms, moderation, presence, file uploads). NestJS provides the structure, decorators, guards, and WebSocket gateway that will keep the codebase maintainable. TypeScript is shared with the frontend.

### 3.2 Database

| Option | Pros | Cons |
|--------|------|------|
| **A. PostgreSQL** | Battle-tested relational DB, strong for structured data (users, rooms, memberships, bans), excellent indexing for message history queries, JSONB for flexibility | Requires schema migrations |
| **B. MongoDB** | Flexible schema, natural for chat messages as documents | Weaker for relational integrity (memberships, bans, permissions), harder to enforce uniqueness constraints |
| **C. PostgreSQL + Redis** | PostgreSQL for persistence, Redis for pub/sub, sessions, presence cache | More moving parts in Docker setup |

**Recommendation: Option A (PostgreSQL)** - The data model is heavily relational (users <-> rooms <-> memberships <-> bans <-> messages). PostgreSQL handles all of this cleanly. For 300 users, we don't need Redis - we can manage presence and pub/sub in-memory via the WebSocket server process. If scaling becomes a concern later, Redis can be added.

### 3.3 ORM / Query Layer

| Option | Pros | Cons |
|--------|------|------|
| **A. TypeORM** | Mature, decorator-based (fits NestJS well), migration support | Performance issues with complex relations, some quirks |
| **B. Prisma** | Excellent DX, type-safe queries, auto-generated client, clean migrations | Less flexible for raw queries, schema-first approach |
| **C. MikroORM** | Unit of work pattern, good TypeScript support, identity map | Smaller community |

**Recommendation: Option B (Prisma)** - Best developer experience, excellent type safety, clean migration workflow, and integrates well with NestJS.

### 3.4 Authentication Mechanism

| Option | Pros | Cons |
|--------|------|------|
| **A. JWT (Access + Refresh tokens)** | Stateless, works well with WebSocket (send token on connect), easy multi-tab | Need refresh token rotation, token invalidation requires blocklist |
| **B. Server-side sessions (express-session + DB store)** | Simple, easy to revoke, session list is natural | Requires DB lookup per request, harder with WebSocket |
| **C. JWT for WebSocket + Session cookies for HTTP** | Best of both: session management for HTTP, JWT for real-time auth | More complex, two auth mechanisms to maintain |

**Recommendation: Option A (JWT)** - Fits the requirements well: persistent login (refresh token in httpOnly cookie), multi-tab works naturally (same token), session listing is achievable by storing refresh tokens in DB, individual session revocation by invalidating specific refresh tokens. WebSocket auth is clean (send JWT on connection).

### 3.5 Real-time Communication

| Option | Pros | Cons |
|--------|------|------|
| **A. Socket.IO** | Room abstractions, auto-reconnect, fallback transport, huge ecosystem | Slightly heavier, proprietary protocol |
| **B. Native WebSocket (ws library)** | Lightweight, standard protocol | Manual room management, reconnection, multiplexing |
| **C. NestJS WebSocket Gateway with Socket.IO adapter** | Integrates with NestJS decorators/guards, uses Socket.IO under the hood | Coupled to NestJS patterns |

**Recommendation: Option C (NestJS Gateway + Socket.IO)** - Since we're using NestJS, its WebSocket gateway provides a clean abstraction. Socket.IO underneath handles reconnection and room management. NestJS guards work for WebSocket auth too.

### 3.6 Frontend Framework

| Option | Pros | Cons |
|--------|------|------|
| **A. React + Vite** | Most popular, huge ecosystem, fast dev with Vite | Need to pick state management, routing, etc. |
| **B. Next.js** | SSR, file-based routing, API routes | Overkill for a SPA chat app, SSR not needed |
| **C. Vue 3 + Vite** | Simpler API, great DX, built-in state management | Smaller ecosystem than React |

**Recommendation: Option A (React + Vite)** - SPA is the right choice for a chat app (no SSR needed). React has the largest ecosystem for UI components. Vite gives fast builds.

### 3.7 Frontend State & Data Fetching

| Option | Pros | Cons |
|--------|------|------|
| **A. Zustand + React Query (TanStack Query)** | Lightweight, React Query for server state caching, Zustand for client state (presence, active chat) | Two libraries to learn |
| **B. Redux Toolkit + RTK Query** | All-in-one, mature, predictable | Verbose, heavier for this use case |
| **C. Jotai/Recoil + React Query** | Atomic state, fine-grained re-renders | Less structured |

**Recommendation: Option A (Zustand + TanStack Query)** - Zustand is minimal and perfect for WebSocket-driven state (messages, presence, notifications). TanStack Query handles REST API calls (room lists, user profiles, history loading) with caching and pagination.

### 3.8 UI Component Library

| Option | Pros | Cons |
|--------|------|------|
| **A. Tailwind CSS + shadcn/ui** | Utility-first, copy-paste components (full control), modern look | More manual assembly |
| **B. Ant Design** | Rich component set, good for admin UIs, modals, tables | Opinionated, harder to customize, heavier bundle |
| **C. Chakra UI** | Clean API, accessible, good defaults | Smaller component set |
| **D. Mantine** | Excellent hooks library, rich components, good DX | Slightly less popular |

**Recommendation: Option A (Tailwind + shadcn/ui)** - Best for a chat app where we need custom layouts. shadcn/ui provides ready-made modals, dropdowns, tabs (needed for admin UI) while Tailwind gives full control over the chat layout.

### 3.9 File Storage

No real options here per requirements: **local filesystem** with Docker volume mount. Files served through authenticated API endpoints.

### 3.10 Password Hashing

| Option | Pros | Cons |
|--------|------|------|
| **A. bcrypt** | Industry standard, time-tested | Slower on some platforms |
| **B. argon2** | Winner of Password Hashing Competition, more modern | Slightly less widespread |

**Recommendation: Option A (bcrypt)** - Battle-tested, well-supported in Node.js, sufficient for this scale.

---

## 4. Recommended Stack Summary

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + NestJS (TypeScript) |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Real-time** | NestJS WebSocket Gateway + Socket.IO |
| **Frontend** | React 18 + Vite + TypeScript |
| **State** | Zustand + TanStack Query |
| **UI** | Tailwind CSS + shadcn/ui |
| **Routing** | React Router v7 |
| **File storage** | Local filesystem (Docker volume) |
| **Containerization** | Docker + Docker Compose |

---

## 5. Implementation Plan

### Phase 1: Project Scaffolding & Infrastructure

**Step 1.1 - Monorepo setup**
- Initialize `server/` with NestJS CLI
- Initialize `client/` with Vite React-TS template
- Root `package.json` with workspace scripts
- Configure shared TypeScript settings

**Step 1.2 - Docker setup**
- `Dockerfile.server` - multi-stage build (build + run)
- `Dockerfile.client` - build React app, serve with nginx
- `docker-compose.yml` with services: `db` (PostgreSQL), `server`, `client`
- Volume mounts for DB data and file uploads
- `.env.example` with all configuration variables
- Ensure `docker compose up` works end-to-end with a health check

**Step 1.3 - Database schema (Prisma)**
- Design and create Prisma schema with models:
  - `User` (id, email, username, passwordHash, createdAt)
  - `Session` (id, userId, token, ip, userAgent, createdAt, expiresAt)
  - `Room` (id, name, description, visibility, ownerId, createdAt)
  - `RoomMember` (roomId, userId, role, joinedAt)
  - `RoomBan` (roomId, userId, bannedById, createdAt)
  - `Message` (id, roomId, senderId, content, replyToId, editedAt, createdAt)
  - `Attachment` (id, messageId, filename, mimetype, size, path, comment)
  - `Friendship` (id, requesterId, addresseeId, status, message, createdAt)
  - `UserBan` (id, blockerId, blockedId, createdAt)
  - `PersonalChat` (id, userAId, userBId) - treated as a special room
- Run initial migration

---

### Phase 2: Authentication & User Management

**Step 2.1 - Registration**
- POST `/api/auth/register` - email, username, password
- Validate uniqueness (email, username)
- Hash password with bcrypt
- Return JWT tokens

**Step 2.2 - Login / Logout**
- POST `/api/auth/login` - email + password
- Return access token (short-lived, ~15min) + refresh token (httpOnly cookie, ~30 days)
- POST `/api/auth/logout` - invalidate refresh token
- POST `/api/auth/refresh` - issue new access token

**Step 2.3 - Password management**
- POST `/api/auth/forgot-password` - generate reset token (since no email verification, show token or use a simple flow)
- POST `/api/auth/reset-password` - reset with token
- PATCH `/api/auth/change-password` - for logged-in users

**Step 2.4 - Session management**
- GET `/api/auth/sessions` - list active sessions (IP, user agent, created)
- DELETE `/api/auth/sessions/:id` - revoke a specific session

**Step 2.5 - Account deletion**
- DELETE `/api/users/me` - delete account, owned rooms, cascade messages/files in those rooms, remove memberships

**Step 2.6 - Auth frontend**
- Landing page with Sign In / Register forms
- Forgot password flow
- Token storage and auto-refresh
- Auth guards on protected routes

---

### Phase 3: Chat Rooms

**Step 3.1 - Room CRUD (Backend)**
- POST `/api/rooms` - create room (name, description, visibility)
- GET `/api/rooms/public` - public room catalog with search + member count
- GET `/api/rooms/:id` - room details
- PATCH `/api/rooms/:id` - update room settings (owner only)
- DELETE `/api/rooms/:id` - delete room + all messages/files (owner only)

**Step 3.2 - Room membership (Backend)**
- POST `/api/rooms/:id/join` - join public room
- POST `/api/rooms/:id/leave` - leave room (owner cannot leave)
- POST `/api/rooms/:id/invite` - invite user to private room
- GET `/api/rooms/:id/members` - list members with roles and presence

**Step 3.3 - Room moderation (Backend)**
- POST `/api/rooms/:id/admins/:userId` - make admin (owner only)
- DELETE `/api/rooms/:id/admins/:userId` - remove admin
- POST `/api/rooms/:id/ban/:userId` - ban user (admin+)
- DELETE `/api/rooms/:id/ban/:userId` - unban user (admin+)
- GET `/api/rooms/:id/bans` - list banned users with who-banned info
- DELETE `/api/rooms/:id/members/:userId` - remove member (= ban)

**Step 3.4 - Room UI**
- Room list sidebar (public/private sections, accordion style)
- Room catalog with search
- Create room modal
- Manage room modal with tabs: Members, Admins, Banned, Invitations, Settings
- Room info panel on the right

---

### Phase 4: Messaging

**Step 4.1 - Message CRUD (Backend)**
- WebSocket event: `message:send` - send message to room
- WebSocket event: `message:edit` - edit own message
- WebSocket event: `message:delete` - delete message (author or admin)
- GET `/api/rooms/:id/messages` - paginated history (cursor-based for infinite scroll)

**Step 4.2 - Message features**
- Reply-to references (store `replyToId`, fetch quoted message)
- Edited indicator (`editedAt` timestamp)
- 3KB text limit validation
- UTF-8 / emoji support (natural with UTF-8 DB column)

**Step 4.3 - Personal messaging (Backend)**
- Personal chats modeled as 2-person rooms internally
- GET `/api/personal-chats` - list personal conversations
- POST `/api/personal-chats/:userId` - start/get personal chat
- Same message events apply

**Step 4.4 - Chat UI**
- Message area with chronological display
- Infinite scroll (load older messages on scroll up)
- Auto-scroll to bottom on new messages (only if already at bottom)
- Message input: multiline, emoji, reply indicator
- Context menu on messages: reply, edit (own), delete (own/admin)
- Edited indicator display
- Reply quote display

---

### Phase 5: Real-time & Presence

**Step 5.1 - WebSocket server**
- NestJS WebSocket Gateway with Socket.IO
- JWT authentication on connection (verify token in handshake)
- Join Socket.IO rooms matching chat room IDs on connect
- Broadcast events: new message, message edited, message deleted, member joined/left

**Step 5.2 - Presence system**
- Track connected sockets per user (supports multi-tab)
- Client sends heartbeat / activity ping every 30s
- Client reports user activity (mouse, keyboard, focus) events
- AFK detection: if no activity in any tab for >1 minute, set AFK
- Offline: when last socket disconnects
- Broadcast presence changes to relevant users (room members, friends)
- WebSocket events: `presence:update`

**Step 5.3 - Unread tracking**
- Server tracks `lastReadAt` per user per room
- On room open, client sends `room:markRead` event
- Unread count = messages after `lastReadAt`
- Push unread counts on connect and on new messages

---

### Phase 6: Contacts & Friends

**Step 6.1 - Friend system (Backend)**
- POST `/api/friends/request` - send friend request (by username, optional message)
- GET `/api/friends/requests` - pending incoming/outgoing requests
- POST `/api/friends/accept/:id` - accept request
- DELETE `/api/friends/reject/:id` - reject request
- DELETE `/api/friends/:userId` - remove friend
- GET `/api/friends` - friend list with presence

**Step 6.2 - User-to-user ban**
- POST `/api/users/ban/:userId` - ban user
- DELETE `/api/users/ban/:userId` - unban user
- Enforce: blocked user cannot send friend requests or personal messages
- Existing personal chat becomes read-only/frozen

**Step 6.3 - Contacts UI**
- Contact list in sidebar with presence indicators
- Friend request notifications
- Add friend (by username or from room member list)
- Ban user option

---

### Phase 7: File & Image Attachments

**Step 7.1 - Upload system**
- POST `/api/attachments/upload` - multipart upload
- Validate: files <= 20MB, images <= 3MB
- Store on local filesystem with UUID-based paths
- Save metadata in DB (original filename, mimetype, size, comment)
- Associate with message

**Step 7.2 - Download & access control**
- GET `/api/attachments/:id/download` - authenticated download
- Verify requester is a current member of the room the attachment belongs to
- Stream file from disk

**Step 7.3 - Attachment UI**
- Upload button in message input
- Copy-paste image support
- Image preview inline in messages
- File attachment display with filename + download link
- Optional comment on attachment

---

### Phase 8: Notifications & Polish

**Step 8.1 - Notification indicators**
- Unread badges on room names in sidebar
- Unread badges on contact names
- Clear on chat open

**Step 8.2 - Profile & settings**
- Profile dropdown in top menu
- Password change
- Account deletion confirmation
- Active sessions list with revoke

**Step 8.3 - Error handling & edge cases**
- Graceful WebSocket reconnection
- Optimistic message sending with retry
- Form validation (registration, room creation, etc.)
- Loading states and skeletons
- Empty states (no rooms, no messages, no friends)

---

### Phase 9: Docker & Deployment Finalization

**Step 9.1 - Production Docker setup**
- Optimize Dockerfiles (multi-stage, minimal images)
- nginx config for client (SPA routing, proxy API/WS to server)
- Health checks for all services
- `docker-compose.yml` final config:
  - `db`: PostgreSQL with volume
  - `server`: NestJS app, depends on db
  - `client`: nginx serving React build, proxying API
- Ensure `docker compose up` brings everything up with zero manual steps
- Auto-run Prisma migrations on server start

**Step 9.2 - Environment & configuration**
- `.env.example` with all variables documented
- Sensible defaults for local development
- Session secret generation guidance

---

### Phase 10 (Optional): XMPP Federation — **Done**

**Step 10.1 - XMPP integration** — Done
- Prosody 13 sidecar (Debian trixie) introduced in `docker-compose.yml`
- NestJS `xmpp/` module uses `@xmpp/component` (XEP-0114) to speak to Prosody as the external `bridge.<domain>` component
- Parley users appear on XMPP as `<username>@bridge.<domain>` (outbound); remote peers stored as `User` rows with `isRemote = true` and canonical `xmppJid`
- Outbound: `ChatGateway.onSend` fans out to every non-sender room member - remote via `sendDm`/`routeViaPeerBridge`, local via `sendLocalDm` so messages reach the recipient's Jabber client sessions (if any)
- Inbound: `XmppInboundService` upserts a shadow `User`, find-or-creates a personal `Room`, persists a `Message`, and broadcasts via the Socket.IO gateway
- **Jabber-client c2s login** implemented via the custom `mod_auth_parley` Prosody module: every SASL PLAIN attempt is forwarded to `POST /api/xmpp/auth` for bcrypt verification against Parley's user table. Any Parley account can log in from any standard XMPP client (Beagle IM, Monal, Gajim, Conversations, Dino, `@xmpp/client`) with no separate provisioning
- **Two-way message bridging** (web ↔ Jabber) implemented via the custom `mod_parley_forward` Prosody module, which duplicates c2s-originated chats to the bridge component. Messages sent from Jabber clients are persisted as Parley `Message` rows and broadcast over Socket.IO; messages sent from the web UI are delivered to online Jabber-client sessions via `sendLocalDm` (with `urn:xmpp:hints/no-store` to avoid Prosody shadowing history)

**Step 10.2 - Federation** — Done
- Prosody `s2s` + `dialback` enabled; per-domain self-signed certs generated on first container boot (`prosody/entrypoint.sh`) so dialback TLS succeeds between fresh containers
- `docker-compose.federation.yml` brings up two parallel Parley stacks (`*-a` on :8080, `*-b` on :8081) with a shared `fednet` network so the two Prosody instances resolve each other's domain aliases
- `POST /api/personal-chats/by-jid` provisions a cross-server personal chat without requiring a pre-existing local friendship

**Step 10.3 - Admin dashboards** — Done
- `/admin` React page polls `/api/admin/xmpp/{stats,sessions,federation}` every 3 s
- Stats: bridge connection state, uptime, stanza in/out counters, bytes, reconnects, last-50 errors
- Federation: per-peer live counters merged with persisted `FederationPeer` rows
- Sessions: live c2s Jabber-client list (JID, IP, TLS, connect time) sourced from the custom `mod_parley_admin` Prosody HTTP module
- Localized into en / fr / es under the `admin.*` i18n namespace
- Linked from the profile dropdown on `/chats`

**Step 10.4 - Load test** — Done
- `loadtest/federation-loadtest.mjs` Node script: seeds N users on each side, waits for both bridges to come online, provisions cross-server rooms, fires `count x messages` DMs, reports p50/p95/p99 latency + throughput
- Verified: 10 × 20 = 200 delivered 100 %, p95 < 1 s; 50 × 100 exercises the pipeline end-to-end with Prisma connection pool as the bottleneck

---

## 6. Database Schema Overview

```
User
  id            UUID PK
  email         VARCHAR UNIQUE
  username      VARCHAR UNIQUE
  passwordHash  VARCHAR
  createdAt     TIMESTAMP

Session
  id            UUID PK
  userId        UUID FK -> User
  refreshToken  VARCHAR UNIQUE
  ip            VARCHAR
  userAgent     VARCHAR
  createdAt     TIMESTAMP
  expiresAt     TIMESTAMP

Room
  id            UUID PK
  name          VARCHAR UNIQUE
  description   TEXT
  visibility    ENUM(public, private)
  isPersonal    BOOLEAN (for DM rooms)
  ownerId       UUID FK -> User (null for personal chats)
  createdAt     TIMESTAMP

RoomMember
  roomId        UUID FK -> Room
  userId        UUID FK -> User
  role          ENUM(owner, admin, member)
  joinedAt      TIMESTAMP
  lastReadAt    TIMESTAMP
  PK(roomId, userId)

RoomBan
  id            UUID PK
  roomId        UUID FK -> Room
  userId        UUID FK -> User
  bannedById    UUID FK -> User
  createdAt     TIMESTAMP

Message
  id            UUID PK
  roomId        UUID FK -> Room
  senderId      UUID FK -> User
  content       TEXT (max 3KB)
  replyToId     UUID FK -> Message (nullable)
  editedAt      TIMESTAMP (nullable)
  createdAt     TIMESTAMP
  INDEX(roomId, createdAt)

Attachment
  id            UUID PK
  messageId     UUID FK -> Message
  filename      VARCHAR
  mimetype      VARCHAR
  size          INTEGER
  storagePath   VARCHAR
  comment       TEXT (nullable)

Friendship
  id            UUID PK
  requesterId   UUID FK -> User
  addresseeId   UUID FK -> User
  status        ENUM(pending, accepted)
  message       TEXT (nullable)
  createdAt     TIMESTAMP

UserBan
  id            UUID PK
  blockerId     UUID FK -> User
  blockedId     UUID FK -> User
  createdAt     TIMESTAMP
```

---

## 7. Key Architectural Decisions

1. **Personal chats as rooms** - DMs are modeled as rooms with `isPersonal=true` and exactly 2 members. This unifies the messaging code path and avoids duplication.

2. **Cursor-based pagination** - For infinite scroll on message history, use cursor-based pagination (createdAt + id) rather than offset-based. More efficient for large histories.

3. **In-memory presence** - At 300 users, presence tracking can live in-memory on the server process. No need for Redis. Connected sockets are tracked in a Map.

4. **JWT with DB-stored refresh tokens** - Access tokens are stateless (15min TTL). Refresh tokens are stored in the Session table, enabling session listing and individual revocation.

5. **File access control at API level** - Files are stored with UUID names (no path guessing). Downloads go through an authenticated endpoint that checks room membership.

6. **Socket.IO rooms for broadcasting** - Each chat room maps to a Socket.IO room. When a user joins/leaves a chat room, they join/leave the corresponding Socket.IO room. This makes broadcasting efficient.

---

## 8. Docker Compose Architecture

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]

  server:
    build: {context: ., dockerfile: Dockerfile.server}
    depends_on: [db]
    volumes: [uploads:/var/parley/files]
    environment: [DATABASE_URL, JWT_SECRET, ...]
    ports: []  # internal only, proxied by client/nginx

  client:
    build: {context: ., dockerfile: Dockerfile.client}
    depends_on: [server]
    ports: ["8080:80"]
    # nginx serves static files + proxies /api and /socket.io to server

volumes:
  pgdata:
  uploads:
```

The client's nginx acts as the single entry point on port 8080, serving the React SPA and proxying API/WebSocket requests to the server container.
