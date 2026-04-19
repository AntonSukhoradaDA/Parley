# Architecture

## System Overview

```
                        +-------------------+
                        |   Web Browser     |
                        | (React 19 SPA)    |
                        +--------+----------+
                                 |
                          :8080  | HTTP / WebSocket
                                 |
                        +--------v----------+
                        |   nginx (alpine)  |
                        |   Static files    |
                        |   Reverse proxy   |
                        +--------+----------+
                                 |
                    /api/*       |       /socket.io/*
                    HTTP         |       WebSocket
                                 |
                        +--------v----------+
                        |   NestJS Server   |
                        |   Node 20         |
                        |   REST + WS + XMPP|
                        +---+---+---+---+---+
                            |   |   |   |
             +--------------+   |   |   +--------------+
             |                  |   |                  |
    +--------v-----+ +---------v+ +v-------+ +---------v-------+
    | PostgreSQL 16 | | Mailpit  | | Files  | | Prosody 13      |
    | (pgdata vol)  | |          | |(uploads| | (XEP-0114 :5347)|
    +---------------+ +----------+ +--------+ +---------+-------+
                                                         |
                                              s2s (5269) | dialback
                                                         v
                                               Other Parley/XMPP
                                                    servers
```

## Docker Compose Services

### Default (`docker-compose.yml`)

| Service | Image | Internal Port | Exposed Port | Purpose |
|---------|-------|---------------|--------------|---------|
| `db` | `postgres:16-alpine` | 5432 | 5432 | Primary data store |
| `mailhog` | `axllent/mailpit` | 1025 (SMTP), 8025 (UI) | 8025 | Dev email capture |
| `prosody` | Custom (Debian + Prosody 13) | 5222 (c2s), 5269 (s2s), 5347 (component), 5280 (HTTP) | 5222/5269/5347/5280 | XMPP federation sidecar |
| `server` | Custom (Node 20) | 3000 | - (proxied) | API + WebSocket server + XMPP component bridge |
| `client` | Custom (nginx) | 80 | 8080 | SPA + reverse proxy |

**Startup order:** `db` (health check) -> `mailhog` + `prosody` -> `server` (health check) -> `client`

**Volumes:**
- `pgdata` — PostgreSQL data directory
- `uploads` — User-uploaded files and images
- `prosodydata` — Prosody state (generated self-signed certs, offline queues)

### Federation harness (`docker-compose.federation.yml`)

Two parallel stacks (suffixed `-a` and `-b`) on :8080 and :8081. Each stack has its own private network (`stack-a`/`stack-b`) where `server-X` is aliased as `server` so the client nginx can resolve it. A shared `fednet` bridge network wires the two Prosody containers with aliases `parley-a.local`, `bridge.parley-a.local`, `conference.parley-a.local` (and the `-b` equivalents) so s2s dialback works without external DNS.

---

## Backend Architecture (NestJS)

### Module Dependency Graph

```
AppModule
  |
  +-- ConfigModule (global)
  +-- PrismaModule (global)   -- PostgreSQL ORM
  +-- MailModule (global)     -- SMTP / Nodemailer
  |
  +-- HealthModule            -- GET /api/health
  +-- UsersModule             -- User profiles, account deletion, user bans
  +-- AuthModule              -- Registration, login, JWT, password reset
  |     +-- depends on: UsersModule, MailModule
  |
  +-- FriendsModule           -- Friend requests, friend list
  +-- RoomsModule             -- Room CRUD, membership, moderation
  +-- MessagesModule          -- Message CRUD, history pagination
  +-- PersonalChatsModule     -- 1:1 direct message rooms
  |     +-- depends on: FriendsModule
  |
  +-- AttachmentsModule       -- File upload/download
  +-- XmppModule              -- XMPP federation bridge (phase 10)
  |     +-- XmppConfig, XmppBridgeService, XmppInboundService, XmppStatsService
  |     +-- XmppAdminController (/api/admin/xmpp/{stats,sessions,federation})
  |     +-- depends on: PrismaModule
  +-- ChatModule              -- Socket.IO gateway, presence tracking
        +-- depends on: MessagesModule, RoomsModule, XmppModule
```

### Authentication Flow

```
Registration / Login
        |
        v
  +------------------+
  | bcrypt hash pwd  |
  | Create Session   |
  | Issue JWT (15m)  |
  | Set httpOnly     |
  | refresh cookie   |
  | (30 days)        |
  +------------------+
        |
        v
  Client stores accessToken in memory
  Refresh cookie sent automatically
        |
        v
  On 401 -> POST /api/auth/refresh
        |
        v
  Token rotation: old refresh invalidated,
  new refresh + access returned
```

