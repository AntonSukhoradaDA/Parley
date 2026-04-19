# Parley — Project Documentation

Living reference for the state of the codebase. Update when features ship or scope changes.

---

## 1. Overview

Parley is a classic web chat application. It supports user registration, public/private rooms, 1:1 direct messages, friend/contact management, file + image attachments, moderation (owner/admin), real-time presence with multi-tab awareness, and unread indicators.

Target: 300 concurrent users, rooms up to 1000 members, ≤3 s message delivery, ≤2 s presence updates. Deploys via `docker compose up`.

See `INSTRUCTIONS.md` for the full product spec and `PLAN.MD` for the phased implementation plan.

---

## 2. Tech Stack

| Layer          | Technology                                   |
|----------------|----------------------------------------------|
| Backend        | Node.js 20, NestJS 11 (TypeScript)           |
| Database       | PostgreSQL 16                                |
| ORM            | Prisma 6                                     |
| Auth           | JWT access (15 min) + refresh (30 d, cookie) |
| Real-time      | NestJS WebSocket Gateway + Socket.IO         |
| Mail           | Nodemailer → Mailpit (dev SMTP)              |
| Frontend       | React 19, Vite, TypeScript                   |
| Client state   | Zustand                                      |
| Styling        | Tailwind CSS 4, custom design tokens         |
| File storage   | Local filesystem, Docker volume              |
| Password hash  | bcrypt                                       |
| Federation     | Prosody 13 (XMPP) + `@xmpp/component` bridge |
| Orchestration  | Docker Compose                               |

---

## 3. Repository Layout

```
parley/
├── docker-compose.yml                # db + mailpit + prosody + server + client
├── docker-compose.federation.yml     # Two-stack cross-server federation harness
├── INSTRUCTIONS.md                   # product requirements
├── PLAN.MD                           # phased implementation plan (10 phases, all done)
├── DOCS.md                           # this file
├── README.md
│
├── server/                           # NestJS backend
│   ├── Dockerfile                    # multi-stage, runs `prisma migrate deploy` at boot
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── main.ts                   # bootstraps HTTP on :3000, cookie-parser, validation
│       ├── app.module.ts
│       ├── prisma/                   # PrismaService
│       ├── auth/                     # register, login, refresh, sessions, password reset/change
│       ├── users/                    # deleteMe, user-to-user bans
│       ├── mail/                     # SMTP transport (Mailpit in dev)
│       ├── rooms/                    # create, list, update, delete, join, invite, moderation
│       ├── messages/                 # history endpoint; send/edit/delete live in gateway
│       ├── personal-chats/           # 1:1 chat creation (local + by-jid); listing
│       ├── attachments/              # multipart upload + authenticated download
│       ├── xmpp/                     # XMPP federation bridge (phase 10)
│       │   ├── xmpp.config.ts
│       │   ├── xmpp-bridge.service.ts
│       │   ├── xmpp-inbound.service.ts
│       │   ├── xmpp-stats.service.ts
│       │   └── xmpp-admin.controller.ts
│       └── chat/                     # Socket.IO gateway + presence service
│
├── client/                           # React SPA served by nginx
│   ├── Dockerfile                    # builds vite bundle, nginx proxies /api + /socket.io
│   ├── nginx.conf                    # SPA fallback, proxy to server:3000, 25 MB body limit
│   └── src/
│       ├── main.tsx · App.tsx
│       ├── pages/                    # LoginPage, RegisterPage, ForgotPasswordPage,
│       │                             #   ResetPasswordPage, ChatPage, AdminPage
│       ├── components/               # Modal, RoomSidebar, MessageList, MessageInput,
│       │                             #   MemberPanel, ContactsPanel, ManageRoomModal,
│       │                             #   CreateRoomModal, PublicRoomsModal, ProfileModal,
│       │                             #   AttachmentView, icons, AuthCard, ProtectedRoute, ...
│       ├── lib/                      # api, auth, rooms, friends, personal-chats,
│       │                             #   attachments, profile, socket, admin
│       └── store/                    # auth, rooms, presence, theme (Zustand)
│
├── prosody/                          # XMPP sidecar (Prosody 13 on Debian trixie)
│   ├── Dockerfile
│   ├── entrypoint.sh                 # Generates per-domain self-signed certs on first boot
│   └── prosody.cfg.lua               # VirtualHost + bridge component + MUC + s2s
│
└── loadtest/                         # Federation load harness
    ├── federation-loadtest.mjs
    ├── package.json
    └── README.md
```

