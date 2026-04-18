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
                        |   REST + WS       |
                        +---+-------+---+---+
                            |       |   |
                +-----------+   +---+   +-----------+
                |               |                   |
       +--------v-----+ +------v------+  +---------v--------+
       | PostgreSQL 16 | | Mailpit     |  | Local Filesystem |
       | (pgdata vol)  | | (SMTP trap) |  | (uploads vol)    |
       +---------------+ +-------------+  +------------------+
```

## Docker Compose Services

| Service | Image | Internal Port | Exposed Port | Purpose |
|---------|-------|---------------|--------------|---------|
| `db` | `postgres:16-alpine` | 5432 | 5432 | Primary data store |
| `mailhog` | `axllent/mailpit` | 1025 (SMTP), 8025 (UI) | 8025 | Dev email capture |
| `server` | Custom (Node 20) | 3000 | - (proxied) | API + WebSocket server |
| `client` | Custom (nginx) | 80 | 8080 | SPA + reverse proxy |

**Startup order:** `db` (health check) -> `mailhog` -> `server` (health check) -> `client`

**Volumes:**
- `pgdata` — PostgreSQL data directory
- `uploads` — User-uploaded files and images

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
  +-- ChatModule              -- Socket.IO gateway, presence tracking
        +-- depends on: MessagesModule, RoomsModule
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
        +-- ChatPage
              |
              +-- Header (Logo, Contacts button, ThemeToggle, user menu)
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
```

**Key design decisions:**
- Personal DMs are rooms with `isPersonal = true` and exactly 2 members
- `RoomMember.lastReadAt` tracks unread state per user per room
- `RoomMember.role` enum: `owner | admin | member`
- Room bans include `bannedById` to track who issued the ban
- User bans auto-remove friendships on creation
- Messages indexed on `[roomId, createdAt]` for efficient history queries
- Cursor-based pagination using `id` as cursor for infinite scroll

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
| POST | /:userId | Open / get DM with user |

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