**JWT payload:** `{ sub: userId }` signed with `JWT_SECRET`

### WebSocket Architecture

```
Client connects with JWT in auth handshake
        |
        v
  Gateway verifies token
  Looks up user + room memberships
        |
        v
  Joins Socket.IO rooms:
    room:{roomId} for each membership
    user:{userId} for personal notifications
        |
        v
  Registers in PresenceService (in-memory)
  Broadcasts presence:update to room peers
  Sends unread:init with per-room counts
        |
        v
  Bidirectional events:
    message:send / message:new
    message:edit / message:edited
    message:delete / message:deleted
    presence:activity (client -> server)
    presence:update (server -> clients)
    unread:bump (server -> clients)
    room:markRead (client -> server)
```

### Presence State Machine

```
  +---------+    connect     +--------+
  | offline | ------------> | online |
  +---------+               +--------+
       ^                     |      ^
       |         no activity |      | activity ping
       |         for 60s     v      |
       |                   +-----+
       +--- disconnect --- | afk |
                           +-----+
```

- **online**: at least one socket reported activity within 60 seconds
- **afk**: all sockets idle > 60 seconds
- **offline**: no connected sockets

Multi-tab: tracked per-socket. Status is the "best" across all sockets.

### XMPP Federation Bridge

```
Local send (A):
  Socket.IO client
      |
      | message:send
      v
  ChatGateway.onSend
      |
      +-- create local Message (DB)
      +-- broadcast to room:<id> on this server
      +-- fire-and-forget publishToXmpp():
             lookup room members
             for each remote member (isRemote=true, xmppJid set):
                XmppBridgeService.sendDm(
                  from: alice@bridge.parley-a.local,
                  to:   bob@bridge.parley-b.local
                )
                                |
                                v
                        XEP-0114 component stream
                                |
                                v
                          Prosody (A)
                                |
                                v
                          s2s / dialback
                                |
                                v
                          Prosody (B) routes to
                          bridge.parley-b.local component
                                |
                                v
                        XmppBridgeService (B)
                                |
                                v
                        XmppInboundService:
                          strip "bridge." from sender
                          upsert shadow User (isRemote=true)
                          find-or-create personal room
                          insert Message (DB)
                          emit via ChatGateway broadcaster:
                             dedupe sockets in user:<id> rooms
                             auto-join socket to room:<id>
                             emit message:new
```

Key routing detail: Prosody rejects stanzas whose `from` is not in the
component's own domain. The bridge therefore emits from
`<user>@bridge.<local-domain>` and rewrites remote `to` addresses to
`<user>@bridge.<peer-domain>`. The inbound handler on the peer strips the
`bridge.` prefix to recover the canonical user JID for shadow-user lookup.

### Admin Dashboard

`/admin` polls `/api/admin/xmpp/stats`, `/sessions`, and `/federation`
every 3 seconds. The endpoints are guarded by `JwtAuthGuard` and serve:
live bridge state (connected, uptime, reconnects); stanza in/out counters
and byte totals; ring-buffer of last 50 errors; per-peer live + persisted
counters from the `federation_peers` table.

---

## Frontend Architecture (React)

### Component Tree

```
App (BrowserRouter)
  |
  +-- PublicOnlyRoute
  |     +-- LoginPage
  |     +-- RegisterPage
  |     +-- ForgotPasswordPage
  |     +-- ResetPasswordPage
  |
  +-- ProtectedRoute
        +-- AdminPage (/admin)
        |     +-- Header (Logo, LanguageSwitcher, ThemeToggle, back-to-chat link)
        |     +-- Stat cards (status, uptime, stanzas in/out, bytes, reconnects, domain)
        |     +-- Federation peers table (domain, stanza totals, last seen)
        |     +-- Sessions (raw JSON when Prosody admin API is available)
        |     +-- Recent errors ring
        |
        +-- ChatPage
              |
              +-- Header (Logo, Contacts button, ThemeToggle, user menu incl. Federation link)
              |
              +-- RoomSidebar (left)
              |     +-- Room list (public / private / DMs)
              |     +-- Unread badges
              |
              +-- Main chat area (center)
              |     +-- Room header (name, description, manage button)
              |     +-- MessageList (infinite scroll, replies, edits)
              |     +-- MessageInput (multiline, reply/edit mode, attachments)
              |
              +-- MemberPanel (right)
              |     +-- Members grouped by online / away / offline
              |
              +-- Modals
                    +-- CreateRoomModal
                    +-- PublicRoomsModal
                    +-- ManageRoomModal (members, admins, bans, invites, settings)
                    +-- ContactsPanel (friends, requests, add friend)
                    +-- ProfileModal (password, sessions, blocked users, delete account)
```

