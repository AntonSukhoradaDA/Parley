# CLAUDE.md

Orientation notes for Claude (or any agent) working in this repo.

## What this project is

Parley is a self-hosted classic web chat: public/private rooms, direct
messages, friends, attachments, persistent history, moderation. See
[INSTRUCTIONS.md](./INSTRUCTIONS.md) for the original product requirements and
[README.md](./README.md) for the full end-user / developer overview.

Stack: NestJS + Prisma + PostgreSQL backend, React 19 + Vite + Tailwind 4
frontend, Socket.IO for real-time, Prosody XMPP for federation, Docker
Compose for everything.

## Run it

```bash
docker compose up -d --build                              # full stack on :8080
docker compose up -d --build client                       # client-only rebuild (fastest for UI work)
docker compose -f docker-compose.federation.yml up -d     # two-stack federation harness (:8080 + :8081)
```

App lives at **http://localhost:8080**. Mailpit at :8025. Admin /
federation dashboard at `/admin` (any signed-in user).

**Port conflict:** the default compose and the federation compose both
bind :8080. Run `docker compose down` before `docker compose -f
docker-compose.federation.yml up`.

## Repository layout

- `client/` — React SPA. Entry: `src/main.tsx` → `src/App.tsx` (routes).
- `server/` — NestJS app, module-per-feature (`rooms`, `messages`, `auth`,
  `friends`, `chat` (WS gateway), `attachments`, `personal-chats`, `users`,
  `mail`, `prisma`, `health`, `xmpp` (federation bridge)).
- `prosody/` — XMPP sidecar: `Dockerfile`, `entrypoint.sh` (generates
  per-domain self-signed certs), `prosody.cfg.lua`, and three custom Lua
  modules: `mod_auth_parley` (HTTP-backed c2s auth against Parley bcrypt
  hashes), `mod_parley_forward` (duplicates c2s-originated chats to the
  bridge component so the web UI stays in sync), `mod_parley_admin` (live
  session list for the `/admin` dashboard).
- `loadtest/` — Node drivers: `federation-loadtest.mjs` (cross-server
  stress test), `c2s-login-test.mjs` (Jabber-client login smoke test via
  `@xmpp/client`), `c2s-bridge-test.mjs` (end-to-end web ↔ Jabber
  message flow).
- `docker-compose.yml` — db, server, client, mailhog, prosody.
- `docker-compose.federation.yml` — two-stack (A + B) cross-server
  federation harness.
- `INSTRUCTIONS.md` — product spec, incl. wireframes in Appendix A.
- `DOCS.md`, `PLAN.MD` — background / planning.

## Frontend conventions

### Routing
- `/` → `LandingPage` (public; redirects to `/chats` if authenticated)
- `/chats` → `ChatPage` (protected)
- `/admin` → `AdminPage` (protected) — federation / XMPP bridge dashboard
- `/login`, `/register`, `/forgot-password`, `/reset-password` — public-only
- `/privacy`, `/terms` — legal (always public)

### Design system
- Tailwind 4 `@theme` block in `client/src/index.css` defines all color tokens
  (`ink`, `vellum`, `slate`, `stone`, `mist`, `bone`, `chalk`, `paper`,
  `accent`, `accent-deep`, `rust`, `moss`, `hairline`, `hairline-strong`).
- Dark / light palettes swap via `[data-theme='dark' | 'light']` on `<html>`.
  Theme system supports three modes: `light`, `dark`, `system`
  (`src/store/theme.ts`). A `matchMedia` listener re-applies when the OS theme
  changes while in `'system'` mode.
- Fonts: Instrument Serif (display), Geist (sans), Geist Mono (mono).
- CSS helper classes: `.parley-button`, `.parley-button-ghost`,
  `.parley-button-danger`, `.parley-input`, `.parley-link`,
  `.parley-icon-button`, `.eyebrow`, `.grain`, `.accent-glow`.

### Reusable UI primitives

Shared in `client/src/components/ui/` (prefer these over inline markup):

- `Avatar` — initial-letter circle, sizes `xs/sm/md/lg`
- `Badge` — accent count pill
- `PresenceDot` — online / AFK / offline status dot
- `SearchInput` — bordered search field with leading icon

All shared SVG icons live in `client/src/components/icons.tsx` — import from
there rather than re-defining inline SVGs.

Modals: `src/components/Modal.tsx` supports `variant="center" | "drawer"`.
Settings-type surfaces (Profile, Contacts) are drawers; quick actions
(Create / Browse / Manage) are centered modals.

### State
- Zustand stores in `client/src/store/` — `auth`, `rooms`, `presence`,
  `pending`, `theme`.
- Server state via TanStack Query in spots; most live chat state is pushed
  over the Socket.IO connection.

### i18n
- `i18next` + `react-i18next`, config in `client/src/i18n/index.ts`.
- Languages: `en`, `fr`, `es`. Resources in
  `client/src/i18n/locales/*.json`. Keys namespaced: `landing.*`, `auth.*`,
  `chat.*`, `sidebar.*`, `nav.*`, `common.*`, `lang.*`, `admin.*`.
- Language persists in `localStorage` (`parley:lang`), falls back to
  navigator language then English.
- Add new strings to **all three** locale files. English is the fallback;
  missing keys render the English value.
- `<html lang>` is synced to the active language by `App.tsx`.

### Icons and SVGs
- All shared icons live in `client/src/components/icons.tsx`.
- Do not add inline SVGs to new components — extend `icons.tsx` if the icon
  is missing.

## Backend conventions

