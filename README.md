# 💬 Parley

> A classic self-hosted web chat server — rooms, direct messages, file sharing, and optional XMPP federation.

Parley is a classic web-based chat application in the spirit of early online chat rooms and IRC, brought into the modern web. It supports public and private rooms, one-to-one personal messaging, contacts and friend lists, file and image sharing, moderation tools, and persistent message history. It is designed to be **self-hosted** and **easy to deploy** — one `docker compose up` and you have your own chat server running.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Usage](#usage)
- [XMPP Federation (Optional)](#xmpp-federation-optional)
- [Capacity & Performance](#capacity--performance)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 👤 Accounts & Sessions
- Self-registration with email, username, and password
- Persistent login across browser restarts
- Multi-session support — view and revoke active sessions individually
- Secure password hashing, password reset, and password change
- Self-service account deletion

### 💬 Messaging
- Public and private chat rooms
- One-to-one personal messaging
- Message replies with visual quoting
- Message editing (with "edited" indicator) and deletion
- Emoji support
- UTF-8 multiline text, up to 3 KB per message
- Full message history with **infinite scroll**
- Messages to offline users are persisted and delivered on reconnect

### 📎 Attachments
- Upload files and images via button or copy-paste
- Original filename preserved
- Optional comment on each attachment
- Files up to **20 MB**, images up to **3 MB**
- Access scoped to current room members only

### 👥 Contacts & Friends
- Personal friend list
- Send friend requests by username or from a room's member list
- Confirm, decline, or remove friends
- User-to-user ban (blocks new DMs; existing history becomes read-only)

### 🛡️ Moderation
- Room owner + admins model
- Admins can delete messages, remove members, ban users, manage the ban list
- Owner can delete the room and remove admins
- Removing a user from a room counts as a ban

### 🟢 Presence
- **Online / AFK / Offline** statuses
- Multi-tab aware — AFK only triggers when *all* tabs are idle > 1 minute
- Low-latency presence updates (< 2 seconds)

### 🔔 Notifications
- Unread indicators on rooms and contacts
- Cleared when the chat is opened

### 🌐 Optional: XMPP / Jabber Federation
- Connect with any standard Jabber client
- Server-to-server federation — Parley instances can talk to each other
- Admin dashboards for connections and federation traffic

---

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### Run

```bash
git clone https://github.com/<your-username>/parley.git
cd parley
docker compose up
```

Then open **http://localhost:8080** in your browser.

That's it. No external services, no manual DB setup, no extra configuration needed for a local test drive.

### Stop

```bash
docker compose down
```

To also remove persistent data (database + uploaded files):

```bash
docker compose down -v
```

---

## Screenshots

> *Add screenshots here once the UI is implemented.*

```
+----------------------------------------------------------------------------------+
| Parley | Public Rooms | Private Rooms | Contacts | Sessions | Profile ▼ | Out    |
+----------------------------------------------------------------------------------+
| # engineering-room                                    | Room info              |
| [10:21] Bob: Hello team                               | Owner: alice           |
| [10:22] Alice: Uploading spec                         | Members (38)           |
| [10:25] Carol replied to Bob:                         | ● Alice                |
|   > Hello team                                        | ● Bob                  |
|   Can we make this private?                           | ◐ Carol (AFK)          |
+-------------------------------------------------------+------------------------+
| [😊] [📎] [Replying to: Bob ×]  [ Type a message... ]              [ Send ]     |
+----------------------------------------------------------------------------------+
```

See [`docs/wireframes.md`](./docs/wireframes.md) for full UI wireframes.

---

## Tech Stack

> *Update this section to match your actual stack.*

- **Backend:** [your choice — e.g. Node.js / Express, Python / FastAPI, Go, .NET]
- **Frontend:** [your choice — e.g. React, Vue, vanilla JS]
- **Realtime:** WebSockets
- **Database:** PostgreSQL
- **File storage:** Local filesystem (Docker volume)
- **XMPP (optional):** [library — e.g. ejabberd, Prosody, Slixmpp, xmpp.js]
- **Deployment:** Docker + Docker Compose

---

## Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Web Client    │  ◄──► │  Parley Server  │  ◄──► │   PostgreSQL    │
│  (React SPA)    │  WS   │   (HTTP + WS)   │       │                 │
└─────────────────┘       └────────┬────────┘       └─────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  File Storage   │
                          │  (volume mount) │
                          └─────────────────┘

                    Optional:
                          ┌─────────────────┐       ┌─────────────────┐
                          │  XMPP Module    │  ◄──► │  Other Parley   │
                          │  (federation)   │  S2S  │  / XMPP Server  │
                          └─────────────────┘       └─────────────────┘
```

- **HTTP API** — REST endpoints for auth, rooms, contacts, history, uploads
- **WebSocket** — realtime messaging, presence, notifications
- **Persistence** — all messages, rooms, users, and metadata stored in PostgreSQL
- **Files** — stored on the local filesystem, served via authenticated endpoints

---

## Configuration

Configuration is provided via environment variables. A `.env.example` file is included in the repo — copy it to `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `PARLEY_PORT` | `8080` | Port the web server listens on |
| `PARLEY_DB_URL` | `postgres://parley:parley@db:5432/parley` | PostgreSQL connection string |
| `PARLEY_FILES_DIR` | `/var/parley/files` | Directory for uploaded files |
| `PARLEY_MAX_FILE_MB` | `20` | Max file upload size (MB) |
| `PARLEY_MAX_IMAGE_MB` | `3` | Max image upload size (MB) |
| `PARLEY_SESSION_SECRET` | *(required)* | Secret for signing session tokens |
| `PARLEY_XMPP_ENABLED` | `false` | Enable XMPP / Jabber federation |
| `PARLEY_XMPP_DOMAIN` | `parley.local` | XMPP domain for this server |

> *Add or edit variables to match your actual implementation.*

---

## Usage

### Create an Account
1. Open the app and click **Register**.
2. Enter your email, a unique username, and a password.
3. You're in — no email verification required.

### Create a Room
1. Click **Create room** in the sidebar.
2. Pick a unique name, description, and visibility (public / private).
3. Invite friends or share the room name.

### Add a Friend
- By username from **Contacts → Add friend**
- Or click a user in a room member list → **Send friend request**

### Manage a Room (owner/admin only)
From the room, click **Manage room** to open the admin modal with tabs for Members, Admins, Banned users, Invitations, and Settings.

---

## XMPP Federation (Optional)

Parley can optionally expose an XMPP interface, allowing:

- **Client connections** — use any Jabber client (Gajim, Dino, Conversations, Pidgin, etc.) to log in with your Parley credentials
- **Server federation** — Parley instances can exchange messages with each other (and with any other XMPP server) using standard S2S

Enable it by setting `PARLEY_XMPP_ENABLED=true` in `.env` and restarting with `docker compose up`.

### Admin Dashboards
- **Connections** — view active XMPP client sessions
- **Federation** — view federation peers and traffic statistics

### Load Testing

A load-test harness is provided in [`tests/load/`](./tests/load/) that:

- Connects 50+ simulated clients to server A and 50+ to server B
- Exchanges messages between the two servers
- Reports throughput and latency

```bash
docker compose -f docker-compose.federation.yml up
./tests/load/run.sh
```

---

## Capacity & Performance

Parley is designed for moderate scale:

| Metric | Target |
|---|---|
| Concurrent users | **300** |
| Max room size | **1,000 participants** |
| Message delivery latency | **< 3 seconds** |
| Presence update latency | **< 2 seconds** |
| Room history | Usable with **10,000+ messages** per room |
| Max file size | **20 MB** |
| Max image size | **3 MB** |
| Message text limit | **3 KB** (UTF-8) |

---

## Development

### Local dev (without Docker)

> *Update these commands once the stack is chosen.*

```bash
# Backend
cd server
npm install
npm run dev

# Frontend
cd client
npm install
npm run dev
```

### Running tests

```bash
npm test
```

### Project structure

```
parley/
├── server/            # Backend (API, WebSocket, XMPP module)
├── client/            # Frontend web app
├── docs/              # Wireframes, architecture notes
├── tests/             # Unit, integration, and load tests
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

---

## Roadmap

- [x] Core chat (rooms, DMs, presence)
- [x] Friends & contacts
- [x] File & image attachments
- [x] Moderation (bans, admins, room deletion)
- [ ] XMPP client support
- [ ] Server-to-server federation
- [ ] Admin dashboards for connections & federation
- [ ] Load test harness (50 + 50 federated clients)

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

[MIT](./LICENSE) © 2026 — *your name here*

---

<p align="center">
  <sub>Built with care. Self-hosted by design. Conversations, rooms, and everything in between.</sub>
</p>