### State Management

```
Zustand Stores
  |
  +-- useAuthStore        -- user, accessToken, auth status
  +-- useRoomsStore       -- rooms[], personalChats[], selectedId
  +-- usePresenceStore    -- statuses{}, unreadCounts{}
  +-- useThemeStore       -- dark / light theme
  +-- usePendingStore     -- pending attachment uploads
```

### Data Flow

```
User action
    |
    v
lib/* API function (fetch wrapper with auto-refresh)
    |
    v
Zustand store update
    |
    v
React re-render via selector hooks

Socket.IO events (parallel path):
  server emits -> socket listener -> Zustand store update -> re-render
```

---

## Database Schema (ERD)

```
users
  |-- 1:N -- sessions
  |-- 1:N -- password_reset_tokens
  |-- 1:N -- rooms (as owner)
  |-- M:N -- room_members (with role + lastReadAt)
  |-- 1:N -- messages (as sender)
  |-- 1:N -- attachments (as uploader)
  |-- M:N -- friendships (requester / addressee)
  |-- M:N -- user_bans (blocker / blocked)
  |-- 1:N -- room_bans (as issuer / target)

rooms
  |-- 1:N -- room_members
  |-- 1:N -- room_bans
  |-- 1:N -- messages

messages
  |-- self-ref -- replyTo (nullable)
  |-- 1:N -- attachments

federation_peers (standalone)
  |-- domain (unique)
  |-- stanzasIn / stanzasOut counters
  |-- firstSeenAt / lastSeenAt
```

**Key design decisions:**
- Personal DMs are rooms with `isPersonal = true` and exactly 2 members
- `RoomMember.lastReadAt` tracks unread state per user per room
- `RoomMember.role` enum: `owner | admin | member`
- Room bans include `bannedById` to track who issued the ban
- User bans auto-remove friendships on creation
- Messages indexed on `[roomId, createdAt]` for efficient history queries
- Cursor-based pagination using `id` as cursor for infinite scroll
- `User.email` and `User.passwordHash` are nullable so remote shadow users (`isRemote = true`, `xmppJid` populated) can coexist in the same table; login / register paths reject remote rows explicitly
- `Room.xmppMucJid` is reserved for mirroring a room to an XMPP MUC on the peer's conference domain
- `FederationPeer` rows persist cumulative per-domain stanza counters across restarts for the admin dashboard

---

## API Endpoints

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | No | Create account |
| POST | /login | No | Sign in |
| POST | /refresh | No | Refresh access token |
| POST | /logout | No | Clear session |
| POST | /forgot-password | No | Request reset email |
| POST | /reset-password | No | Set new password |
| GET | /me | Yes | Current user profile |
| PATCH | /change-password | Yes | Update password |
| GET | /sessions | Yes | List active sessions |
| DELETE | /sessions/:id | Yes | Revoke a session |

### Rooms (`/api/rooms`)
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Create room |
| GET | / | List my rooms |
| GET | /public | Public room catalog (with search) |
| GET | /:id | Room details |
| PATCH | /:id | Update settings (owner) |
| DELETE | /:id | Delete room (owner) |
| POST | /:id/join | Join public room |
| POST | /:id/leave | Leave room |
| POST | /:id/invite | Invite user to private room |
| GET | /:id/members | List members |
| GET | /:id/bans | List banned users |
| POST | /:id/admins/:userId | Promote to admin |
| DELETE | /:id/admins/:userId | Demote admin |
| POST | /:id/ban/:userId | Ban user |
| DELETE | /:id/ban/:userId | Unban user |
| DELETE | /:id/members/:userId | Kick (= ban) |

### Messages (`/api/rooms/:roomId/messages`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Paginated history (?cursor, ?limit) |

### Friends (`/api/friends`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | List friends |
| GET | /requests | Pending requests (incoming + outgoing) |
| POST | /request | Send friend request |
| POST | /accept/:id | Accept request |
| DELETE | /reject/:id | Reject / cancel request |
| DELETE | /:userId | Remove friend |

