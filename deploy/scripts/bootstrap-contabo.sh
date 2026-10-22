#!/usr/bin/env bash
# LEGACY / DISABLED BY DEFAULT.
# This script targets the old /var/www/vomp + "vomp" application-user layout.
# The current server uses /opt/vomp-deploy and the adarsharma user, with Node
# installed through nvm. Running this script on the existing VPS would create
# users/directories that do not match production.
#
# Current setup is documented in deploy/VOMP-DEPLOYMENT-GUIDE.md. To run this
# legacy script intentionally on a blank host: ALLOW_LEGACY_BOOTSTRAP=1 sudo -E bash ...
set -euo pipefail

if [[ "${ALLOW_LEGACY_BOOTSTRAP:-0}" != "1" ]]; then
  echo "Refusing to run the legacy bootstrap. Set ALLOW_LEGACY_BOOTSTRAP=1 only on a blank host." >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root: sudo bash deploy/scripts/bootstrap-contabo.sh"
  exit 1
fi

APP_USER="${APP_USER:-vomp}"
BASE_DIR="${VOMP_BASE:-/var/www/vomp}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "→ Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release ufw nginx certbot \
  python3-certbot-nginx sqlite3 rsync build-essential git unzip

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "${NODE_MAJOR}" ]]; then
  echo "→ Installing Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "→ Installing PM2"
  npm install -g pm2
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "→ Creating application user ${APP_USER}"
  adduser --disabled-password --gecos "" "${APP_USER}"
fi

echo "→ Creating application directories"
mkdir -p "${BASE_DIR}"/workspace "${BASE_DIR}"/website
mkdir -p "${BASE_DIR}"/shared/{data,uploads,logs,backups,env}
mkdir -p /var/www/certbot
chown -R "${APP_USER}:${APP_USER}" "${BASE_DIR}" /var/www/certbot

echo "→ Configuring firewall"
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "→ Registering PM2 at boot"
env PATH="${PATH}" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" >/tmp/pm2-startup.txt || true
cat /tmp/pm2-startup.txt || true

echo ""
echo "✓ Server prepared."
echo "  Application root : ${BASE_DIR}"
echo "  Next steps:"
echo "  1. Clone the two GitHub repositories:"
echo "       ${BASE_DIR}/workspace  <- VOMP-ADMIN"
echo "       ${BASE_DIR}/website    <- VENUEONMYPLATE"
echo "  2. Run: sudo -u ${APP_USER} bash ${BASE_DIR}/workspace/deploy/scripts/init-env.sh"
echo "  3. Run: sudo -u ${APP_USER} bash ${BASE_DIR}/workspace/deploy/scripts/deploy.sh"
echo "  4. Run: sudo LETSENCRYPT_EMAIL=you@domain.com bash ${BASE_DIR}/workspace/deploy/scripts/enable-nginx.sh"
