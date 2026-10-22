# VOMP Deployment Guide

Beginner-friendly runbook for the current Contabo VPS (`94.136.188.197`).
It covers the public website, the API and the admin console, plus the checks
labelled **A–I** used before calling a deployment complete.

> **Current phase:** all three services run live on `3100` (website), `3102`
> (admin) and `3101` (private API). The SQLite database contains the migrated
> production catalogue: **642 venues** (232 published, 404 draft, 6 archived),
> **6,185 imported media records**, **20 enquiries** and **16 settings**. The
> public website serves 232 published venue pages from this data. The separate
> legacy Docker Postgres stack remains running and untouched as a safety copy.
>
> **Current state:** plain HTTP on direct IP ports. Admin `3102` is exposed
> publicly by explicit temporary approval, which sends the login password over
> HTTP. Restrict it to a known IP or add HTTPS as soon as possible. Domain, TLS
> and GitHub Actions secrets are still separate setup steps. A full reboot has
> not been performed; the PM2 systemd restart path has been verified.

---

## 0. What runs where

| Service | PM2 name | Code | Port | Should be reachable from |
| --- | --- | --- | --- | --- |
| Public website | `VOMP-MAIN` | `/opt/vomp-deploy/main-website` | `3100` | Internet |
| API | `VOMP-API` | `/opt/vomp-deploy/admin-backend/apps/api` | `3101` | `127.0.0.1` only |
| Admin console | `VOMP-ADMIN` | `/opt/vomp-deploy/admin-backend/apps/admin` | `3102` | Internet temporarily (HTTP); restrict after testing |

Persistent files:

```text
/opt/vomp-deploy/shared/
├── env/          api.env, admin.env, website.env, initial-admin.txt
├── data/         vomp.sqlite (SQLite, WAL mode)
├── uploads/      images and videos
├── logs/         PM2 logs
└── backups/      database and env backups
```

Never put the database, uploads or env files inside a Git checkout. Never run
`git reset --hard` on the server; deploy with `git pull --ff-only`.

The legacy Docker containers (`vomp-web`, `vomp-api`, `vomp-postgres`, etc.) and
the other `/var/www/*` projects belong to older deployments. **Do not stop,
delete or reconfigure them.**

---

## 1. Sign in and load the runtime

```bash
ssh adarsharma@94.136.188.197

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22

node -v      # v22.x
npm -v
pm2 -v
```

If `pm2` is missing:

```bash
npm install -g pm2
```

The helper deployment scripts find nvm and PM2 automatically, so they also work
from a non-interactive SSH command.

---

## 2. First-time setup (already performed on this VPS)

Only run this on a new checkout. It keeps existing env files and the database.

```bash
cd /opt/vomp-deploy/admin-backend

FRONTEND_ORIGIN=http://94.136.188.197:3100 \
ADMIN_ORIGIN=http://94.136.188.197:3102 \
API_ORIGIN=http://127.0.0.1:3101 \
COOKIE_SECURE=false \
TRUST_PROXY=0 \
INCLUDE_WWW=0 \
EXTRA_CORS_ORIGINS=http://127.0.0.1:3100,http://127.0.0.1:3102 \
bash deploy/scripts/init-env.sh
```

The script creates:

- `/opt/vomp-deploy/shared/env/api.env`
- `/opt/vomp-deploy/shared/env/admin.env`
- `/opt/vomp-deploy/shared/env/website.env`
- `/opt/vomp-deploy/shared/env/initial-admin.txt` (mode `600`)

It never overwrites an existing env file. The initial admin password is written
to `initial-admin.txt` instead of being printed into CI logs. Read it, sign in,
change the password, then delete the file:

```bash
cat /opt/vomp-deploy/shared/env/initial-admin.txt
rm /opt/vomp-deploy/shared/env/initial-admin.txt
```

Register PM2 at boot:

```bash
pm2 startup systemd -u adarsharma --hp /home/adarsharma
# Run the exact sudo command that PM2 prints, then:
pm2 save
```

The systemd unit is named `pm2-adarsharma`.

> **PM2 7 boot-unit fix (already applied):** the generated unit used
> `Type=forking` plus a `PIDFile`, but PM2 7 did not create that file and systemd
> failed with `Result: protocol`. The current unit uses `Type=oneshot` and
> `RemainAfterExit=yes`, removes `PIDFile` and `Restart`, and keeps
> `ExecStart=... pm2 resurrect` / `ExecStop=... pm2 kill`. The template is in
> `deploy/pm2/pm2-adarsharma.service`; the old unit is backed up in
> `/opt/vomp-deploy/shared/backups/pm2-adarsharma.service.bak-*`. Do not
> overwrite the working unit with a freshly generated one without testing a
> restart.

### 2.1 Production data migration (completed 2026-10-22)

The legacy catalogue was exported as JSON and imported into SQLite. The source
stack was not changed. Current result:

| Table | Count |
| --- | --- |
| Venues total | 642 |
| Published / draft / archived | 232 / 404 / 6 |
| Media (READY records imported) | 6,185 |
| Enquiries | 20 |
| Settings | 16 |

Safety copies:

```text
/opt/vomp-deploy/shared/backups/legacy-export/
  venues.json, media.json, enquiries.json, settings.json
/opt/vomp-deploy/shared/backups/legacy-postgres-20261022-051058.sql.gz
/opt/vomp-deploy/shared/backups/vomp-before-legacy-import-20261022-052240.sqlite
```

The repeatable import command is:

```bash
cd /opt/vomp-deploy/admin-backend
DB_PATH=/opt/vomp-deploy/shared/data/vomp.sqlite \
EXPORT_DIR=/opt/vomp-deploy/shared/backups/legacy-export \
node apps/api/scripts/import-legacy-json.mjs
```

It updates by legacy ID, so it is idempotent, but it will overwrite later edits
to imported records. Take a fresh SQLite backup and treat it as a deliberate
restore-from-legacy operation, not a normal deploy step. Imported images remain
on the public S3 bucket; new uploads live under `shared/uploads/` and are served
through `/uploads/`.

---

## 3. Deploy an update

### Full stack (current phase)

```bash
cd /opt/vomp-deploy/main-website
git pull --ff-only

cd /opt/vomp-deploy/admin-backend
git pull --ff-only
bash deploy/scripts/deploy.sh
```

This deploys API, admin and website together and runs checks A–I. It uses the
persistent SQLite database and **never** runs the legacy import as part of a
deploy. Imported data survives deploys; the scripts only build, reload and run
read-only checks.

### Website-only release (optional)

```bash
cd /opt/vomp-deploy/main-website
git pull --ff-only

cd /opt/vomp-deploy/admin-backend
git pull --ff-only
VOMP_WEBSITE_ONLY=1 bash deploy/scripts/deploy.sh
```

This starts/reloads only `VOMP-MAIN` on `3100` and skips API/admin checks.

`deploy.sh`:

1. snapshots env files and Git revisions;
2. backs up the SQLite database if it exists;
3. installs workspace dependencies and builds the admin;
4. starts/reloads the API, waits for `/api/health`;
5. starts/reloads the admin, waits for `/login`;
6. installs website dependencies and builds the website;
7. starts/reloads `VOMP-MAIN`, checks CSS, CSP and `/api` proxy;
8. runs the A–I health checks below.

Single-app deploys:

```bash
# API + admin only
bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy-admin.sh

# Public website only (API must be healthy first)
bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy-main.sh
```

---

## Checks A–I

Run these after every meaningful deployment. The read-only ones can be repeated
at any time:

```bash
bash /opt/vomp-deploy/admin-backend/deploy/scripts/healthcheck.sh
```

The sections below explain what to look for and how to investigate failures.

### A. Backups and revisions exist

