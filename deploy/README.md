# Contabo deployment

This project runs entirely on a normal Ubuntu VPS. It does **not** require
Vercel. Next.js is the React framework used by the website and admin; both are
self-hosted with Nginx and PM2.

## Architecture

```
Internet
   │
   ├── https://venueonmyplate.in        → Nginx → Next website      127.0.0.1:3000
   └── https://admin.venueonmyplate.in  → Nginx → Next admin        127.0.0.1:3002
                                             └→ /api/*  → Express  127.0.0.1:8081
                                             └→ /uploads → shared uploads

Browser requests to /api are same-origin. The API is never exposed directly.
```

Why this layout:

- **Fast** — Nginx handles TLS, compression, static assets and keep-alive; the
  Next processes and API stay on loopback.
- **Secure** — one public entry point, HTTPS everywhere, host-only session
  cookies, locked CORS, `TRUST_PROXY=1`, API bound to `127.0.0.1`.
- **Live** — one SSE stream per admin console is proxied with buffering off.
- **Simple to update** — one deploy script builds all three apps and reloads PM2.

## Server folder structure

```
/var/www/vomp/
├── website/                 # public Next.js app (VENUEONMYPLATE)
├── workspace/               # API + admin monorepo (Venue-Workspace)
│   ├── apps/
│   │   ├── api/
│   │   └── admin/
│   ├── deploy/              # this folder
│   ├── docs/
│   └── package.json
└── shared/
    ├── data/vomp.sqlite     # persistent database
    ├── uploads/             # persistent media
    ├── backups/             # nightly SQLite backups
    ├── logs/                # PM2 logs
    └── env/
        ├── api.env
        ├── admin.env
        └── website.env
```

Only the two project folders are code. Everything under `shared/` survives
deployments.

**Where records and media live**

- Database: `/var/www/vomp/shared/data/vomp.sqlite`
- Uploaded images and videos: `/var/www/vomp/shared/uploads/library/`
- Database rows store media metadata and relative URLs such as
  `/uploads/library/<file>`; the files themselves stay on disk under `shared/`.
- Nginx serves `/uploads/*` from `shared/uploads/`, so media survives app
  rebuilds and deployments.
- Limits: images up to 8 MB (`MAX_UPLOAD_MB`) and videos up to 80 MB
  (`MAX_VIDEO_MB`). Nginx on the admin domain allows 100 MB request bodies to
  leave room for multipart overhead.

## 1. DNS

Create these records at your domain registrar, pointing to the Contabo IP:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | your VPS IPv4 |
| A | `www` | your VPS IPv4 |
| A | `admin` | your VPS IPv4 |

Wait for DNS to resolve before requesting certificates.

## 2. Prepare the VPS

SSH into a fresh Ubuntu 22.04 or 24.04 server:

```bash
sudo apt update && sudo apt upgrade -y
```

Upload or clone the two projects:

```bash
sudo mkdir -p /var/www/vomp
# Venue-Workspace → /var/www/vomp/workspace
# VENUEONMYPLATE → /var/www/vomp/website
```

Then run the bootstrap script:

```bash
cd /var/www/vomp/workspace
sudo bash deploy/scripts/bootstrap-contabo.sh
```

This installs Node.js 22, Nginx, PM2, Certbot, SQLite tools, creates the `vomp`
user, prepares `/var/www/vomp/shared`, and enables the firewall.

## 3. Create environment files

```bash
sudo -u vomp bash deploy/scripts/init-env.sh
```

Optional custom domain:

```bash
sudo -u vomp DOMAIN=example.com bash deploy/scripts/init-env.sh
```

The script copies the production env files to `/var/www/vomp/shared/env/` and
generates a strong first admin password. **Copy the printed password now.**

The API validates production credentials at startup: `SEED_ADMIN_PASSWORD`
must be at least 12 characters and must not be a placeholder. A missing or
placeholder password stops the process with a clear error instead of creating an
insecure account.

Edit the admin email if needed:

```bash
sudo -u vomp nano /var/www/vomp/shared/env/api.env
```

Important values:

```env
NODE_ENV=production
HOST=127.0.0.1
TRUST_PROXY=1
DB_PATH=/var/www/vomp/shared/data/vomp.sqlite
UPLOADS_DIR=/var/www/vomp/shared/uploads
CORS_ORIGINS=https://venueonmyplate.in,https://www.venueonmyplate.in,https://admin.venueonmyplate.in
COOKIE_DOMAIN=
```

`COOKIE_DOMAIN` stays blank because the browser reaches `/api` on the same
admin domain. That gives a host-only, first-party session cookie.

## 4. Build and start

```bash
sudo -u vomp bash deploy/scripts/deploy.sh
```

The script links the env files into the projects, installs dependencies, builds
the admin and website, starts/reloads PM2, and checks all three health endpoints.

Check status at any time:

```bash
sudo -u vomp pm2 status
sudo -u vomp pm2 logs
```

## 5. Enable HTTPS

```bash
sudo DOMAIN=venueonmyplate.in \
  LETSENCRYPT_EMAIL=you@example.com \
  bash deploy/scripts/enable-nginx.sh
```

The script installs the HTTP bootstrap, obtains one certificate for the root,
`www` and `admin`, then installs the full HTTPS reverse proxy.

Test:

```bash
curl https://admin.venueonmyplate.in/api/health
```

Then open:

- Website: `https://venueonmyplate.in`
- Admin: `https://admin.venueonmyplate.in`

## 6. Backups

Run once manually:

```bash
sudo -u vomp bash deploy/scripts/backup.sh
```

Schedule it for 02:15 daily:

```bash
sudo crontab -u vomp -e
```

```cron
15 2 * * * /var/www/vomp/workspace/deploy/scripts/backup.sh >> /var/www/vomp/shared/logs/backup.log 2>&1
```

Backups are gzipped SQLite copies kept for 14 days. Copy
`/var/www/vomp/shared/backups/` to external storage as well.

## Updating the site

Pull both repositories, then run the release script:

```bash
sudo -u vomp git -C /var/www/vomp/workspace pull --ff-only
sudo -u vomp git -C /var/www/vomp/website pull --ff-only
cd /var/www/vomp/workspace
sudo -u vomp bash deploy/scripts/deploy.sh
```

`pm2 startOrReload` performs a zero-downtime reload for the app processes.
GitHub Actions runs the same lint, type-check, smoke test and build steps on every
push before code reaches the VPS.

## Environment reference

### API — `/var/www/vomp/shared/env/api.env`

| Key | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `127.0.0.1` |
| `PORT` | `8081` |
| `TRUST_PROXY` | `1` |
| `DB_PATH` | `/var/www/vomp/shared/data/vomp.sqlite` |
| `UPLOADS_DIR` | `/var/www/vomp/shared/uploads` |
| `MAX_UPLOAD_MB` | `8` (images) |
| `MAX_VIDEO_MB` | `80` (MP4, WebM, MOV, M4V) |
| `CORS_ORIGINS` | website + admin origins only |
| `COOKIE_DOMAIN` | blank (host-only) |
| `SESSION_HOURS` | `12` |

### Admin — `/var/www/vomp/shared/env/admin.env`

```env
NEXT_PUBLIC_API_URL=/
NEXT_PUBLIC_SITE_URL=https://venueonmyplate.in
```

### Website — `/var/www/vomp/shared/env/website.env`

```env
NEXT_PUBLIC_API_URL=/
API_INTERNAL_URL=http://127.0.0.1:8081
NEXT_PUBLIC_SITE_URL=https://venueonmyplate.in
```

`NEXT_PUBLIC_API_URL=/` means browsers call `/api/...` on the same domain.
`API_INTERNAL_URL` is used only by Next server components and never reaches the
browser.

## Security checklist

- [x] API listens on `127.0.0.1` only.
- [x] Admin and website listen on `127.0.0.1` behind Nginx.
- [x] HTTPS with HSTS, Certbot renewal timer enabled by the package.
- [x] Host-only HttpOnly session cookie; no demo credentials in the UI.
- [x] CSRF origin/header checks and login rate limits are enabled in the API.
- [x] CORS restricted to the two production origins in production mode.
- [x] `X-Frame-Options`, `nosniff`, referrer and permissions policies enabled.
- [x] Image uploads capped at 8 MB and videos at 80 MB by the API; the admin Nginx host accepts 100 MB request bodies for multipart overhead.
- [x] Secrets live in `/var/www/vomp/shared/env`, mode `600`.
- [x] Nightly database backup script included.

Do not commit `.env` files. Do not open ports `3000`, `3002` or `8081` in UFW.

## Performance notes

- Nginx keep-alive upstreams and gzip compression.
- Immutable caching for `/_next/static/*` and `/uploads/*`.
- SSE endpoint is exempt from proxy buffering.
- One Node process per app keeps memory predictable on a small VPS
  (2 vCPU / 4 GB is enough for this workload).
- SQLite is a good fit for this single-writer admin workload. The database is
  backed up safely with `.backup`, not by copying an open file.

## Troubleshooting

```bash
sudo -u vomp pm2 status
sudo -u vomp pm2 logs vomp-api --lines 100
sudo -u vomp pm2 logs vomp-admin --lines 100
sudo nginx -t
sudo systemctl status nginx
curl -i http://127.0.0.1:8081/api/health
```

If the admin loads but API calls fail, check:

1. `pm2 status` shows `vomp-api` online.
2. `curl https://admin.venueonmyplate.in/api/health` returns JSON.
3. `CORS_ORIGINS` contains the exact browser origin.
4. The admin was rebuilt after changing `NEXT_PUBLIC_*` values — those are
   compiled into the client bundle.