---

## 4. Data Model (Prisma)

All UUIDs. Naming maps snake_case tables to PascalCase models via `@@map`.

| Model                 | Purpose                                              | Key fields / notes                                                              |
|-----------------------|------------------------------------------------------|---------------------------------------------------------------------------------|
| `User`                | Local account or remote shadow                       | username unique; email/passwordHash nullable (null for remote shadows); `isRemote`, `xmppJid`, `remoteDomain` federation fields |
| `Session`             | Refresh-token-backed session                         | refreshToken (unique), ip, userAgent, expiresAt                                 |
| `PasswordResetToken`  | One-shot reset link                                  | tokenHash, expiresAt, usedAt                                                    |
| `Room`                | Chat room (public/private or personal DM)            | name unique, visibility, isPersonal, ownerId (null for DMs); optional `xmppMucJid` for federated MUC mirror |
| `RoomMember`          | Membership + role + read marker                      | roles: owner/admin/member, lastReadAt                                           |
| `RoomBan`             | Room-level ban list                                  | roomId+userId unique, bannedById                                                |
| `Message`             | Chat message                                         | content (≤3 KB), replyToId, editedAt, indexed by (roomId, createdAt)            |
| `Attachment`          | File or image tied to a message (or orphan upload)   | messageId nullable, roomId, mimetype, size, storagePath, comment                |
| `Friendship`          | Friend request / accepted pair                       | requesterId+addresseeId unique, status (pending/accepted), optional message     |
| `UserBan`             | User-to-user block                                   | blockerId+blockedId unique                                                       |
| `FederationPeer`      | Per-domain XMPP traffic stats                        | domain unique, firstSeenAt/lastSeenAt, stanzasIn/stanzasOut counters             |

Key decision: **DMs are rooms with `isPersonal=true` and exactly two `RoomMember` rows**. This unifies the messaging path (same WebSocket events, same attachments, same history endpoint).

---

## 5. HTTP API

All routes under `/api`. JWT access token in `Authorization: Bearer …`; refresh token lives in the `parley_refresh` httpOnly cookie scoped to `/api/auth`.

### Auth (`/api/auth`)
- `POST register` — email, username, password → access token + user
- `POST login` — email + password → access + refresh cookie
- `POST refresh` — reads cookie, rotates refresh token
- `POST logout` — invalidates current refresh token
- `POST forgot-password` — emails reset link via SMTP (Mailpit in dev)
- `POST reset-password` — consumes token, sets password
- `GET  me` — current user profile
- `PATCH change-password` — requires current password
- `GET  sessions` — list active sessions
- `DELETE sessions/:id` — revoke a session

### Users (`/api/users`)
- `DELETE me` — delete account (cascades: owned rooms, messages, attachments, memberships)
- `POST   ban/:userId` — user-to-user block (also removes friendship)
- `DELETE ban/:userId` — unblock
- `GET    bans` — list blocked users

### Rooms (`/api/rooms`)
- `POST   /` — create room
- `GET    /` — list caller's rooms (excludes DMs)
- `GET    /public` — searchable public catalog
- `GET    /:id` — room detail
- `PATCH  /:id` — update (owner only)
- `DELETE /:id` — delete (owner only; removes attachments from disk)
- `POST   /:id/join` · `POST /:id/leave` · `POST /:id/invite`
- `GET    /:id/members`
- `POST/DELETE /:id/admins/:userId` — owner only
- `POST/DELETE /:id/ban/:userId` · `GET /:id/bans` — owner/admin
- `DELETE /:id/members/:userId` — kick (= ban, owner/admin)

### Messages (`/api/rooms/:roomId/messages`)
- `GET /` — cursor-based history, page size 50, max 100. Live send/edit/delete run over the socket.

