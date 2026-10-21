# Contabo deployment

This project runs entirely on a normal Ubuntu VPS. It does **not** require
Vercel. Next.js is the React framework used by the website and admin; both are
self-hosted with Nginx and PM2.

## Architecture

```
Internet
   │
   ├── https://dev.venueonmyplate.com       → Nginx → Next website   127.0.0.1:3000
   ├── https://dev-admin.venueonmyplate.com → Nginx → Next admin     127.0.0.1:3002
   └── https://dev.api.venueonmyplate.com   → Nginx → Express API    127.0.0.1:8081

Browser calls to /api on the website and admin hosts are proxied to the API.
/uploads is served from shared disk. The API process itself stays on loopback.
```

Two reverse-proxy profiles are supported:

| Profile | Public hosts | API style |
| --- | --- | --- |
| Development / staging | `dev.venueonmyplate.com`, `dev-admin.venueonmyplate.com`, `dev.api.venueonmyplate.com` | Separate API host plus same-origin `/api` proxies |
| Production | `venueonmyplate.in`, `www.venueonmyplate.in`, `admin.venueonmyplate.in` | Same-origin `/api`; API is not a public host |

Why this layout:

- **Fast** — Nginx handles TLS, compression, static assets and keep-alive; the
  Next processes and API stay on loopback.
- **Secure** — HTTPS everywhere, host-only HttpOnly session cookies, locked
  CORS, `TRUST_PROXY=1`, and an API bound to `127.0.0.1`.
- **Live** — one SSE stream per admin console is proxied with buffering off.
- **Simple to update** — one deploy script builds all three apps and reloads PM2.

The website and admin call `/api` on their own origin. This keeps the admin
session cookie first-party. The API host is available for health checks and
direct integrations; set `BROWSER_API_URL=https://dev.api.venueonmyplate.com`
during `init-env.sh` only if you deliberately want browser-to-API traffic.

## Server folder structure

```
/var/www/vomp/
├── website/                 # public Next.js app (VENUEONMYPLATE)
├── workspace/               # API + admin monorepo (VOMP-ADMIN)
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
  (`MAX_VIDEO_MB`). The admin and API hosts allow 100 MB request bodies to leave
  room for multipart overhead.

## 1. DNS

Create these records at your registrar, all pointing to the Contabo IPv4:

| Type | Name | Purpose |
| --- | --- | --- |
| A | `dev` | Public website |
| A | `dev-admin` | Admin console |
| A | `dev.api` | API application |

Wait for all three to resolve before requesting certificates:

```bash
dig +short dev.venueonmyplate.com
dig +short dev-admin.venueonmyplate.com
dig +short dev.api.venueonmyplate.com
```

Do not continue to the HTTPS step until each command returns the VPS IP.

For the production profile, point `@`, `www`, and `admin` at the same VPS.

## 2. Clone both repositories

SSH into the VPS:

```bash
sudo apt update && sudo apt upgrade -y
sudo mkdir -p /var/www/vomp
cd /var/www/vomp
sudo git clone https://github.com/imshivammishra/VOMP-ADMIN.git workspace
sudo git clone https://github.com/imshivammishra/VENUEONMYPLATE.git website
```

If GitHub asks for credentials, use your GitHub username and a fine-grained
personal access token with read access to both repositories as the password. Do
not paste the token into the clone URL or commit it anywhere.

## 3. Prepare the server

```bash
cd /var/www/vomp/workspace
sudo bash deploy/scripts/bootstrap-contabo.sh
```

This installs Node.js 22, Nginx, PM2, Certbot and SQLite tools, creates the
`vomp` user, creates `/var/www/vomp/shared`, and enables the firewall. It also
changes ownership of both project folders to `vomp`.

### Add a read-only GitHub deploy key

The server needs to pull future updates without a personal token:

```bash
sudo -u vomp mkdir -p /home/vomp/.ssh
sudo -u vomp chmod 700 /home/vomp/.ssh
sudo -u vomp ssh-keygen -t ed25519 -C "vomp-contabo" -f /home/vomp/.ssh/id_ed25519 -N ""
sudo -u vomp cat /home/vomp/.ssh/id_ed25519.pub
```

In GitHub, open **VOMP-ADMIN → Settings → Deploy keys → Add deploy key**, paste
the public key, leave write access disabled, and save. Repeat for
**VENUEONMYPLATE**.

Point both checkouts at SSH and trust GitHub's host key:

```bash
sudo -u vomp sh -c 'ssh-keyscan github.com >> /home/vomp/.ssh/known_hosts'
sudo -u vomp chmod 600 /home/vomp/.ssh/known_hosts
sudo -u vomp git -C /var/www/vomp/workspace remote set-url origin git@github.com:imshivammishra/VOMP-ADMIN.git
sudo -u vomp git -C /var/www/vomp/website remote set-url origin git@github.com:imshivammishra/VENUEONMYPLATE.git
sudo -u vomp ssh -T git@github.com
```

GitHub replies with a success message and does not provide a shell.

## 4. Create environment files

For the three-host development/staging profile:

```bash
cd /var/www/vomp/workspace
sudo -u vomp env \
  FRONTEND_DOMAIN=dev.venueonmyplate.com \
  ADMIN_DOMAIN=dev-admin.venueonmyplate.com \
  API_DOMAIN=dev.api.venueonmyplate.com \
  INCLUDE_WWW=0 \
  bash deploy/scripts/init-env.sh
