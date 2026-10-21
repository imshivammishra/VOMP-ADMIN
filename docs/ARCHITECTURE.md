# Architecture

## Runtime topology

```text
Browser
  │
  ├─ https://venueonmyplate.in ────── Nginx ── Next website  :3000
  │                                      ├── /uploads/* ── shared uploads
  │                                      └── /api/* ────── Express :8081
  │
  └─ https://admin.venueonmyplate.in ─ Nginx ── Next admin   :3002
                                         ├── /uploads/* ── shared uploads
                                         └── /api/* ────── Express :8081
```

The API listens only on loopback. Both Next applications use same-origin `/api`
paths in production, so admin session cookies are first-party and no public CORS
surface is required. The API still validates `Origin`/`Host` for writes.

## Monorepo boundaries

| Path | Responsibility | Runtime |
| --- | --- | --- |
| `apps/api` | SQL schema, auth, CMS, media, enquiries, SSE | Node 22 + Express |
| `apps/admin` | Private operations console | Next.js 15 |
| `deploy` | Nginx, PM2, TLS, env templates, backups | Ubuntu VPS |
| `docs` | Architecture and database notes | Documentation |

The public website is a separate repository and deployable Next.js app. It uses
the API's `/api/v1/public/*` routes and revalidates CMS data every 60 seconds.

## API layers

```text
src/server.js
   ├── security middleware (helmet, CORS, CSRF, rate limits, request IDs)
   ├── public routes      /api/v1/public/*
   ├── legacy public      /api/enquiries, /api/partners, /api/chat/*
   ├── auth routes        /api/admin/auth/*        (CSRF on writes)
   └── admin routes       /api/admin/*             (session + role checks)
             ├── overview, enquiries, threads, search
             ├── venues, destinations, posts
             ├── content blocks, reviews
             ├── media, partners, team, settings
             └── health (connection and storage probes)
```

- `src/lib` contains HTTP helpers, validation, serializers, auth, security,
  realtime broadcast, activity logging and media handling.
- `src/routes` contains one router per domain.
- `src/schema.sql` is the idempotent schema baseline.
- `seed/` creates the first admin and real catalogue/CMS content only when a
  record is absent. Seed operations are safe to rerun.

## Admin console

The console is a client-rendered Next.js App Router application with:

- `src/app/(app)` — protected route group and shared application shell.
- `src/app/login` — split-screen login, no credential hints or autofill.
- `src/components/layout` — sidebar, topbar, command palette, wordmark.
- `src/components/ui.tsx` — accessible shared controls and overlays.
- `src/config/navigation.ts` — single source of navigation and breadcrumbs.
- `src/lib` — typed API client, auth/session provider, SWR config, SSE stream,
  toasts, hooks and formatting helpers.

SWR handles caching and background revalidation. SSE increments a sequence
number that screens use to refresh only when the server broadcasts a change.
No demo data or mock authentication exists in the console.

## Data flow

1. A public form posts to `/api/v1/public/enquiries` on the same origin.
2. Express validates the payload, writes SQLite in WAL mode, logs activity and
   broadcasts an SSE event.
3. The admin console receives the event, revalidates the relevant SWR key and
   updates the interface.
4. Editors publish content, reviews, venues or media in the console.
5. The website reads published content through the public API with a 60-second
   Next cache and falls back to safe local content during API downtime.

## Security model

- scrypt password hashes, database-backed sessions, revocable per device.
- HttpOnly, Secure, SameSite=Lax, host-only cookies in production.
- CSRF origin/custom-header checks on all authenticated writes.
- Login and public endpoint rate limits; generic authentication errors.
- Strict CORS allow-list; API never publicly bound.
- CSP, frame denial, nosniff, referrer and permissions policies.
- Upload MIME allow-list, size ceilings and magic-byte validation.
- No secrets in Git; production env is outside both repositories.

## Failure behaviour

- Website: fallbacks keep pages renderable; content becomes fresh when the API
  returns.
- Admin: stale SWR data remains visible; a banner reports API connectivity and
  offers retry.
- API: writes are transactional; graceful SIGTERM shutdown closes SQLite.
- PM2 restarts processes; Nginx serves a clear 5xx if an upstream is down.
