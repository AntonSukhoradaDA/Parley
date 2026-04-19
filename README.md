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
- [XMPP Federation](#xmpp-federation)
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
2. Build the server (NestJS), client (React + nginx), and Prosody (XMPP) images
3. Start all 5 services
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
| XMPP c2s | localhost:5222 | Prosody client-to-server port (reserved for federation) |
| XMPP s2s | localhost:5269 | Prosody server-to-server port (reserved for federation) |
| Federation dashboard | http://localhost:8080/admin | XMPP bridge stats, peers, recent errors (requires sign-in) |

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

### Theming and i18n
- Three-way theme switcher: Light / System / Dark (system follows `prefers-color-scheme`)
- Internationalization via `i18next` with three languages: English, French, Spanish
- Language auto-detects from browser on first visit, persists in `localStorage`, exposed via a switcher in every page header
- `<html lang>` syncs to the active language automatically

### XMPP Federation
- Prosody sidecar speaks XEP-0114 with the NestJS server acting as an external component bridge
- **Jabber-client c2s login**: users sign into any third-party XMPP client (Beagle IM, Monal, Gajim, Conversations, Dino, Psi...) as `<parley-username>@<domain>` with their Parley password. Auth runs through `mod_auth_parley`, which POSTs SASL attempts to the Parley server for bcrypt verification - no separate account provisioning in Prosody
- **Two-way message bridging**: messages sent from the Parley web UI fan out to any online Jabber-client session; messages sent from a Jabber client are duplicated via `mod_parley_forward` to the bridge component, persisted as Parley `Message` rows, and broadcast over Socket.IO to the recipient's web UI
- Cross-server DMs: any Parley user can message `alice@other-parley.local` via `POST /api/personal-chats/by-jid`; a shadow remote `User` row is auto-provisioned on first contact
- Server-to-server (s2s) dialback between peers, per-domain self-signed certs generated at container start
- Federation admin dashboard at `/admin` shows bridge status, stanzas in/out, per-peer traffic, recent errors, and a live list of connected Jabber clients (JID, IP, TLS, connect time) via `mod_parley_admin`
- `docker-compose.federation.yml` harness spins up two full stacks (A and B) on the same host for local cross-server testing
- Node-based load harness (`loadtest/federation-loadtest.mjs`) seeds users, provisions cross-server rooms, and reports p50/p95/p99 latency
- Bundled smoke tests: `loadtest/c2s-login-test.mjs` (auth + online roundtrip) and `loadtest/c2s-bridge-test.mjs` (web↔Jabber end-to-end message flow)

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
| **i18n** | i18next + react-i18next | 26 / 17 |
| **Lint / Format** | ESLint 9 (flat config) + Prettier 3 | |
| **Containerization** | Docker + Docker Compose | |
| **Web Server** | nginx (SPA + reverse proxy) | alpine |
| **Federation** | Prosody (XMPP) + `@xmpp/component` bridge | Prosody 13 (Debian trixie) |

---

## Project Structure

```
parley/
  client/                          # Frontend (React SPA)
    src/
      components/                  # UI components
        ui/                        #   Shared design-system primitives
          Avatar.tsx               #     Initial-letter avatar (xs/sm/md/lg)
          Badge.tsx                #     Accent count pill for unread indicators
          PresenceDot.tsx          #     Online/AFK/offline status dot
          SearchInput.tsx          #     Bordered search field with leading icon
          index.ts                 #     Barrel export
        icons.tsx                  #   All shared SVG icons
        AttachmentView.tsx         #   File/image attachment display
        AuthCard.tsx               #   Auth page atmospheric split-panel
        ContactsPanel.tsx          #   Friends list, requests, add friend (drawer)
        CreateRoomModal.tsx        #   Create room form
        LanguageSwitcher.tsx       #   EN / FR / ES dropdown
        Logo.tsx                   #   Logo mark + serif wordmark
        ManageRoomModal.tsx        #   Room management (members, admins, bans, invites, settings)
        MemberPanel.tsx            #   Right-side context panel (collapsible)
        MessageInput.tsx           #   Message composer (text, reply, edit, attach)
        MessageList.tsx            #   Scrollable message feed with infinite scroll
        Modal.tsx                  #   Reusable modal / drawer shell
        PrivateRoomsModal.tsx      #   Browse your joined private rooms
        ProfileModal.tsx           #   Password, sessions, blocked users, delete account
        ProtectedRoute.tsx         #   Auth route guards
        PublicRoomsModal.tsx       #   Browse + join public rooms
        RoomSidebar.tsx            #   Left sidebar (rooms, contacts, unread badges, collapsible)
        ThemeToggle.tsx            #   Light / system / dark segmented control
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
        ChatPage.tsx               #   Main chat interface (/chats)
        ForgotPasswordPage.tsx     #   Password reset request
        LandingPage.tsx            #   Public marketing page (/)
        LegalPage.tsx              #   Shared legal page shell
        LoginPage.tsx              #   Sign in
        PrivacyPage.tsx            #   /privacy
        RegisterPage.tsx           #   Create account
        ResetPasswordPage.tsx      #   Set new password (from email link)
        TermsPage.tsx              #   /terms
      i18n/                        # Internationalization
        index.ts                   #   i18next config, language list
        locales/                   #   en.json, fr.json, es.json
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
      xmpp/                        # XMPP federation module (phase 10)
        xmpp.config.ts             #   Env-backed config (domain, component host, secrets)
        xmpp-bridge.service.ts     #   @xmpp/component connection, stanza send/receive
        xmpp-inbound.service.ts    #   Resolves shadow users, persists remote messages
        xmpp-stats.service.ts      #   In-memory stanza + peer counters
        xmpp-admin.controller.ts   #   GET /api/admin/xmpp/{stats,sessions,federation}
        xmpp-auth.controller.ts    #   POST /api/xmpp/auth (c2s SASL callback for Prosody)
        xmpp-shims.d.ts            #   Ambient declarations for @xmpp/* ESM packages
        xmpp.module.ts
      app.module.ts                # Root module (imports all feature modules)
      main.ts                      # Bootstrap (port, prefix, validation pipe)
    prisma/
      schema.prisma                # Database schema (11 models, incl. FederationPeer)
      migrations/                  # Auto-generated SQL migrations
    Dockerfile                     # Multi-stage: build -> production node

  prosody/                         # XMPP sidecar (Prosody 13)
    Dockerfile                     # Debian trixie + prosody + openssl
    entrypoint.sh                  # Generates per-domain self-signed certs on first boot
    prosody.cfg.lua                # VirtualHost + bridge component + MUC + s2s config
    mod_auth_parley.lua            # HTTP-backed SASL auth: calls /api/xmpp/auth on each c2s login
    mod_parley_forward.lua         # Duplicates c2s-originated chats to the bridge component
    mod_parley_admin.lua           # GET /parley_admin/sessions -- live c2s session list

  loadtest/                        # Federation load-test harness
    federation-loadtest.mjs        # socket.io-client driver; reports p50/p95/p99 latency
    c2s-login-test.mjs             # Single Jabber-client login smoke test (@xmpp/client)
    c2s-bridge-test.mjs            # End-to-end web <-> Jabber message flow test
    package.json
    README.md

  docs/
    architecture.md                # Detailed architecture diagrams and decisions

  docker-compose.yml               # 5-service orchestration (db + mailpit + prosody + server + client)
  docker-compose.federation.yml    # Two-stack harness (a/b) for cross-server federation testing
  .env.example                     # Environment variable template
  INSTRUCTIONS.md                  # Original product requirements
  PLAN.MD                          # Implementation plan (10 phases, all complete)
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
    +---> Prosody (XMPP component bridge via XEP-0114)
              |
              +---> other Parley Prosody (s2s / dialback) for federation
```

### Key Design Decisions

1. **Personal chats as rooms** -- DMs are modeled as rooms with `isPersonal=true` and exactly 2 members. This unifies the messaging code path.

2. **Cursor-based pagination** -- Message history uses cursor-based pagination (`id` as cursor) for efficient infinite scroll over large histories.

3. **In-memory presence** -- At 300 users, presence tracking lives in-memory on the server process via a simple `Map<userId, SocketEntry[]>`. No Redis needed.

4. **JWT with DB-stored refresh tokens** -- Access tokens are stateless (15min TTL). Refresh tokens are stored in the `sessions` table, enabling session listing and per-device revocation with token rotation.

5. **File access control at API level** -- Files stored with UUID names. Downloads go through an authenticated endpoint that verifies room membership.

6. **Socket.IO rooms for broadcasting** -- Each chat room maps to a Socket.IO room. Efficient broadcasting without iterating connected clients.

7. **XMPP as a component bridge, not a gateway** -- Parley doesn't provision c2s accounts on Prosody for every user. The NestJS server speaks to Prosody as an external component (XEP-0114). Outbound stanzas are emitted from `<username>@bridge.<domain>` (Prosody enforces components send only from their own subdomain). Remote senders addressed to `<username>@bridge.<peer-domain>` are delivered via s2s and handed back to the peer's bridge component, which looks up the local user and persists a `Message` row -- broadcasting it over Socket.IO just like a native send.

8. **Shadow users for remote peers** -- Remote XMPP senders are stored as regular `User` rows with `isRemote = true` and a populated `xmppJid`. Login / registration / friend request paths reject rows flagged remote, but message, room-member, and attachment foreign keys all continue to reference `User` without per-call special-casing.

9. **Jabber-client c2s auth reuses Parley's bcrypt hashes** -- instead of duplicating user accounts into Prosody's internal storage, a custom Prosody auth module (`mod_auth_parley`) turns every SASL PLAIN attempt into an HTTP POST to `/api/xmpp/auth`. The server does the same bcrypt compare used by web login. Changing a password on the web instantly propagates to Jabber clients on next reconnect; no sync logic is needed.

10. **c2s -> bridge duplication for two-way message flow** -- `mod_parley_forward` attaches a `stanzas/in` filter to every authenticated c2s session. Each outgoing chat message is cloned with `to=<recipient>@bridge.<domain>` and submitted alongside the original. The bridge component receives the clone through its inbound pipeline, persists a `Message` row, and fans out to the recipient's Socket.IO sockets. The original still flows through normal Prosody routing to any c2s Jabber sessions.

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
| `XMPP_ENABLED` | `true` | Master switch for the XMPP bridge |
| `XMPP_DOMAIN` | `parley.local` | Primary XMPP virtual host (user JIDs are `<username>@$XMPP_DOMAIN`) |
| `XMPP_COMPONENT_HOST` | `prosody` | Prosody hostname the bridge connects to |
| `XMPP_COMPONENT_PORT` | `5347` | Component port (XEP-0114) |
| `XMPP_COMPONENT_DOMAIN` | `bridge.$XMPP_DOMAIN` | JID of the external component |
| `XMPP_COMPONENT_SECRET` | `parley-bridge-secret` | Shared secret with Prosody. **Override in production** |
| `XMPP_MUC_DOMAIN` | `conference.$XMPP_DOMAIN` | MUC service domain (reserved; groupchat federation is opportunistic) |
| `XMPP_PEER_DOMAIN` | (empty) | When set, the peer's domain is allow-listed for insecure s2s in Prosody (dev) |
| `XMPP_C2S_PORT` / `XMPP_S2S_PORT` / `XMPP_ADMIN_REST_PORT` | `5222` / `5269` / `5280` | Host ports exposed by Prosody |
| `PARLEY_AUTH_URL` | `http://server:3000/api/xmpp/auth` | Where Prosody's `mod_auth_parley` POSTs SASL attempts for bcrypt verification |
| `XMPP_ADMIN_REST_URL` | `http://prosody:5280/parley_admin` | Where the server fetches live c2s sessions for the admin dashboard (served by `mod_parley_admin`) |

### Production Checklist

1. Set a strong `JWT_SECRET` (`openssl rand -hex 48`)
2. Set a strong `XMPP_COMPONENT_SECRET` (`openssl rand -hex 32`) or disable federation via `XMPP_ENABLED=false`
3. Point `SMTP_*` at your real SMTP relay
4. Set `APP_URL` to your public domain
5. Replace the per-domain self-signed Prosody certs with a real cert chain if you want s2s with strangers. The dev entrypoint.sh regenerates self-signed certs per domain; for production, mount a proper keypair into `/var/lib/prosody/certs/<domain>.{crt,key}` and set stricter `ssl.verify` in `prosody.cfg.lua`
6. Consider removing the `mailhog` service
7. Remove the `db` port mapping (no need to expose PostgreSQL)

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
npm test                     # Unit tests (includes 100k-message pagination test)
npm run test:e2e             # End-to-end tests
```

### Lint and Format

The client uses ESLint 9 (flat config) and Prettier 3. Prettier settings live in
`client/.prettierrc.json`; ESLint extends `prettier` to avoid conflicts.

```bash
cd client
npm run lint                 # eslint .
npm run format               # prettier --write .
npm run format:check         # prettier --check . (for CI)
```

### Working on Translations

Translation resources live in `client/src/i18n/locales/{en,fr,es}.json`. Keys
are namespaced (`landing.*`, `auth.*`, `chat.*`, `sidebar.*`, `nav.*`,
`common.*`). Add a key to **all three** files; fall back to English is
automatic but untranslated strings will render in English.

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

## XMPP Federation

Federation is shipped as phase 10 of the [PLAN.MD](./PLAN.MD) and is enabled
by default. When `XMPP_ENABLED=true` (default), the NestJS server opens an
XEP-0114 component connection to the Prosody sidecar at startup. Every outbound
message to a remote `User` is also emitted as an XMPP `<message>` stanza; every
inbound stanza from s2s is materialized into a local `Message` row and
broadcast over Socket.IO.

### Federation quick-test (two stacks on one host)

```bash
# Bring the single-node stack down if it's already using :8080
docker compose down

# Bring up side A (:8080) and side B (:8081)
docker compose -f docker-compose.federation.yml up --build
```

Then:

1. Register a user on each side (e.g. `alice` on A, `bob` on B)
2. On A, open the admin menu and click **Federation** to land on `/admin`
3. Start a cross-server DM:
   ```bash
   curl -X POST http://localhost:8080/api/personal-chats/by-jid \
     -H "Authorization: Bearer <alice's access token>" \
     -H 'Content-Type: application/json' \
     -d '{ "jid": "bob@parley-b.local" }'
   ```
   This creates a shadow `User` row for Bob on side A and opens a personal
   chat room between Alice and the shadow.
4. Send a message in that chat from Alice's account; Bob's side B session
   receives `message:new` via its own bridge's inbound path, with the sender
   resolved to a shadow user representing `alice@parley-a.local`.

### Load test

```bash
cd loadtest
npm install
node federation-loadtest.mjs \
  --side-a-url=http://localhost:8080 \
  --side-b-url=http://localhost:8081 \
  --side-a-domain=parley-a.local \
  --side-b-domain=parley-b.local \
  --count=50 --messages=100
```

Seeds `count` users on each side, waits for both bridges to come online,
provisions `count` cross-server rooms via `/api/personal-chats/by-jid`, then
fires `count x messages` cross-server DMs. Output includes throughput and
p50/p95/p99 latency. Moderate load (10 x 20) delivers 100% with sub-second
latency on a laptop; heavy load (50 x 100) exercises Prisma's connection pool
and exposes it as the main bottleneck.

### Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/xmpp/stats` | Bridge state, counters, uptime, recent errors |
| GET | `/api/admin/xmpp/sessions` | Live c2s session list from `mod_parley_admin` (JID, IP, TLS, connect time) |
| GET | `/api/admin/xmpp/federation` | Per-peer stanza totals, merged with persisted `FederationPeer` rows |

All three require an authenticated JWT. The `/admin` page polls them every
3 seconds.

### Connecting from a Jabber client

Any standard XMPP client can log in with a Parley account's credentials -
there is no separate XMPP password. The `mod_auth_parley` module forwards
SASL PLAIN attempts to `/api/xmpp/auth`, which verifies the password
against the user's bcrypt hash in the Parley DB.

Client settings (e.g. Beagle IM / Monal / Gajim / Conversations):

- **JID**: `<parley-username>@parley.local` (or `parley-a.local` / `parley-b.local` in the federation compose)
- **Password**: your Parley password
- **Server / Host**: `localhost`
- **Port**: `5222` (side A) or `5223` (side B, federation compose only)
- **Use direct TLS**: off (STARTTLS on port 5222)
- **Accept self-signed certificates**: on (or trust the cert manually)

Macs running strict clients like Beagle IM benefit from:

```bash
# Resolve the XMPP domain locally
echo "127.0.0.1 parley.local parley-a.local parley-b.local" | sudo tee -a /etc/hosts

# Trust the Prosody self-signed cert
docker exec parley-prosody-a-1 cat /var/lib/prosody/certs/parley-a.local.crt > /tmp/parley-a.crt
open /tmp/parley-a.crt   # Keychain Access -> double-click -> Trust -> Always Trust
```

Once connected, messages flow both ways:

- DMs sent from the Jabber client to another Parley user appear in the recipient's web UI in real time and are persisted in the Parley DB
- DMs sent from the web UI are delivered to the recipient's Jabber-client session via Prosody c2s if they're online

Two bundled smoke tests live in `loadtest/`:

```bash
# Single login against Parley-auth-backed c2s
node loadtest/c2s-login-test.mjs \
  --host=localhost --domain=parley-a.local \
  --user=<username> --password=<password>

# Two-way bridge flow (Alice web -> Bob XMPP, Bob XMPP -> Alice web)
node loadtest/c2s-bridge-test.mjs
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
| Personal Chats | `/api/personal-chats` | list DMs, open DM by user id, open DM by remote JID |
| Attachments | `/api/attachments` | upload, download |
| Admin (XMPP) | `/api/admin/xmpp` | stats, sessions, federation |
| XMPP auth | `/api/xmpp/auth` | internal - called by Prosody `mod_auth_parley` to verify Jabber-client SASL attempts |
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