- Prisma schema in `server/prisma/schema.prisma`. Use
  `npx prisma migrate dev --name <name>` for schema changes from `server/`.
- **Removal vs. ban** (rooms): `kick` removes membership without a ban entry
  (user may rejoin). `ban` removes membership **and** creates a `RoomBan` row
  so the user cannot rejoin until explicitly unbanned. See
  `rooms.service.ts`.
- Pagination is cursor-based on `messages.createdAt` / `id`. Validated by
  `server/src/messages/messages.service.spec.ts` — a 100 000-message test
  that walks the full history page-by-page and asserts no gaps, no
  duplicates, terminates in `ceil(N / PAGE_SIZE)` pages.
- **Shadow remote users**: remote XMPP peers are stored as `User` rows with
  `isRemote = true` and `xmppJid` populated. Login, register,
  forgot-password, and friend-request paths all reject these rows
  explicitly. `User.email` and `User.passwordHash` are nullable to support
  them. Don't assume `user.email` is non-null anywhere outside of
  local-auth-gated paths.
- **XMPP bridge addressing**: outbound stanzas emit from
  `<user>@bridge.<domain>` (Prosody's XEP-0114 enforces components only
  send from their own subdomain). Inbound strips the `bridge.` prefix
  before resolving the shadow user. See `XmppConfig.routeViaPeerBridge`
  and `XmppBridgeService.handleStanza`.
- **Jabber-client c2s auth** reuses Parley's bcrypt hashes via the
  `/api/xmpp/auth` callback (`XmppAuthController`). Prosody's
  `mod_auth_parley` hits this endpoint for every SASL PLAIN attempt; no
  shadow accounts are maintained in Prosody's storage. Any Parley
  account can log in from any XMPP client without separate provisioning.
- **c2s → web forwarding**: when a Jabber client sends a chat,
  `mod_parley_forward` duplicates the stanza to the bridge component
  with `to = <recipient>@bridge.<host>`. The bridge's inbound handler
  then persists a Parley `Message` and broadcasts over Socket.IO.
  Prosody stanzas use `.attr` (singular) — not `.attrs` — in Lua.
- **Web → c2s delivery**: `ChatGateway.publishToXmpp` fans out to both
  remote (via `sendDm` / `routeViaPeerBridge`) and local (via
  `sendLocalDm` addressed to `<user>@<domain>`) recipients. Local
  outbound stanzas include `urn:xmpp:hints/no-store` so Prosody's
  offline storage doesn't duplicate history Parley already owns.
- **Federated broadcast path**: `XmppInboundService` emits through a
  `ChatBroadcaster` registered by `ChatGateway.onModuleInit`. The
  broadcaster targets each room member's `user:<id>` Socket.IO channel
  (always joined at connect), dedupes across members, and also pulls
  each socket into `room:<id>` for future broadcasts. This handles the
  case where a socket connected before a federated-inbound room was
  materialized.

## Lint, format, typecheck

### Client
```bash
cd client
npx tsc --noEmit -p tsconfig.app.json   # types
npm run lint                             # eslint 9 flat config
npm run format                           # prettier --write
npm run format:check                     # prettier --check (CI)
```

ESLint config lives at `client/eslint.config.js`; extends
`eslint-config-prettier` to avoid formatting conflicts. The rule
`react-hooks/set-state-in-effect` is disabled because the app intentionally
uses that pattern to sync UI state on selection changes.

### Server
```bash
cd server
npm test                                 # jest unit tests
npm run test:e2e                         # supertest e2e
npm run lint                             # eslint --fix
```

## Docker build notes

Both client and server Dockerfiles use `npm install` (not `npm ci`).
`npm ci` strict-checked optional platform deps and broke the
mac → linux lockfile diff once we added i18n native transitive deps
and again when adding `@xmpp/*` ESM packages. If you change deps, run
`npm install` locally in the affected package so the lockfile stays
reasonable.

The Prosody sidecar is built from `prosody/Dockerfile` (Debian trixie
+ apt `prosody` 13 + `openssl`). Certs are generated per-domain on
first boot by `entrypoint.sh`; persisted in the `prosodydata` volume.

When rebuilding `server-*` containers under the federation compose,
the client's nginx caches DNS for the `server` alias and will crash
looping on "host not found in upstream `server`". Fix with
`docker compose -f docker-compose.federation.yml up -d
--force-recreate client-a client-b`.

## When in doubt

1. Read `INSTRUCTIONS.md` for the product rules (unique usernames, unique
   room names, owner cannot leave, kick == ban unless spec says otherwise,
   AFK rules across tabs, etc.).
2. Skim `docs/architecture.md` for backend topology, event catalog, and
   the phase-10 federation flow (incl. c2s auth + custom Prosody modules).
3. Check the `README.md` structure table before renaming or moving files;
   its "Connecting from a Jabber client" subsection has the client setup
   recipe for Beagle IM / Monal / Gajim.
4. For federation questions, `DOCS.md §12` is the authoritative module
   walkthrough; `loadtest/README.md` documents how to exercise s2s.

## What not to do

- Don't inline SVG icons — extend `icons.tsx`.
- Don't duplicate search / avatar / dot markup — use the primitives in
  `components/ui/`.
- Don't commit untranslated UI strings. Add keys to every locale.
- Don't use `em-dash` characters in user-facing strings — the project
  prefers a plain hyphen. (Em-dashes in code comments are fine.)
- Don't change the theme tokens casually — many components rely on the
  semantic pairs (`accent`/`accent-deep`, `hairline`/`hairline-strong`).
