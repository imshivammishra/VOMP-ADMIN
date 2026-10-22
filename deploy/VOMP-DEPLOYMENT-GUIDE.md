# VOMP Deployment Guide

Beginner-friendly runbook for the current Contabo VPS (`94.136.188.197`).
It covers the public website, the API and the admin console, plus the checks
labelled **A–I** used before calling a deployment complete.

> **Current phase:** all three code services run on `3100` (website), `3102`
> (admin) and `3101` (private API). The SQLite database is freshly seeded and
> contains **no real venues yet**; the public website shows its built-in
> fallback catalogue. The real production content remains in the separate
> legacy Docker Postgres stack (642 venues, 232 published; 6,338 media records;
> 20 enquiries) and is untouched. Do not migrate or delete it without approval.
>
> **Current state:** plain HTTP on direct IP ports. Admin `3102` is exposed
> publicly by explicit approval, which sends the login password over HTTP.
> Restrict it to a known IP or add HTTPS as soon as possible. Domain, TLS, data
> migration and GitHub Actions secrets are still separate setup steps.

---

## 0. What runs where

| Service | PM2 name | Code | Port | Should be reachable from |
| --- | --- | --- | --- | --- |
| Public website | `VOMP-MAIN` | `/opt/vomp-deploy/main-website` | `3100` | Internet |
| API | `VOMP-API` | `/opt/vomp-deploy/admin-backend/apps/api` | `3101` | `127.0.0.1` only |
| Admin console | `VOMP-ADMIN` | `/opt/vomp-deploy/admin-backend/apps/admin` | `3102` | Restricted IP or SSH tunnel |

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

This deploys API, admin and website together and runs checks A–I. The API uses
the fresh SQLite database; it does **not** import the legacy Postgres data.

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
ss -ltnp | grep ':3101'
```

Expected:

- API health JSON contains `"ok":true`, `"service":"vomp-api"` and
  `"database":"ok"`.
- The same health endpoint works through the website's `/api` proxy.
- Public venues return JSON, not a 404 HTML page.
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

In a browser (from an allowed IP or through an SSH tunnel):

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

Use the admin UI for this check. Prefer a **clearly labelled test record**, not a
real venue, enquiry or article.

1. Sign in to the admin.
2. Create a venue named `Deployment Check YYYY-MM-DD`, status **published**.
3. Confirm it appears in the admin list.
4. Verify it through the public API:

   ```bash
   curl -sS http://127.0.0.1:3100/api/v1/public/venues | grep -o 'Deployment Check[^"]*'
   ```

5. Open the public website and confirm the venue appears after the normal
   60-second revalidation window.
6. Delete the test venue in the admin and verify it disappears from the API.
7. Confirm the database is on the persistent path:

   ```bash
   ls -lh /opt/vomp-deploy/shared/data/vomp.sqlite*
   sqlite3 /opt/vomp-deploy/shared/data/vomp.sqlite "SELECT COUNT(*) FROM venues;"
   ```

If the count changes by exactly one and returns to the original value after
deletion, the admin → API → SQLite → public API path is working.

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

Expected: the API returns healthy and the counts are unchanged. Uploaded files
must still exist under `shared/uploads/` and still be served.

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

- `pm2-adarsharma` is `enabled`.
- After restarting the PM2 systemd unit, all three VOMP processes come back.
- No unrelated Docker containers or `/var/www` services were restarted by this
  command.

A full `sudo reboot` affects every project on the VPS. Schedule it only with
approval. The PM2 unit and `pm2 save` are what make the VOMP apps return after a
reboot.

### I. CI/CD is configured and verified

Both repositories have `.github/workflows/ci.yml` and
`.github/workflows/deploy.yml`. CI runs lint, type-check, tests and builds.
Deploy runs only on `main` after verify passes.

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

- The admin port must **not** be open to the internet. Use an SSH tunnel, or
  allow only your current public IP:

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
| Database empty / reseeded | Check `DB_PATH` in `api.env`; it must be `/opt/vomp-deploy/shared/data/vomp.sqlite`; check file permissions for `adarsharma`; never point it at a temp path. |
| PM2 processes gone after reboot | `systemctl status pm2-adarsharma`; run `pm2 save`; ensure the PM2 startup unit is enabled. |
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
      `3100`, `3102`, and loopback `3101`; no stale 3002 process.
- [ ] C. Website CSS returns `200 text/css`; CSP does not force HTTPS.
- [ ] D. API health is OK through `3101` and the website proxy; `3101` is not
      publicly reachable.
- [ ] E. Admin login works; anonymous admin API returns `401`.
- [ ] F. A labelled test record reaches SQLite and the public API, then is
      removed; uploads use shared storage.
- [ ] G. Counts and uploads survive an API restart.
- [ ] H. PM2 systemd unit is enabled and brings services back after restart.
- [ ] I. CI passes; deploy workflow succeeds after secrets are configured.