### Personal chats (`/api/personal-chats`)
- `GET  /` — DMs with partner info + `frozen` / `frozenByMe` flags
- `POST /:userId` — open or create DM with a local user; requires mutual friendship and no active bans
- `POST /by-jid` — open or create DM with a remote XMPP JID (e.g. `alice@other.example`). Upserts a shadow `User` (`isRemote=true`), creates the personal room, and bypasses the friendship requirement for federated recipients.

### Federation admin (`/api/admin/xmpp`)
All endpoints require an authenticated JWT.
- `GET /stats` — bridge connection state, stanza counters (in/out + bytes), uptime, reconnects, last 50 errors, per-peer live counters
- `GET /sessions` — passthrough to Prosody's admin HTTP endpoint (may report `available: false` if the Prosody build omits mod_admin_rest)
- `GET /federation` — merged view of persisted `FederationPeer` rows and live in-memory per-peer counters

### Friends (`/api/friends`)
- `GET    /` — friends with ids
- `GET    /requests` — incoming + outgoing pending
- `POST   /request` — send request by username
- `POST   /accept/:id` · `DELETE /reject/:id` · `DELETE /:userId`

### Attachments (`/api/attachments`)
- `POST /upload` — multipart, `file` field + `roomId` + optional `comment`. Enforces 20 MB (file) / 3 MB (image).
- `GET  /:id/download` — auth'd stream; verifies current room membership.

---

## 6. WebSocket Protocol

Single Socket.IO namespace. Handshake sends JWT in `auth.token`. On connect the gateway:
1. Verifies token, looks up user.
2. Joins `user:<userId>` and `room:<roomId>` for every membership (including DMs).
3. Emits `unread:init` with counts per room.
4. Broadcasts presence change if the user was previously offline.

### Client → Server
| Event              | Payload                                                         | Purpose                              |
|--------------------|-----------------------------------------------------------------|--------------------------------------|
| `presence:activity`| —                                                               | Keep user "online" (vs AFK)          |
| `presence:getRoom` | `{ roomId }`                                                    | Fetch bulk presence for a room       |
| `message:send`     | `{ roomId, content, replyToId?, attachmentIds? }`               | Create message, broadcast            |
| `message:edit`     | `{ messageId, content, roomId }`                                | Edit own message                     |
| `message:delete`   | `{ messageId, roomId }`                                         | Author or admin delete               |
| `room:join`        | `{ roomId }`                                                    | Re-join a socket.io room (e.g. new DM)|
| `room:leave`       | `{ roomId }`                                                    | Leave socket.io room                  |
| `room:markRead`    | `{ roomId }`                                                    | Advance `lastReadAt`                  |

### Server → Client
| Event              | Payload                                                         |
|--------------------|-----------------------------------------------------------------|
| `message:new`      | Full message (with replyTo + attachments)                       |
| `message:edited`   | Full message                                                    |
| `message:deleted`  | `{ messageId, roomId }`                                         |
| `presence:update`  | `{ userId, status: 'online' \| 'afk' \| 'offline' }`            |
| `unread:init`      | `Record<roomId, number>`                                        |
| `unread:bump`      | `{ roomId }` (to everyone except sender)                        |

Presence is tracked in-memory (`ChatModule.PresenceService`) — fine at 300 users, no Redis needed.

---

## 7. Frontend Architecture

- **Routing**: React Router guards protected routes via `ProtectedRoute` + `bootstrapSession()` on mount.
- **Auth flow**: `lib/auth.ts` talks to `/api/auth`; access token lives in Zustand. `api.ts` auto-refreshes on 401 using the cookie.
- **Socket lifecycle**: `lib/socket.ts` builds one `io()` instance with the current token, installs presence/unread listeners, and wires activity tracking (mousemove/keydown/scroll/focus → `presence:activity` ping every 30 s if active in the last minute).
- **State stores**:
  - `store/auth.ts` — current user + access token
  - `store/rooms.ts` — `rooms`, `personalChats`, `selectedId`; `refresh()` loads both lists in parallel
  - `store/presence.ts` — per-user statuses + per-room unread counts
  - `store/theme.ts` — theme toggle