```bash
ls -lh /opt/vomp-deploy/shared/backups/ | tail
cat "$(ls -t /opt/vomp-deploy/shared/backups/revisions-*.txt | head -1)"
```

Expected: a `config-*.tar.gz` from today and a revisions file showing the current
Git commits. If a database existed before the deploy, a `vomp-*.sqlite.gz` must
also exist. If the backup failed, stop and fix it before continuing.

### B. Services and ports are correct

```bash
pm2 status
pm2 describe VOMP-API | grep -E 'status|script path|exec cwd|restarts'
ss -ltnp | grep -E ':(3100|3101|3102)\b'
```

Expected:

- `VOMP-MAIN` **online**, `VOMP-ADMIN` **online**, `VOMP-API` **online**.
- `3100` and `3102` listen on `0.0.0.0` or `*`.
- `3101` listens on **`127.0.0.1` only**.
- No old `next start -p 3002` process is still running. Check with
  `ps -eo user,pid,args | grep -E 'next-server|next start' | grep -v grep`.
- Do not use `pkill -f next`; it can kill the portfolio or another project.

Current production data sanity check:

```bash
sqlite3 /opt/vomp-deploy/shared/data/vomp.sqlite \
  "SELECT 'venues', COUNT(*) FROM venues;
   SELECT 'published', COUNT(*) FROM venues WHERE status='published';
   SELECT 'media', COUNT(*) FROM media;
   SELECT 'enquiries', COUNT(*) FROM enquiries;"
```

Expected: `642`, `232`, `6185`, `20`. A zero or a much smaller number means the
API is pointing at the wrong database or the import/restore was not completed.

