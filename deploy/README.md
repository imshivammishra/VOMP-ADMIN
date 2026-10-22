# Contabo deployment (current server)

> **Current phase: all three services live with the imported production catalogue.**
> The website, admin console and API run on `3100`/`3102`/`3101`. The SQLite
> database contains **642 venues** (232 published, 404 draft, 6 archived),
> **6,185 imported media records**, **20 enquiries** and **16 settings**. The
> public website serves this real catalogue, including 232 published venue pages.
> The legacy Docker Postgres stack remains running and untouched; its full backup
> is in `/opt/vomp-deploy/shared/backups/legacy-postgres-20261022-051058.sql.gz`.
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
| Admin console (VOMP-ADMIN) | `/opt/vomp-deploy/admin-backend/apps/admin` | `3102` | Public temporarily (HTTP; UFW open) |
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
# PM2 7 may generate a Type=forking unit that fails with "protocol" because
# it does not create the declared PID file. The current VPS uses the tested
# Type=oneshot unit described in the PM2 section below.
pm2 startup systemd -u adarsharma --hp /home/adarsharma

# Build and start everything.
bash deploy/scripts/deploy.sh
pm2 save
```

The initial admin credentials are written to
`/opt/vomp-deploy/shared/env/initial-admin.txt` (mode `600`). Change the password
after the first login and delete that file.

## Data migration (completed 2026-10-22)

The real catalogue was exported from the legacy Docker Postgres stack and
imported into the persistent SQLite database. The legacy stack was not modified
and still runs in parallel.

Source material and safety copies:

```text
/opt/vomp-deploy/shared/backups/legacy-export/
  venues.json, media.json, enquiries.json, settings.json
/opt/vomp-deploy/shared/backups/legacy-postgres-20261022-051058.sql.gz
/opt/vomp-deploy/shared/backups/vomp-before-legacy-import-20261022-052240.sqlite
```

Repeatable import command (Node 22; do **not** run while the API is writing, and
back up the SQLite database first):

```bash
cd /opt/vomp-deploy/admin-backend
DB_PATH=/opt/vomp-deploy/shared/data/vomp.sqlite \
EXPORT_DIR=/opt/vomp-deploy/shared/backups/legacy-export \
node apps/api/scripts/import-legacy-json.mjs
```

The script is idempotent by legacy ID, but it updates matching rows. Re-running
it can overwrite later edits to imported venues, enquiries and media, so treat it
as a one-time migration or a deliberate restore-from-legacy operation, not a
normal deploy step.

Imported media keeps its public S3 URLs
(`https://vomp-media.s3.ap-south-1.amazonaws.com/...`). New admin uploads are
stored under `/opt/vomp-deploy/shared/uploads/` and served through `/uploads/`.

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

### Boot unit for PM2 7

The standard `pm2 startup` unit uses `Type=forking` with a `PIDFile`. On this VPS
that unit failed with `Result: protocol` because PM2 7 did not create the PID
file, so the current `/etc/systemd/system/pm2-adarsharma.service` is a tested
`Type=oneshot` unit with `RemainAfterExit=yes`, no `PIDFile`, and `ExecStop=pm2
kill`. The maintained template is `deploy/pm2/pm2-adarsharma.service`; the
pre-change unit is backed up in
`/opt/vomp-deploy/shared/backups/pm2-adarsharma.service.bak-*`.

Check the current unit and restart path:

```bash
systemctl cat pm2-adarsharma
sudo systemctl restart pm2-adarsharma
sleep 10
systemctl is-active pm2-adarsharma
pm2 status
curl -fsS http://127.0.0.1:3101/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/healthz
```

A restart of this unit kills and resurrects the saved PM2 process list. It does
not stop the legacy Docker stack or the other `/var/www` projects. A full
`sudo reboot` affects every project on the server and still requires explicit
approval; the unit restart above is the normal boot-path test.

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
separate `vomp` site and obtain certificates with Certbot. The admin port is
currently open in UFW only because of an explicit temporary approval; restore an
IP restriction as soon as the browser testing window ends.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Unstyled website | `curl -I http://127.0.0.1:3100/` must not contain `upgrade-insecure-requests`; `CSP_UPGRADE_INSECURE_REQUESTS=0`; rebuild. |
| API 404 on website | `curl http://127.0.0.1:3101/api/health`; check `API_INTERNAL_URL` and `next.config.ts` rewrites. |
| Admin login bounces | `COOKIE_SECURE=false` for HTTP; API healthy; correct admin URL/port `3102`. |
| Admin on wrong port | Check `pm2 describe VOMP-ADMIN`; the start command must use `-p 3102`. |
| Database missing | `ls -l /opt/vomp-deploy/shared/data/`; `pm2 logs VOMP-API`; API creates and seeds an empty DB. Restore a known backup rather than re-importing over edited production data. |
| Website shows the empty/old catalogue | Check `curl http://127.0.0.1:3101/api/v1/public/venues` returns 232; rebuild the website; the client requests `?limit=500`; only clear `.next/cache` if a stale build cache is suspected. |
| API or website build returns 429 | The API read ceiling is 6000/min and the 120/min write limiter applies only to non-GET methods. Restart `VOMP-API` to clear in-memory buckets; do not lower these without accounting for SSR/build traffic. |
| PM2 gone after reboot | `systemctl status pm2-adarsharma`; run `pm2 save` after changes. If the unit failed with `Result: protocol`, use the `Type=oneshot` unit described in the PM2 section. |