- **Main UI (`ChatPage`)**:
  - `RoomSidebar` — Public / Private / Direct messages sections with unread badges and presence dots for DMs
  - Center pane switches between regular-room view (header + Manage button + MemberPanel on the right) and DM view (partner header, frozen banner when blocked)
  - `MessageList` handles history fetch, infinite scroll, live updates, per-message actions
  - `MessageInput` supports text (Enter to send), replies, edits, attachment button, paste-to-upload; it uploads via `/api/attachments/upload` first and sends `attachmentIds` on `message:send`
  - `AttachmentView` renders inline image previews (via blob URL to keep auth) or file cards with download
  - `ContactsPanel` — friends / requests / add tabs, plus **Message** button to open DM
  - `ProfileModal` — Password / Sessions / Blocked / Danger (delete account) tabs
  - `ManageRoomModal` — Members / Admins / Banned / Invitations / Settings tabs (regular rooms only)

---

## 8. Feature Status vs Requirements

Cross-check against `INSTRUCTIONS.md`. Status markers: `[done]`, `[partial]`, `[missing]`.

### 2.1 Accounts & auth
- [done] Registration (email / username / password), uniqueness, username immutable
- [done] Sign in / sign out (single-session logout)
- [done] Persistent login (refresh cookie)
- [done] Password reset via email + change-password for logged-in users
- [done] Bcrypt hashing
- [done] Delete account, owned rooms cascade, memberships removed

### 2.2 Presence & sessions
- [done] online / AFK / offline statuses, multi-tab aware (presence service aggregates sockets per user)
- [done] AFK at 1 min of inactivity across all tabs
- [done] Active sessions list + per-session revoke

### 2.3 Contacts / friends
- [done] Friend list with presence
- [done] Send / accept / reject requests by username, optional message
- [done] Remove friend
- [done] User-to-user ban, removes friendship, freezes existing DMs (new sends blocked)
- [done] Personal messaging only between friends with no active ban

### 2.4 Rooms
- [done] Create, name/description/visibility, owner/admin/member roles
- [done] Public catalog with search + member count
- [done] Private rooms invisible, invitation-only
- [done] Join / leave (owner can only delete)
- [done] Room delete removes messages **and** files on disk
- [done] Admin actions: delete messages, ban / kick members, manage admins (owner only)

### 2.5 Messaging
- [done] Text, multiline, emoji, attachments, reply-to
- [done] 3 KB text limit, UTF-8
- [done] Edit own, admin/owner delete
- [done] History with infinite scroll (cursor-based)
- [done] Persisted — offline users see messages on next open
- [done] Personal chats share the same message pipeline

### 2.6 Attachments
- [done] Images + arbitrary files
- [done] Upload via button and paste
- [done] Original filename preserved, optional comment
- [done] Access-controlled download (membership check)
- [done] 20 MB file / 3 MB image limit
- [done] Files removed when their room is deleted

### 2.7 Notifications
- [done] Unread badges on rooms and DMs (cleared on open via `room:markRead`)
- [done] Pending-friend-requests badge on Contacts button
- [done] Low-latency presence (in-memory, socket broadcast)

### 4 UI
- [done] Top masthead with profile dropdown, contacts, theme toggle
- [done] Sidebar with public/private/DM sections, accordion
- [done] Chat window with auto-scroll-when-at-bottom + infinite scroll
- [done] Multiline input, emoji, attach, reply
- [done] Admin actions via modal dialogs

### 6 Advanced (optional)
- [done] XMPP / Jabber federation — Prosody sidecar, component bridge, s2s dialback, cross-server DMs, admin dashboard, load test harness (see §12)

---

## 9. Implementation Phase Status (`PLAN.MD`)

