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
| Frontend       | React 18, Vite, TypeScript                   |
| Client state   | Zustand                                      |
| Styling        | Tailwind CSS, custom design tokens           |
| File storage   | Local filesystem, Docker volume              |
| Password hash  | bcrypt                                       |
| Orchestration  | Docker Compose                               |

---

## 3. Repository Layout

```
parley/
├── docker-compose.yml          # db + mailpit + server + client
├── INSTRUCTIONS.md             # product requirements
├── PLAN.MD                     # phased implementation plan
├── DOCS.md                     # this file
├── README.md
│
├── server/                     # NestJS backend
│   ├── Dockerfile              # multi-stage, runs `prisma migrate deploy` at boot
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── main.ts             # bootstraps HTTP on :3000, cookie-parser, validation
│       ├── app.module.ts
│       ├── prisma/             # PrismaService
│       ├── auth/               # register, login, refresh, sessions, password reset/change
│       ├── users/              # deleteMe, user-to-user bans
│       ├── mail/               # SMTP transport (Mailpit in dev)
│       ├── rooms/              # create, list, update, delete, join, invite, moderation
│       ├── messages/           # history endpoint; send/edit/delete live in gateway
│       ├── personal-chats/     # 1:1 chat creation + listing (rooms with isPersonal=true)
│       ├── attachments/        # multipart upload + authenticated download
│       └── chat/               # Socket.IO gateway + presence service
│
└── client/                     # React SPA served by nginx
    ├── Dockerfile              # builds vite bundle, nginx proxies /api + /socket.io
    ├── nginx.conf              # SPA fallback, proxy to server:3000, 25 MB body limit
    └── src/
        ├── main.tsx · App.tsx
        ├── pages/              # LoginPage, RegisterPage, ForgotPasswordPage,
        │                       #   ResetPasswordPage, ChatPage
        ├── components/         # Modal, RoomSidebar, MessageList, MessageInput,
        │                       #   MemberPanel, ContactsPanel, ManageRoomModal,
        │                       #   CreateRoomModal, PublicRoomsModal, ProfileModal,
        │                       #   AttachmentView, icons, AuthCard, ProtectedRoute, ...
        ├── lib/                # api, auth, rooms, friends, personal-chats,
        │                       #   attachments, profile, socket
        └── store/              # auth, rooms, presence, theme (Zustand)
```

---

## 4. Data Model (Prisma)

All UUIDs. Naming maps snake_case tables to PascalCase models via `@@map`.

| Model                 | Purpose                                              | Key fields / notes                                                              |
|-----------------------|------------------------------------------------------|---------------------------------------------------------------------------------|
| `User`                | Account                                              | email/username unique, passwordHash, createdAt                                  |
| `Session`             | Refresh-token-backed session                         | refreshToken (unique), ip, userAgent, expiresAt                                 |
| `PasswordResetToken`  | One-shot reset link                                  | tokenHash, expiresAt, usedAt                                                    |
| `Room`                | Chat room (public/private or personal DM)            | name unique, visibility, isPersonal, ownerId (null for DMs)                     |
| `RoomMember`          | Membership + role + read marker                      | roles: owner/admin/member, lastReadAt                                           |
| `RoomBan`             | Room-level ban list                                  | roomId+userId unique, bannedById                                                |
| `Message`             | Chat message                                         | content (≤3 KB), replyToId, editedAt, indexed by (roomId, createdAt)            |
| `Attachment`          | File or image tied to a message (or orphan upload)   | messageId nullable, roomId, mimetype, size, storagePath, comment                |
| `Friendship`          | Friend request / accepted pair                       | requesterId+addresseeId unique, status (pending/accepted), optional message     |
| `UserBan`             | User-to-user block                                   | blockerId+blockedId unique                                                       |

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
- `POST /:userId` — open or create DM; requires mutual friendship and no active bans

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
- [missing] XMPP / Jabber federation — not implemented (phase 10 optional)

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
| 10 — XMPP federation (optional)    | Not done  | Optional scope, not started                                           |

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
- `server` — NestJS on internal :3000, runs `prisma migrate deploy` at boot
- `client` — nginx on http://localhost:8080, proxies `/api` and `/socket.io` to server

Useful env vars (see `docker-compose.yml`):
- `JWT_SECRET`, `APP_URL`, `SMTP_*`, `MAIL_FROM`, `FILES_DIR`, `PARLEY_PORT`.

Filesystem: uploads live in the `uploads` named volume at `/var/parley/files`; Postgres data in `pgdata`.

---

## 11. Open Questions / Future Work

- Token refresh-aware socket re-auth if access token rotates mid-connection
- XMPP federation (phase 10) — large scope; would likely use Prosody/ejabberd as a sidecar
- Observability — no structured logging or metrics yet
- Rate limiting on friend requests, message send, upload endpoints