### C. Public website loads styled assets over HTTP

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:3100/ | head -30
CSS=$(curl -fsS http://127.0.0.1:3100/ | grep -oE '/_next/static/css/[^" ]+\.css' | head -1)
echo "$CSS"
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' "http://127.0.0.1:3100$CSS"
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/healthz
```

Expected:

- Homepage `200`, `/healthz` `200`.
- CSS request `200 text/css`.
- The `Content-Security-Policy` header has **no**
  `upgrade-insecure-requests` while the site is HTTP.
- The page is not bare HTML. In a browser, open
  `http://94.136.188.197:3100/` and check colours, fonts and layout.

If the CSS link is present but the browser requests it over HTTPS, see
`CSP_UPGRADE_INSECURE_REQUESTS=0` in `website.env` and rebuild.

### D. API is healthy and private

```bash
curl -sS http://127.0.0.1:3101/api/health
curl -sS http://127.0.0.1:3100/api/health
curl -sS http://127.0.0.1:3100/api/v1/public/venues | head -c 500; echo
curl -sS http://127.0.0.1:3100/api/v1/public/venues |
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('public venues:',(j.data||j).length)})"
ss -ltnp | grep ':3101'
```

Expected:

- API health JSON contains `"ok":true`, `"service":"vomp-api"` and
  `"database":"ok"`.
- The same health endpoint works through the website's `/api` proxy.
- Public venues return JSON, not a 404 HTML page, and the printed count is
  **232**.
- `3101` is bound to loopback. It must not be reachable from another machine;
  test externally only if you expect it to fail:
  `curl --max-time 5 http://94.136.188.197:3101/api/health` should fail.

### E. Admin console loads, login works, anonymous access is rejected

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3102/login
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3102/api/health
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3102/api/admin/overview
```

Expected: `200`, `200`, **`401`**.

While the temporary public exposure is approved, open
`http://94.136.188.197:3102/login`. After the approval ends, use an SSH tunnel
instead:

```bash
ssh -L 3102:127.0.0.1:3102 adarsharma@94.136.188.197
# open http://127.0.0.1:3102/login
```

Sign in with the email and password from `initial-admin.txt` (or the password
you set later). Expected: the dashboard loads, the browser stores the
`vomp_admin_session` cookie, and refreshing keeps you signed in.

- `COOKIE_SECURE=false` is required for plain HTTP. Without it the browser
  discards the Secure cookie and you are bounced back to `/login`.
- `COOKIE_SECURE=true` is required after HTTPS is enabled.

### F. Authenticated data flow works

Use the admin UI for this check. Prefer a **clearly labelled test record**, never
a real venue, enquiry or article. The current baseline is **642 venues** (232
published) and **20 enquiries**.

1. Sign in to the admin.
2. Create a venue named `Deployment Check YYYY-MM-DD`, status **published**.
3. Confirm it appears in the admin list.
4. Verify it through the public API:

   ```bash
   curl -sS 'http://127.0.0.1:3100/api/v1/public/venues?limit=500' | grep -o 'Deployment Check[^"]*'
   ```

5. Open the public website and confirm the venue appears after the normal
   60-second revalidation window.
6. Delete the test venue in the admin and verify it disappears from the API.
7. Confirm the database is on the persistent path and the counts returned to the
   baseline:

   ```bash
   ls -lh /opt/vomp-deploy/shared/data/vomp.sqlite*
   sqlite3 /opt/vomp-deploy/shared/data/vomp.sqlite \
     "SELECT 'venues', COUNT(*) FROM venues;
      SELECT 'published', COUNT(*) FROM venues WHERE status='published';
      SELECT 'enquiries', COUNT(*) FROM enquiries;"
   ```

If the counts change by exactly one and return to `642` / `232` / `20` after
deletion, the admin → API → SQLite → public API path is working. A test enquiry
submitted through the public form is an equally valid end-to-end check; delete it
in the admin afterwards.

For an upload check, upload a small test image in the admin media screen, confirm
a new file under `/opt/vomp-deploy/shared/uploads/library/`, open its public
`/uploads/...` URL, then delete the test media.

### G. Data survives a service restart

Before restarting, note the venue/enquiry counts:

```bash
sqlite3 /opt/vomp-deploy/shared/data/vomp.sqlite \
  "SELECT COUNT(*) AS venues FROM venues; SELECT COUNT(*) AS enquiries FROM enquiries;"
pm2 restart VOMP-API
sleep 3
curl -sS http://127.0.0.1:3101/api/health
sqlite3 /opt/vomp-deploy/shared/data/vomp.sqlite \
  "SELECT COUNT(*) AS venues FROM venues; SELECT COUNT(*) AS enquiries FROM enquiries;"
```

Expected: the API returns healthy and the counts are unchanged at **642 venues**
and **20 enquiries**. Uploaded files must still exist under `shared/uploads/` and
still be served.

### H. Services survive PM2/systemd startup

```bash
pm2 save
systemctl is-enabled pm2-adarsharma
systemctl status pm2-adarsharma --no-pager
sudo systemctl restart pm2-adarsharma
sleep 5
pm2 status
curl -sS http://127.0.0.1:3100/healthz
curl -sS http://127.0.0.1:3101/api/health
```

Expected:

- `pm2-adarsharma` is `enabled` and `active`.
- After restarting the PM2 systemd unit, all three VOMP processes come back with
  new PIDs and the health checks stay green.
- No unrelated Docker containers or `/var/www` services were restarted by this
  command.

If the unit fails with `Result: protocol`, PM2 7 did not create the declared
`PIDFile`. Use the tested `Type=oneshot` / `RemainAfterExit=yes` unit described
in section 2 and remove `PIDFile`/`Restart`. A full `sudo reboot` affects every
project on the VPS. Schedule it only with approval. The PM2 unit and `pm2 save`
are what make the VOMP apps return after a reboot.

### I. CI/CD is configured and verified

Both repositories have CI and a `deploy.yml` workflow. CI runs lint, type-check,
tests and builds. Deploy runs only on `main` after verify passes, and both can be
started manually with `workflow_dispatch`.

**Current status:** the VPS deployment was performed manually. The GitHub
Actions secrets are **not configured** and no real workflow deployment has been
verified. Do not claim CI/CD is complete until a workflow run has deployed and
its health checks passed.

Required repository secrets (add the same values to both repos):

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `94.136.188.197` |
| `VPS_USER` | `adarsharma` |
| `VPS_SSH_KEY` | Private key of a dedicated deploy key |
| `VPS_PORT` | Optional, default `22` |

Create a dedicated key locally (do not reuse your personal key):

```bash
ssh-keygen -t ed25519 -C "vomp-github-actions" -f ~/.ssh/vomp_ci -N ""
```

Append the **public** key on the server:

```bash
cat ~/.ssh/vomp_ci.pub >> /home/adarsharma/.ssh/authorized_keys
chmod 700 /home/adarsharma/.ssh
chmod 600 /home/adarsharma/.ssh/authorized_keys
```

Put the **private** key (`~/.ssh/vomp_ci`) in the GitHub secret `VPS_SSH_KEY`.
Then check:

```bash
# GitHub → repo → Actions → Deploy ... → latest run
# Expected: verify ✓, deploy ✓
```

Until the secrets are added, the deploy job fails intentionally at the
"Check deployment secrets" step. That is not a production failure; CI still
passes. Do not claim CI/CD is working until a real workflow run has deployed and
its health checks passed.

---

## 4. Backups and restore

Manual backup:

```bash
bash /opt/vomp-deploy/admin-backend/deploy/scripts/backup.sh
```

Schedule it daily at 02:15 for the application user:

```cron
15 2 * * * /opt/vomp-deploy/admin-backend/deploy/scripts/backup.sh >> /opt/vomp-deploy/shared/logs/backup.log 2>&1
```

Restore only the API process:

```bash
pm2 stop VOMP-API
gunzip -c /opt/vomp-deploy/shared/backups/vomp-YYYY-MM-DD.sqlite.gz > /tmp/vomp-restore.sqlite
cp /tmp/vomp-restore.sqlite /opt/vomp-deploy/shared/data/vomp.sqlite
rm -f /opt/vomp-deploy/shared/data/vomp.sqlite-wal \
      /opt/vomp-deploy/shared/data/vomp.sqlite-shm
pm2 start VOMP-API
sqlite3 /opt/vomp-deploy/shared/data/vomp.sqlite "PRAGMA quick_check;"
```

Copy `/opt/vomp-deploy/shared/backups/` off the VPS regularly.

---

## 5. Security notes for the current HTTP phase

- **Current exception:** `3102` is open to the internet by explicit temporary
  approval so the admin console can be reviewed over HTTP. This is not the
  long-term state; the password crosses the network unencrypted. Restore an
  IP restriction or add HTTPS as soon as the review is done. Use an SSH tunnel,
  or allow only your current public IP:

  ```bash
  sudo ufw allow from YOUR.PUBLIC.IP to any port 3102 proto tcp
  sudo ufw status numbered
  ```

  Remove the rule when it is no longer needed:
  `sudo ufw delete <rule-number>`.

- Keep `3101` closed in UFW. The API should only listen on `127.0.0.1`.
- Never enable `COOKIE_SECURE=true` before HTTPS, and never leave it `false`
  after HTTPS.
- The current HTTP session crosses the network unencrypted. Do not use it for
  sensitive production data until HTTPS is in place.
- Passwords and session cookies must never be committed or pasted into CI logs.

### HTTPS later

1. Point DNS `A` records at `94.136.188.197`.
2. Back up `/etc/nginx` and review the existing sites.
3. Add a **new** VOMP Nginx site; do not delete `adarsharma.com`, `default`, or
   other projects.
4. Obtain a certificate with Certbot.
5. Set `COOKIE_SECURE=true`, `TRUST_PROXY=1`,
   `CSP_UPGRADE_INSECURE_REQUESTS=1`, update the origins in `api.env`, then run
   `deploy.sh` again.

The guarded templates are in `deploy/nginx/`. They are not installed by the
normal deploy scripts.

---

## 6. Troubleshooting

| Symptom | First checks |
| --- | --- |
| Website is unstyled | `CSP_UPGRADE_INSECURE_REQUESTS=0`; rebuild website; `curl -I` must not contain `upgrade-insecure-requests`; CSS URL returns `200 text/css`. |
| Website `/api/...` returns 404 | API health on `3101`; `API_INTERNAL_URL=http://127.0.0.1:3101` in `website.env`; `next.config.ts` rewrites; rebuild. |
| Admin is on port 3002 or 3000 | `pm2 describe VOMP-ADMIN`; the start args must be `start -p 3102 -H 0.0.0.0`; reload PM2. |
| Admin login returns to login | `COOKIE_SECURE=false` for HTTP; use the same host (`94.136.188.197:3102` or tunnel `127.0.0.1:3102`); check API `/api/health` through the admin proxy. |
| API exits at startup | `pm2 logs VOMP-API --lines 100`; `SEED_ADMIN_PASSWORD` must be at least 12 chars and not a placeholder in production. |
| Website shows empty or stale catalogue | `curl http://127.0.0.1:3101/api/v1/public/venues` must return 232; rebuild the website; the client requests `?limit=500`; clear `.next/cache` only if a stale build cache is suspected. |
| API or build returns 429 | Read ceiling is 6000/min; the 120/min write limiter applies only to non-GET methods. Restart `VOMP-API` to clear in-memory buckets; do not lower limits without accounting for SSR/build traffic. |
| Database empty / reseeded | Check `DB_PATH` in `api.env`; it must be `/opt/vomp-deploy/shared/data/vomp.sqlite`; check file permissions for `adarsharma`; never point it at a temp path. Restore a known backup rather than re-importing over edited data. |
| PM2 processes gone after reboot | `systemctl status pm2-adarsharma`; run `pm2 save`; ensure the unit is enabled. If it failed with `Result: protocol`, replace the generated `Type=forking` unit with the tested `Type=oneshot` unit. |
| Deploy workflow fails before SSH | Missing `VPS_*` GitHub secrets; add them and rerun. |
| Deploy workflow SSH fails | Public key in `/home/adarsharma/.ssh/authorized_keys`; correct `VPS_USER`/`VPS_HOST`; port 22 open; `ssh -i` manually. |
| `npm ci` fails | Node 22 loaded; disk space (`df -h /`); network access to npm registry. |
| Database backup fails | `sqlite3` installed; DB path exists; disk space. |

Useful commands:

```bash
pm2 status
pm2 logs VOMP-API --lines 100
pm2 logs VOMP-ADMIN --lines 100
pm2 logs VOMP-MAIN --lines 100
curl -sS http://127.0.0.1:3101/api/health
curl -sS -I http://127.0.0.1:3100/
df -h /
```

---

## 7. Definition of done

A deployment is complete only when all of these are true:

- [ ] A. Fresh config backup and revision record exist.
- [ ] B. `VOMP-MAIN`, `VOMP-ADMIN`, `VOMP-API` are online; ports are
      `3100`, `3102`, and loopback `3101`; no stale 3002 process; SQLite reports
      642 venues / 232 published / 6,185 media / 20 enquiries.
- [ ] C. Website CSS returns `200 text/css`; CSP does not force HTTPS.
- [ ] D. API health is OK through `3101` and the website proxy; the public venue
      count is 232; `3101` is not publicly reachable.
- [ ] E. Admin login works; anonymous admin API returns `401`.
- [ ] F. A labelled test record reaches SQLite and the public API, then is
      removed; counts return to baseline; uploads use shared storage.
- [ ] G. Counts and uploads survive an API restart.
- [ ] H. PM2 systemd unit is enabled and brings services back after restart.
- [ ] I. CI passes; deploy workflow succeeds after secrets are configured.
