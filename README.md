# Venue On My Plate — Workspace

Production monorepo for the private side of **Venue On My Plate**: the public
content API, the operations console and one SQL database. The customer website
lives in the separate [`VENUEONMYPLATE`](../VENUEONMYPLATE) repository.

| Service | Local URL | Production |
| --- | --- | --- |
| Public website | <http://localhost:3001> | <https://venueonmyplate.in> |
| Admin console | <http://localhost:3002> | <https://admin.venueonmyplate.in> |
| API | <http://localhost:8081> | private `127.0.0.1:8081` behind Nginx |

## Architecture

```text
Internet
   │
   ├── venueonmyplate.in        → Nginx → Next website      127.0.0.1:3000
   └── admin.venueonmyplate.in  → Nginx → Next admin        127.0.0.1:3002
                                         └→ /api/*         Express 127.0.0.1:8081
                                         └→ /uploads/*     shared media storage

API/admin/website are separate processes. Nginx is the only public entry point.
Database: SQLite in WAL mode, stored outside both repositories on the VPS.
```

## Repository structure

```text
Venue-Workspace/
├── apps/
│   ├── api/                     # Express 4 API, SQL schema, seed, SQLite
│   │   ├── seed/                # Idempotent bootstrap and editorial seed
│   │   ├── scripts/             # seed, reset, syntax check and smoke test
│   │   └── src/
│   │       ├── lib/             # auth, security, HTTP, realtime, serializers
│   │       ├── routes/          # public and admin route modules
│   │       ├── config.js        # validated environment configuration
│   │       ├── db.js            # SQLite connection and schema bootstrap
│   │       └── server.js        # HTTP application
│   └── admin/                   # Next.js 15 operations console
│       └── src/
│           ├── app/             # Route groups, login, error/loading states
│           ├── components/      # Layout shell, UI kit, charts, media picker
│           ├── config/          # Navigation and app constants
│           └── lib/             # API client, auth, realtime, types, helpers
├── deploy/                      # Nginx, PM2, environment and backup scripts
├── docs/                        # Architecture and database notes
├── .github/workflows/           # CI
├── .editorconfig
├── .nvmrc
└── package.json                 # npm workspaces and root commands
```

## Requirements

- **Node.js 22.5+** (24 LTS recommended) — the API uses the built-in `node:sqlite`
  driver, so there is no native database build step.
- npm 10+
- Linux VPS for production; Windows/macOS/Linux for development
- SQLite 3.35+ for command-line backups and inspection

## Quick start

```bash
npm ci
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
npm run seed
npm run dev
```

`npm run dev` starts the API on **8081** and the admin console on **3002**.

Start the public website separately from its repository:

```bash
cd ../VENUEONMYPLATE
npm ci
npm run dev -- -p 3001
```

### Root commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | API + admin, live reload |
| `npm run dev:api` | API only |
| `npm run dev:admin` | Admin only |
| `npm run seed` | Idempotent database/admin/content seed |
| `npm run build` | Production admin build |
| `npm run lint` | Admin ESLint |
| `npm run typecheck` | Admin TypeScript check |
| `npm run test` | API syntax check + boot/login/session smoke test |
| `npm run check` | Full local verification (API, lint, types, admin build) |
| `npm start` | Production API + admin (run `npm run build` first) |

## Sign in

The first admin is created from `apps/api/.env` using `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`. There are no demo credentials in the repository or UI.
Change the password immediately after the first production login.

The login form disables browser autofill and password-manager fill hints. It
authenticates against the real SQL database. Passwords use scrypt; sessions are
stored in the database, sent as `HttpOnly` host-only cookies and protected by
CSRF checks and login rate limiting.

## Environment

| File | Purpose |
| --- | --- |
| `apps/api/.env` | API, SQLite, uploads, seed account, origins |
| `apps/admin/.env.local` | Admin API and public site URLs |
| `deploy/env/*.example` | Production templates copied to `shared/env/` |

Never commit `.env` files. Production secrets live in
`/var/www/vomp/shared/env/` with mode `600`.

In production the admin and website both call `/api` on their own origin, so the
session remains first-party. The API itself is bound to loopback only.

## Data and media

- Local database: `apps/api/data/vomp.sqlite`
- Local uploads: `apps/api/uploads/library/`
- Production database: `/var/www/vomp/shared/data/vomp.sqlite`
- Production uploads: `/var/www/vomp/shared/uploads/library/`
- Images: up to 8 MB. Videos: up to 80 MB. Admin Nginx accepts 100 MB bodies.
- The seed intentionally ships **no venue records**. Add real properties in the
  admin console; the public directory only lists published, real venues.

SQLite is deliberate for this single-writer admin workload. Backups use SQLite's
online `.backup` command, not a raw copy of an open database file.

## Admin workspace

- Mantis-inspired navigation hierarchy with collapsible sidebar and breadcrumbs
- Live overview with real enquiry, conversation and catalogue metrics
- Enquiries, inbox, partners, venues, destinations and journal
- Homepage CMS with add/edit/delete/publish/reorder for every section
- Reviews with moderation, feature, publish and order controls
- Image/video media library with a shared picker
- Team roles, sessions, activity audit and production connection health
- Server-sent events for live updates without polling every screen

The visual system stays cream, white, black and warm gray — no maroon/gold in
the console. The public website keeps its maroon/gold identity.

## API

```text
GET  /api/health
GET  /api/v1/public/{venues,cities,blogs,reviews,content,settings}
POST /api/v1/public/{enquiries,partners,chat}
POST /api/admin/auth/login | logout | change-password
GET  /api/admin/auth/me | sessions
GET  /api/admin/{overview,enquiries,threads,partners,media,team,settings,health,search}
GET  /api/admin/stream                 # server-sent events
CRUD /api/admin/{venues,destinations,posts,content,reviews}
```

Successful API payloads use `{ "data": ... }`; list responses add `meta`.

## GitHub workflow

This repository is CI-ready. Recommended flow:

```bash
git init
git branch -M main
git add .
git commit -m "Production workspace"
git remote add origin git@github.com:<owner>/venue-workspace.git
git push -u origin main
```

The website repository has its own CI and remote. CI verifies the API boot/login
smoke test, admin lint/type-check/build, and website lint/type-check/build.

## Deployment

Full Contabo/VPS instructions: [`deploy/README.md`](deploy/README.md).

```text
/var/www/vomp/
├── website/          # VENUEONMYPLATE clone
├── workspace/        # this repository
└── shared/           # database, uploads, backups, logs, env
```

No Vercel dependency. Nginx, PM2 and Let's Encrypt run on the VPS.

## Documentation

- [`deploy/README.md`](deploy/README.md) — VPS setup, TLS, backups, monitoring
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — code and data flow
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema, backup and restore notes