### Users (`/api/users`)
| Method | Path | Description |
|--------|------|-------------|
| DELETE | /me | Delete account |
| POST | /ban/:userId | Block user |
| DELETE | /ban/:userId | Unblock user |
| GET | /bans | List blocked users |

### Personal Chats (`/api/personal-chats`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | List DM conversations |
| POST | /by-jid | Open / get DM with a remote XMPP JID (auto-provisions shadow user) |
| POST | /:userId | Open / get DM with a local user (requires friendship) |

### Admin — XMPP (`/api/admin/xmpp`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /stats | Bridge state, stanza counters, uptime, reconnects, recent errors, per-peer live counters |
| GET | /sessions | Proxies Prosody's `mod_parley_admin` HTTP endpoint. Returns `{available, count, sessions: [{jid, username, resource, ip, since, secure}]}` |
| GET | /federation | Persisted `FederationPeer` rows merged with live counters |

### XMPP auth callback (`/api/xmpp/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Called by Prosody's `mod_auth_parley` on each SASL attempt. Header: `X-Parley-Bridge-Secret: <XMPP_COMPONENT_SECRET>`. Body: `{username, password}`. Returns 200 `{ok:true}` on valid creds, 401 otherwise. Not intended for direct use by web clients. |

### Attachments (`/api/attachments`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /upload | Upload file (multipart) |
| GET | /:id/download | Download file (auth + access check) |

### Health (`/api/health`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Service health check |

---

## WebSocket Events

