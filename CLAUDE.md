# CLAUDE.md

Orientation notes for Claude (or any agent) working in this repo.

## What this project is

Parley is a self-hosted classic web chat: public/private rooms, direct
messages, friends, attachments, persistent history, moderation. See
[INSTRUCTIONS.md](./INSTRUCTIONS.md) for the original product requirements and
[README.md](./README.md) for the full end-user / developer overview.

Stack: NestJS + Prisma + PostgreSQL backend, React 19 + Vite + Tailwind 4
frontend, Socket.IO for real-time, Docker Compose for everything.

## Run it

```bash
docker compose up -d --build          # full stack on :8080
docker compose up -d --build client   # client-only rebuild (fastest for UI work)
```

App lives at **http://localhost:8080**. Mailpit at :8025.

## Repository layout

- `client/` — React SPA. Entry: `src/main.tsx` → `src/App.tsx` (routes).
- `server/` — NestJS app, module-per-feature (`rooms`, `messages`, `auth`,
  `friends`, `chat` (WS gateway), `attachments`, `personal-chats`, `users`,
  `mail`, `prisma`, `health`).
- `docker-compose.yml` — db, server, client, mailhog.
- `INSTRUCTIONS.md` — product spec, incl. wireframes in Appendix A.
- `DOCS.md`, `PLAN.MD` — background / planning.

## Frontend conventions

### Routing
- `/` → `LandingPage` (public; redirects to `/chats` if authenticated)
- `/chats` → `ChatPage` (protected)
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
  `chat.*`, `sidebar.*`, `nav.*`, `common.*`, `lang.*`.
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

The client Dockerfile uses `npm install` (not `npm ci`). `npm ci` strict-
checked optional platform deps and broke the mac → linux lockfile diff once
we added i18n native transitive deps. If you change client deps, run
`cd client && npm install` locally so the lockfile stays reasonable.

## When in doubt

1. Read `INSTRUCTIONS.md` for the product rules (unique usernames, unique
   room names, owner cannot leave, kick == ban unless spec says otherwise,
   AFK rules across tabs, etc.).
2. Skim `docs/architecture.md` for backend topology and event catalog.
3. Check the `README.md` structure table before renaming or moving files.

## What not to do

- Don't inline SVG icons — extend `icons.tsx`.
- Don't duplicate search / avatar / dot markup — use the primitives in
  `components/ui/`.
- Don't commit untranslated UI strings. Add keys to every locale.
- Don't use `em-dash` characters in user-facing strings — the project
  prefers a plain hyphen. (Em-dashes in code comments are fine.)
- Don't change the theme tokens casually — many components rely on the
  semantic pairs (`accent`/`accent-deep`, `hairline`/`hairline-strong`).
