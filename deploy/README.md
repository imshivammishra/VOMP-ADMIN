# Contabo deployment (current server)

> **Current phase: all three code services, fresh empty SQLite.** The website,
> admin console and API run on `3100`/`3102`/`3101`. The SQLite database is
> freshly seeded and contains **no real venues yet**, so the public website
> renders its built-in fallback catalogue. The real content remains in the
> separate legacy Docker Postgres stack (642 venues, 232 published; 6,338 media
> records; 20 enquiries) and must not be deleted or migrated without approval.
> Admin `3102` is exposed over plain HTTP by explicit approval; restrict it to a
> known IP or add HTTPS as soon as possible.

This is the deployment reference for the **current** Contabo VPS
(`94.136.188.197`). The earlier `/var/www/vomp` + `vomp`-user layout in older
commits is obsolete; do not run the legacy bootstrap script on this machine.

## Runtime layout

| Component | Path | Port | Exposure |
| --- | --- | --- | --- |
| Public website (VOMP-MAIN) | `/opt/vomp-deploy/main-website` | `3100` | Public |
| API (VOMP-API) | `/opt/vomp-deploy/admin-backend/apps/api` | `3101` | Loopback only |
| Admin console (VOMP-ADMIN) | `/opt/vomp-deploy/admin-backend/apps/admin` | `3102` | Restricted / direct |
| SQLite database | `/opt/vomp-deploy/shared/data/vomp.sqlite` | — | Disk |
| Uploads | `/opt/vomp-deploy/shared/uploads` | — | Disk |
| Env files | `/opt/vomp-deploy/shared/env` | — | Mode `600` |
| Logs | `/opt/vomp-deploy/shared/logs` | — | Disk |
| Backups | `/opt/vomp-deploy/shared/backups` | — | Disk |

PM2 process names: **`VOMP-MAIN`**, **`VOMP-ADMIN`**, **`VOMP-API`**.

The Next.js servers keep same-origin `/api` and `/uploads` rewrites; browsers
never need to reach port `3101`. The API binds to `127.0.0.1`.

## First-time setup (already done on this VPS)

```bash
# Node is provided by the application user's nvm installation.
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22

npm install -g pm2

# Create env files. For the current plain-HTTP IP deployment:
cd /opt/vomp-deploy/admin-backend
FRONTEND_ORIGIN=http://94.136.188.197:3100 \
ADMIN_ORIGIN=http://94.136.188.197:3102 \
API_ORIGIN=http://127.0.0.1:3101 \
COOKIE_SECURE=false TRUST_PROXY=0 INCLUDE_WWW=0 \
EXTRA_CORS_ORIGINS=http://127.0.0.1:3100,http://127.0.0.1:3102 \
bash deploy/scripts/init-env.sh

# Register PM2 at boot (run the sudo command that pm2 prints).
pm2 startup systemd -u adarsharma --hp /home/adarsharma

# Build and start everything.
bash deploy/scripts/deploy.sh
pm2 save
```

The initial admin credentials are written to
`/opt/vomp-deploy/shared/env/initial-admin.txt` (mode `600`). Change the password
after the first login and delete that file.

## Deploying a normal update

```bash
cd /opt/vomp-deploy/main-website && git pull --ff-only
cd /opt/vomp-deploy/admin-backend && git pull --ff-only
bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy.sh
```

### Website-only release (optional)

```bash
cd /opt/vomp-deploy/main-website && git pull --ff-only
cd /opt/vomp-deploy/admin-backend && git pull --ff-only
VOMP_WEBSITE_ONLY=1 bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy.sh
```

This starts/reloads only `VOMP-MAIN` on `3100`. It does not require `api.env`,
`admin.env`, or a database. API-backed forms and dynamic catalogue calls will be
unavailable until the API is deployed. The public pages use their built-in
fallbacks.

For a single application:

```bash
# API + admin only
bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy-admin.sh

# Public website only (API must already be healthy)
bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy-main.sh
```

The scripts never reset the database or delete uploads. They link env files
into the repositories, install dependencies, build, reload PM2 and run
read-only health checks.

## Environment files

`/opt/vomp-deploy/shared/env/api.env`:

```env
NODE_ENV=production
PORT=3101
HOST=127.0.0.1
API_PUBLIC_URL=http://127.0.0.1:3101
FRONTEND_URL=http://94.136.188.197:3100
ADMIN_URL=http://94.136.188.197:3102
CORS_ORIGINS=http://94.136.188.197:3100,http://94.136.188.197:3102,http://127.0.0.1:3100,http://127.0.0.1:3102
COOKIE_DOMAIN=
COOKIE_SECURE=false
DB_PATH=/opt/vomp-deploy/shared/data/vomp.sqlite
UPLOADS_DIR=/opt/vomp-deploy/shared/uploads
TRUST_PROXY=0
```