### Client -> Server
| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{ roomId, content, replyToId?, attachmentIds? }` | Send message |
| `message:edit` | `{ messageId, content, roomId }` | Edit own message |
| `message:delete` | `{ messageId, roomId }` | Delete message |
| `room:join` | `{ roomId }` | Subscribe to room channel |
| `room:leave` | `{ roomId }` | Unsubscribe from room channel |
| `room:markRead` | `{ roomId }` | Mark room as read |
| `presence:activity` | (none) | Report user activity |
| `presence:getRoom` | `{ roomId }` | Get presence for room members |

### Server -> Client
| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | Message object | New message broadcast |
| `message:edited` | Message object | Edited message broadcast |
| `message:deleted` | `{ messageId, roomId }` | Deletion broadcast |
| `presence:update` | `{ userId, status }` | Presence change |
| `unread:init` | `{ [roomId]: count }` | Initial unread counts |
| `unread:bump` | `{ roomId }` | Increment unread for room |

---

## Security

- Passwords hashed with **bcrypt** (10 rounds)
- JWT access tokens: **15-minute** expiry, signed with `JWT_SECRET`
- Refresh tokens: **30-day** expiry, stored in DB, rotated on use, delivered as **httpOnly** cookie
- Password reset tokens: SHA-256 hashed, **30-minute** expiry, single-use
- File downloads require authentication + room membership verification
- Files stored with UUID names (no path guessing)
- Input validation via `class-validator` with `whitelist + forbidNonWhitelisted`
- CORS configured for Socket.IO
- XMPP component secret (`XMPP_COMPONENT_SECRET`) gates the bridge-to-Prosody connection; must be overridden in production
- Shadow remote users (`isRemote = true`) cannot log in, reset passwords, or receive friend requests; `auth.service` rejects them up-front
- Prosody ships with dev-only TLS settings (self-signed certs, `verify = "none"`, lowered cipher security); replace before exposing s2s to the public internet

---

## Phase 10: XMPP Federation

The `server/src/xmpp/` module implements the component bridge. Key classes:

| Class | File | Responsibility |
|-------|------|----------------|
| `XmppConfig` | `xmpp.config.ts` | Env-var → typed config; JID helpers (`localJid`, `componentJid`, `routeViaPeerBridge`) |
| `XmppBridgeService` | `xmpp-bridge.service.ts` | `OnModuleInit` dynamic-imports `@xmpp/component`, connects, handles reconnect, exposes `sendDm` / `sendLocalDm` / `sendMuc`; feeds inbound stanzas to a registered handler. All outbound stanzas carry `urn:xmpp:hints/no-store` so Prosody doesn't shadow the Parley DB |
| `XmppInboundService` | `xmpp-inbound.service.ts` | Resolves shadow users (idempotent upsert), materializes personal rooms, persists messages, calls the chat broadcaster |
| `XmppStatsService` | `xmpp-stats.service.ts` | In-memory counters + last-50-errors ring buffer |
| `XmppAdminController` | `xmpp-admin.controller.ts` | REST surface at `/api/admin/xmpp/*`; `sessions` proxies Prosody's `mod_parley_admin` |
| `XmppAuthController` | `xmpp-auth.controller.ts` | `POST /api/xmpp/auth` for Prosody's `mod_auth_parley` to verify SASL attempts against Parley's bcrypt hashes |

### Custom Prosody modules (`prosody/`)

| Module | Responsibility |
|--------|----------------|
| `mod_auth_parley.lua` | HTTP-backed auth provider. On SASL PLAIN attempts, POSTs `{username, password}` to `/api/xmpp/auth` with the bridge secret. No accounts in Prosody; authentication is dynamic per attempt. |
| `mod_parley_forward.lua` | Per-c2s-session `stanzas/in` filter. Duplicates chat messages to the bridge component so Parley can persist and broadcast over Socket.IO. Original stanza still flows through normal Prosody routing. |
| `mod_parley_admin.lua` | Tiny HTTP module at `GET /parley_admin/sessions`. Returns a JSON array of every active c2s session (jid, resource, ip, tls flag, connect time). Bearer-token auth reuses `parley_auth_secret`. |

### Protocol flow summary

1. Server A's bridge emits `<message from="alice@bridge.parley-a.local" to="bob@bridge.parley-b.local" type="chat">` over the component stream to Prosody A.
2. Prosody A routes it via s2s dialback to Prosody B.
3. Prosody B delivers the stanza to its local `bridge.parley-b.local` component (server B's bridge).
4. Server B strips `bridge.` from the sender, upserts a shadow `User(alice@parley-a.local, isRemote=true)`, find-or-creates the personal room between Bob and Alice's shadow, persists a `Message`, and broadcasts via Socket.IO to Bob's session.

Groupchat (MUC) follows the same pattern using `conference.<peer-domain>`, though inbound MUC delivery depends on the peer hosting a matching MUC room.

### Failure modes

- **`invalid-from` errors**: a prior version emitted stanzas from `<user>@<parley-domain>` which Prosody rejects for external components. Current code uses `componentJid()` which always emits from `<user>@bridge.<domain>`.
- **`handshake_failure` on s2s TLS**: Prosody's default ciphers are strict; dev config sets `ssl.verify = "none"` and `@SECLEVEL=0` to let self-signed certs handshake successfully. Required for local federation; **not** for production.
- **Concurrent shadow-user creation**: two inbound stanzas from the same remote user racing on first contact used to hit the unique-`xmppJid` constraint. The resolver is now `upsert(where: { xmppJid }, update: {}, create: { … })`, with a catch → re-read fallback.
- **Socket not in room when inbound materializes it**: the inbound broadcaster emits via each member's `user:<id>` channel (always joined at connect) instead of the `room:<id>` Socket.IO room, and pulls the socket into the room for future broadcasts.
- **Prosody stanza API nomenclature**: Lua modules must use `stanza.attr.<name>` (singular), not `.attrs`. Mixing up the two was the subtle bug that stopped `mod_parley_forward` from firing early in development.
- **HTTP `Host` mismatch on admin endpoints**: Prosody's HTTP router keys routes by the incoming `Host` header matching a VirtualHost. Calls from the server container arrive with `Host: prosody` which doesn't match `parley.local`, so `http_default_host = xmpp_domain` is set to route unknown hosts to the main VirtualHost.
- **Jabber-client cert trust**: Prosody generates per-domain self-signed certs at container start. Strict Mac clients (Beagle IM) reject silently with "could not contact server"; users either import the cert into the system keychain or run a more permissive client like Monal. Dev-only: the bundled `loadtest/c2s-login-test.mjs` sets `NODE_TLS_REJECT_UNAUTHORIZED=0`.

### Bundled c2s test scripts (`loadtest/`)

| Script | Purpose |
|--------|---------|
| `c2s-login-test.mjs` | Minimal `@xmpp/client` round-trip: connects, authenticates, sends `<presence/>`, disconnects. Proves SASL PLAIN works against a real Parley user. |
| `c2s-bridge-test.mjs` | End-to-end bidirectional flow: registers Alice + Bob, opens a personal chat, connects Bob as a Jabber client and Alice via Socket.IO. Sends in both directions, asserts each side observed the other's message. |
| `federation-loadtest.mjs` | Cross-server load test. Seeds N users per side, provisions cross-server rooms via `/api/personal-chats/by-jid`, fires `N × M` DMs, reports p50/p95/p99 latency. |