| Phase                              | Status    | Notes                                                                 |
|------------------------------------|-----------|-----------------------------------------------------------------------|
| 1 — Scaffolding & infra            | Done      | Docker, Prisma schema + migrations, workspace set up                  |
| 2 — Auth & user management         | Done      | Register/login/refresh/logout, sessions, password reset/change, delete|
| 3 — Chat rooms                     | Done      | CRUD, membership, moderation, UI                                      |
| 4.1–4.2 — Messaging CRUD + features| Done      | Send/edit/delete over WS, history endpoint, reply, edited indicator   |
| 4.3 — Personal messaging           | Done      | `personal-chats` module + DM sidebar + frozen banner                  |
| 4.4 — Chat UI                      | Done      | Input, message rendering, replies, edits, infinite scroll             |
| 5 — Real-time & presence           | Done      | Socket.IO, JWT handshake, presence + unread tracking                  |
| 6 — Contacts & friends             | Done      | Friend requests, user-to-user ban                                     |
| 7 — File & image attachments       | Done      | Upload, download, limits, inline previews, room-delete cleanup        |
| 8 — Notifications & polish         | Done      | Unread badges, profile menu, optimistic send + retry, skeleton loaders|
| 9 — Docker & deployment polish     | Done      | `docker compose up` brings everything up healthy; migrations auto-apply; `.env.example` documents all vars |
| 10 — XMPP federation (optional)    | Done      | Prosody sidecar + NestJS `xmpp` module, cross-server DMs, admin dashboard at `/admin`, `docker-compose.federation.yml` two-stack harness, `loadtest/` Node driver |

### Phase 8 detail
- **Optimistic sending / retry** — `MessageInput` inserts a pending message via `store/pending.ts`, then calls `sendMessageWithRetry` which uses Socket.IO ack with an 8 s timeout. On success the pending entry is dropped (replaced by `message:new` broadcast). On timeout or server error it flips to `failed` with retry/discard controls.
- **Skeleton loaders** — `MessageList` renders animated pulse rows on initial history load.

---

## 10. Running the Project

```bash
docker compose up -d --build
```

Services:
- `db` — PostgreSQL 16, exposed on 5432 (dev only)
- `mailhog` — Mailpit UI on http://localhost:8025 (catches reset emails)
- `prosody` — XMPP sidecar (c2s 5222, s2s 5269, component 5347, HTTP 5280); bridges to the server via XEP-0114
- `server` — NestJS on internal :3000, runs `prisma migrate deploy` at boot, connects to Prosody as the `bridge.<domain>` component
- `client` — nginx on http://localhost:8080, proxies `/api` and `/socket.io` to server

Useful env vars (see `docker-compose.yml`):
- `JWT_SECRET`, `APP_URL`, `SMTP_*`, `MAIL_FROM`, `FILES_DIR`, `PARLEY_PORT`
- `XMPP_ENABLED`, `XMPP_DOMAIN`, `XMPP_COMPONENT_HOST/PORT/DOMAIN/SECRET`, `XMPP_MUC_DOMAIN`, `XMPP_PEER_DOMAIN`

Filesystem: uploads live in the `uploads` named volume at `/var/parley/files`; Postgres data in `pgdata`; Prosody state (certs, offline queues) in `prosodydata`.

---

## 11. Open Questions / Future Work

- Token refresh-aware socket re-auth if access token rotates mid-connection
- Prisma connection pool sizing and per-stanza batching — the XMPP inbound pipeline tops out around 30–40 msg/s per server with defaults; the pool (default 10 conns) is the bottleneck
- Structured logging + metrics — the XMPP bridge emits `XmppStatsService` counters but there is no Prometheus exporter; Prosody ships `/metrics` via `mod_http_openmetrics` on :5280
- Rate limiting on friend requests, message send, upload endpoints
- XMPP MUC (groupchat) federation is wired outbound-only; inbound groupchat is parsed but depends on remote MUC rooms existing on the peer's MUC component

---

## 12. XMPP Federation (Phase 10)

### Topology

```
Parley instance A                              Parley instance B
 ┌────────────────────┐                         ┌────────────────────┐
 │ NestJS server      │◄───XEP-0114 component──►│ Prosody 13         │
 │   xmpp/ module     │                         │  conference.*      │
 │   @xmpp/component  │                         │  bridge.*          │
 └────────┬───────────┘                         └────────┬───────────┘
          │                                              │
          │                                              │
          ▼                                              │
   Prosody 13                                            │
    conference.*                                         │
    bridge.*                                             │
        │                                                │
        └──────────── s2s dialback (5269) ───────────────┘
```

### Module layout (`server/src/xmpp/`)