`admin.env` and `website.env`:

```env
NEXT_PUBLIC_API_URL=/
API_INTERNAL_URL=http://127.0.0.1:3101
NEXT_PUBLIC_SITE_URL=http://94.136.188.197:3100
CSP_UPGRADE_INSECURE_REQUESTS=0
```

`COOKIE_SECURE=false` is required only because the current public URLs are
plain HTTP. Use HTTPS as soon as possible, then set it to `true` and set
`CSP_UPGRADE_INSECURE_REQUESTS=1`, `TRUST_PROXY=1`, and rebuild the Next apps.
A `Secure` cookie is silently rejected by browsers over HTTP, which would make
admin login appear to succeed and then bounce back to the login page.

## PM2

```bash
pm2 status
pm2 logs VOMP-API --lines 100
pm2 logs VOMP-ADMIN --lines 100
pm2 logs VOMP-MAIN --lines 100
pm2 restart VOMP-API --update-env
pm2 save
```

Do not use broad `pkill -f next` commands; other Node projects (portfolio and
legacy Docker services) run on the same VPS.

## Backups

```bash
bash /opt/vomp-deploy/admin-backend/deploy/scripts/backup.sh
```

Schedule it for 02:15 daily:

```cron
15 2 * * * /opt/vomp-deploy/admin-backend/deploy/scripts/backup.sh >> /opt/vomp-deploy/shared/logs/backup.log 2>&1
```

Backups are gzipped SQLite copies in
`/opt/vomp-deploy/shared/backups`, retained for 14 days. Copy them off the VPS
as well. Environment files are backed up automatically before each deploy as
`config-<timestamp>.tar.gz`.

To restore, stop only the API, restore the DB, remove stale `-wal`/`-shm`
files, then start it:

```bash
pm2 stop VOMP-API
gunzip -c /opt/vomp-deploy/shared/backups/vomp-YYYY-MM-DD.sqlite.gz > /tmp/vomp-restore.sqlite
cp /tmp/vomp-restore.sqlite /opt/vomp-deploy/shared/data/vomp.sqlite
rm -f /opt/vomp-deploy/shared/data/vomp.sqlite-wal /opt/vomp-deploy/shared/data/vomp.sqlite-shm
pm2 start VOMP-API
```

## GitHub Actions

Both repositories have a `Deploy ...` workflow. Add these repository secrets
(the same values in both repositories):

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `94.136.188.197` |
| `VPS_USER` | `adarsharma` |
| `VPS_SSH_KEY` | Private key of a dedicated deploy keypair |
| `VPS_PORT` | Optional; defaults to `22` |

Add the matching **public** key to
`/home/adarsharma/.ssh/authorized_keys`. Until the secrets are added, the deploy
workflow fails at the "Check deployment secrets" step; CI still runs normally.

The workflows verify the code, pull `main` on the server with `git pull
--ff-only`, and run `deploy-main.sh` or `deploy-admin.sh`. They do not push,
reset, or overwrite the database.

## HTTPS / Nginx (not enabled for VOMP yet)

The server currently runs Nginx for `adarsharma.com` only. Do **not** remove the
existing Nginx sites or the default site. The `deploy/nginx/*.conf` files are
templates for a future domain-based HTTPS setup; they are not installed by the
deployment scripts. Complete DNS first, take an Nginx backup, then add a
separate `vomp` site and obtain certificates with Certbot. Until then, keep the
admin port restricted in UFW.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Unstyled website | `curl -I http://127.0.0.1:3100/` must not contain `upgrade-insecure-requests`; `CSP_UPGRADE_INSECURE_REQUESTS=0`; rebuild. |
| API 404 on website | `curl http://127.0.0.1:3101/api/health`; check `API_INTERNAL_URL` and `next.config.ts` rewrites. |
| Admin login bounces | `COOKIE_SECURE=false` for HTTP; API healthy; correct admin URL/port `3102`. |
| Admin on wrong port | Check `pm2 describe VOMP-ADMIN`; the start command must use `-p 3102`. |
| Database missing | `ls -l /opt/vomp-deploy/shared/data/`; `pm2 logs VOMP-API`; API creates the DB and seeds on first start. |
| PM2 gone after reboot | `systemctl status pm2-adarsharma`; run `pm2 save` after changes. |