```

The script writes `/var/www/vomp/shared/env/{api,admin,website}.env`, sets the
three public origins, and generates a strong first admin password.

**Copy the printed password now. It is only printed once.**

If env files already exist, the script keeps them unchanged. To switch domain
profiles later, back up and remove those three files, then rerun `init-env.sh`;
the database and uploaded media are not touched.

Review the admin email and other values:

```bash
sudo -u vomp nano /var/www/vomp/shared/env/api.env
```

The API validates production credentials at startup. `SEED_ADMIN_PASSWORD` must
be at least 12 characters and must not be a placeholder; otherwise the process
stops instead of creating an insecure account.

Key values for the dev profile:

```env
API_PUBLIC_URL=https://dev.api.venueonmyplate.com
FRONTEND_URL=https://dev.venueonmyplate.com
ADMIN_URL=https://dev-admin.venueonmyplate.com
CORS_ORIGINS=https://dev.venueonmyplate.com,https://dev-admin.venueonmyplate.com
COOKIE_DOMAIN=
```

`COOKIE_DOMAIN` stays blank. Both apps reach `/api` on their own origin, so the
session stays host-only and first-party. The browser never needs the separate
API host for authentication.

For the production profile instead:

```bash
sudo -u vomp env DOMAIN=venueonmyplate.in bash deploy/scripts/init-env.sh
```

## 5. Build and start

```bash
sudo -u vomp bash /var/www/vomp/workspace/deploy/scripts/deploy.sh
```

The script links the env files into both projects, installs dependencies, builds
the admin and website, starts/reloads PM2, and checks:

- `http://127.0.0.1:8081/api/health`
- `http://127.0.0.1:3002/login`
- `http://127.0.0.1:3000/healthz`

Check status at any time:

```bash
sudo -u vomp pm2 status
sudo -u vomp pm2 logs
```

## 6. Enable HTTPS

For the dev profile:

```bash
sudo env \
  FRONTEND_DOMAIN=dev.venueonmyplate.com \
  ADMIN_DOMAIN=dev-admin.venueonmyplate.com \
  API_DOMAIN=dev.api.venueonmyplate.com \
  LETSENCRYPT_EMAIL=you@example.com \
  bash /var/www/vomp/workspace/deploy/scripts/enable-nginx.sh
```

This installs three HTTP redirect hosts, obtains one SAN certificate covering all
three names, and installs the split-domain reverse proxy.

For the production profile:

```bash
sudo env DOMAIN=venueonmyplate.in \
  LETSENCRYPT_EMAIL=you@example.com \
  bash /var/www/vomp/workspace/deploy/scripts/enable-nginx.sh
```

Test the running stack:

```bash
curl https://dev.api.venueonmyplate.com/api/health
curl -I https://dev.venueonmyplate.com
curl -I https://dev-admin.venueonmyplate.com/login
```

Then open:

- Website: `https://dev.venueonmyplate.com`
- Admin: `https://dev-admin.venueonmyplate.com`
- API health: `https://dev.api.venueonmyplate.com/api/health`

The first login uses the generated password and the `SEED_ADMIN_EMAIL` from
`api.env`. Change the password after signing in.

## 7. Backups

Run once manually:

```bash
sudo -u vomp bash /var/www/vomp/workspace/deploy/scripts/backup.sh
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

## Updating from GitHub

After a push to `main`, pull both repositories on the VPS and run the release
script:

```bash
sudo -u vomp git -C /var/www/vomp/workspace pull --ff-only
sudo -u vomp git -C /var/www/vomp/website pull --ff-only
sudo -u vomp bash /var/www/vomp/workspace/deploy/scripts/deploy.sh
```

`pm2 startOrReload` performs a zero-downtime reload for the app processes.
GitHub Actions runs the lint, type-check, smoke test and build steps on every
push before code reaches the VPS.

Environment changes require a rebuild because `NEXT_PUBLIC_*` values are
compiled into the browser bundle. `deploy.sh` always rebuilds both Next apps.

## Environment reference

### API — `/var/www/vomp/shared/env/api.env`

| Key | Value |
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
API_INTERNAL_URL=http://127.0.0.1:8081
NEXT_PUBLIC_SITE_URL=https://dev.venueonmyplate.com
```

### Website — `/var/www/vomp/shared/env/website.env`

```env
NEXT_PUBLIC_API_URL=/
API_INTERNAL_URL=http://127.0.0.1:8081
NEXT_PUBLIC_SITE_URL=https://dev.venueonmyplate.com
```

`NEXT_PUBLIC_API_URL=/` means browsers call `/api/...` on the same domain.
`API_INTERNAL_URL` is used only by the Next servers and never reaches the
browser. Next.js proxies `/api` to the API during local development; Nginx does
it in production.

## Security checklist

- [x] API process listens on `127.0.0.1` only.
- [x] Admin and website listen on `127.0.0.1` behind Nginx.
- [x] HTTPS with HSTS; Certbot renewal timer is enabled by the package.
- [x] Host-only HttpOnly session cookie; no demo credentials in the UI.
- [x] CSRF origin/header checks and login rate limits are enabled in the API.
- [x] CORS restricted to the website and admin origins.
- [x] `X-Frame-Options`, `nosniff`, referrer and permissions policies enabled.
- [x] Image uploads capped at 8 MB and videos at 80 MB by the API.
- [x] Secrets live in `/var/www/vomp/shared/env`, mode `600`.
- [x] Nightly database backup script included.
- [x] Do not open ports `3000`, `3002` or `8081` in UFW.

The split profile exposes an API hostname, but the Express process is still
bound to loopback and all traffic passes through Nginx, helmet, CORS and rate
limits. The website and admin continue to use first-party `/api` calls, so the
session cookie is never shared across hosts.

## Troubleshooting

```bash
sudo -u vomp pm2 status
sudo -u vomp pm2 logs vomp-api --lines 100
sudo -u vomp pm2 logs vomp-admin --lines 100
sudo nginx -t
sudo systemctl status nginx
curl -i http://127.0.0.1:8081/api/health
```

If the admin loads but sign-in fails:

1. `pm2 status` shows `vomp-api` online.
2. `curl https://dev-admin.venueonmyplate.com/api/health` returns JSON.
3. `npm run build --workspace @vomp/admin` was run after changing env values.
4. The browser is using `https://dev-admin.venueonmyplate.com`, not an old
   preview URL.

If Certbot fails, DNS is not pointing at this server yet for every hostname, or
port 80 is blocked. Re-run `dig` and check the firewall:

```bash
sudo ufw status
```

If Git pulls fail, verify the deploy key is attached to the repository and the
remote uses SSH:

```bash
sudo -u vomp git -C /var/www/vomp/workspace remote -v
sudo -u vomp ssh -T git@github.com
```