- `xmpp.config.ts` — reads `XMPP_*` env vars into a typed, injectable config. Helpers: `localJid(username)` → `user@parley.local`, `componentJid(username)` → `user@bridge.parley.local`, `routeViaPeerBridge(jid)` rewrites a bare user JID to `user@bridge.<domain>` so the peer's bridge intercepts.
- `xmpp-bridge.service.ts` — `OnModuleInit` dynamically imports `@xmpp/component` (ESM), opens the connection to Prosody, handles reconnect, exposes `sendDm` / `sendLocalDm` / `sendMuc`, and pipes inbound stanzas into `XmppInboundService`. Outbound stanzas carry `urn:xmpp:hints/no-store` + `no-permanent-store` so Prosody doesn't shadow Parley's message history.
- `xmpp-inbound.service.ts` — resolves (or upserts) a shadow `User` for the remote sender (or finds the local user when the sender is on this server's VirtualHost), find-or-creates the personal room, persists a `Message`, then calls the chat broadcaster. DB writes use `upsert` + catch/reread to be idempotent under concurrent stanzas.
- `xmpp-stats.service.ts` — in-memory counters (stanzas in/out, bytes, reconnect count, ring-buffer of the last 50 errors, per-peer totals).
- `xmpp-admin.controller.ts` — `/api/admin/xmpp/{stats,sessions,federation}` guarded by `JwtAuthGuard`. `sessions` proxies Prosody's `mod_parley_admin` HTTP endpoint.
- `xmpp-auth.controller.ts` — `POST /api/xmpp/auth` called by Prosody's `mod_auth_parley` on each SASL PLAIN attempt. Requires `X-Parley-Bridge-Secret` header matching `XMPP_COMPONENT_SECRET`; rejects remote shadow rows; bcrypt-compares against `passwordHash`.

### Prosody custom modules (`prosody/`)

- `mod_auth_parley.lua` — HTTP-backed auth provider. Prosody invokes `test_password(username, password)` on every SASL PLAIN; the module POSTs to `parley_auth_url` with the bridge secret and returns 200 → success, 401 → reject. No user accounts stored in Prosody — authentication is dynamic.
- `mod_parley_forward.lua` — per-session `stanzas/in` filter attached on `authentication-success`. When a c2s Jabber client submits a `<message type="chat">` with a body and a local-domain recipient, the module clones the stanza with the `to` rewritten to `<recipient>@bridge.<host>` and submits the clone through normal routing. The bridge component receives it and the inbound handler persists + broadcasts. The original stanza still flows through unchanged to any online c2s sessions of the recipient. **Gotcha**: Prosody stanzas use `.attr` (singular), not `.attrs` — the attribute reader on the Lua side has a different name than on the `@xmpp/xml` Node side.
- `mod_parley_admin.lua` — tiny HTTP module exposing `GET /parley_admin/sessions` returning a JSON `{count, sessions:[...]}` of every active c2s session (jid, username, resource, ip, tls flag, connect time). Bearer-token auth reuses `parley_auth_secret`. Replaces the upstream-removed `mod_admin_rest`.

### Addressing

Prosody's component security (XEP-0114) enforces that a component only sends stanzas from JIDs within its own domain. The bridge therefore:

- **Outbound (remote recipient)**: emits `<message from="alice@bridge.parley-a.local" to="bob@bridge.parley-b.local">`. The `to` is built by `routeViaPeerBridge` from the stored `xmppJid` on the remote user row.
- **Outbound (local recipient on a Jabber client)**: emits `<message from="alice@bridge.parley-a.local" to="bob@parley-a.local">` (`sendLocalDm`). Prosody routes to Bob's c2s session(s) if any; if Bob is only on the web UI, Parley has already broadcast to his Socket.IO sockets directly.
- **Inbound**: strips the `bridge.` prefix off the `from` domain when resolving the shadow user, so the canonical stored `xmppJid` is `alice@parley-a.local`.

### Jabber-client c2s auth flow

```
Jabber client (Beagle / Monal / Gajim / @xmpp/client)
    |
    | SASL PLAIN: <auth>base64(\0username\0password)</auth>
    v
Prosody c2s module
    |
    | mod_auth_parley.test_password(username, password)
    v
HTTP POST http://server:3000/api/xmpp/auth
  headers: X-Parley-Bridge-Secret: <XMPP_COMPONENT_SECRET>
  body: { username, password }
    |
    v
NestJS XmppAuthController
    |
    | bcrypt.compare vs User.passwordHash
    v
200 ok=true  or  401 invalid credentials
    |
    v
Prosody sends <success/> (if ok) or <failure><not-authorized/></failure>
```

### Jabber-client <-> Parley web message flow

- **Web sends, Jabber receives**: `ChatGateway.onSend` persists a `Message` and calls `publishToXmpp`. For local recipients, `XmppBridgeService.sendLocalDm` emits a stanza `from <user>@bridge.<host>` to `<recipient>@<host>`. Prosody routes to the recipient's c2s Jabber session.
- **Jabber sends, Web receives**: the client's c2s session hits `mod_parley_forward`'s `stanzas/in` filter. The module clones the stanza with `to = <recipient>@bridge.<host>` and sends. The bridge component's inbound pipeline (`XmppInboundService.handle`) persists the `Message` and the chat broadcaster emits via the recipient's `user:<id>` Socket.IO channel. The original stanza continues through normal Prosody routing so any recipient c2s sessions also receive it.
- **Jabber sends to Jabber (same server)**: handled natively by Prosody c2s routing. Parley's bridge duplicates and persists in parallel so the web UI stays in sync.
- **Jabber sends to remote Jabber (cross-server)**: c2s → Prosody-A → s2s → Prosody-B → delivery. Parley doesn't persist these on either side (future improvement: hook the forward module for cross-domain targets).

### Chat gateway integration

`ChatGateway.onModuleInit` registers a broadcaster with `XmppInboundService`. On inbound, the broadcaster:

1. Looks up the Socket.IO sockets in each room-member's `user:<id>` personal channel (always joined at connect time).
2. Pulls each socket into the `room:<roomId>` Socket.IO room if not already there (federated inbound can materialize a room after the recipient's socket already connected).
3. Emits `message:new` once per socket, deduping across multiple members.

### Prosody configuration

`prosody/prosody.cfg.lua` (loaded via env var substitution in `entrypoint.sh`) defines:

- `VirtualHost "<XMPP_DOMAIN>"` — internal_hashed auth, registration disabled (Parley does not provision c2s accounts)
- `Component "bridge.<XMPP_DOMAIN>"` — external component, `component_secret = <XMPP_COMPONENT_SECRET>`
- `Component "conference.<XMPP_DOMAIN>" "muc"` — MUC service with `muc_mam`
- `ssl` with `verify = "none"` and `@SECLEVEL=0` ciphers (dev only — replace for production)
- `s2s_insecure_domains` allow-list populated from `XMPP_PEER_DOMAIN` (dev shortcut)

Certs are generated per-domain on first boot via `openssl req -x509 …` in `entrypoint.sh`. In production, replace with a real keypair mounted at `/var/lib/prosody/certs/<domain>.{crt,key}` and tighten `ssl.verify`.

### Federation compose harness (`docker-compose.federation.yml`)

Brings up two parallel stacks (`*-a` on :8080, `*-b` on :8081). Each stack has its own private Docker network (`stack-a`, `stack-b`) where `server-X` is aliased as `server` so the existing nginx `proxy_pass http://server:3000` config works unmodified. A third bridge network (`fednet`) links the two Prosody containers with aliases for `parley-X.local`, `bridge.parley-X.local`, and `conference.parley-X.local`, so s2s dialback resolves peer domains without external DNS.

### Load test (`loadtest/federation-loadtest.mjs`)

Node script that:

1. Seeds `--count` users on each side via `POST /api/auth/register` + `/login`
2. Polls `/api/admin/xmpp/stats` on both sides until `connected: true`
3. Provisions `--count` cross-server personal rooms via `POST /api/personal-chats/by-jid`
4. Opens a Socket.IO connection for every user, subscribes to `message:new` on the B side
5. Fires `--count × --messages` DMs A→B and records send vs receive timestamps
6. Prints throughput, errors, and p50/p95/p99 latency

Moderate scale (10 users × 20 messages) delivers 200/200 with p95 under one second. Heavy scale (50 × 100) demonstrates the pipeline end-to-end but bottlenecks on Prisma's default 10-connection pool before all messages clear.
