#!/usr/bin/env bash
# Build and release all three applications on the VPS.
# Run as the application user: sudo -u vomp bash deploy/scripts/deploy.sh
set -euo pipefail

BASE_DIR="${VOMP_BASE:-/var/www/vomp}"
WORKSPACE="${BASE_DIR}/workspace"
WEBSITE="${BASE_DIR}/website"
ENV_DIR="${BASE_DIR}/shared/env"
PM2_BIN="${PM2_BIN:-$(command -v pm2 || true)}"

if [[ -z "${PM2_BIN}" ]]; then
  echo "PM2 is not installed. Run bootstrap-contabo.sh first." >&2
  exit 1
fi

for file in api.env admin.env website.env; do
  if [[ ! -f "${ENV_DIR}/${file}" ]]; then
    echo "Missing ${ENV_DIR}/${file}. Run init-env.sh first." >&2
    exit 1
  fi
done

if [[ ! -d "${WEBSITE}" ]]; then
  echo "Website project not found at ${WEBSITE}." >&2
  exit 1
fi

echo "→ Linking environment files"
ln -sfn "${ENV_DIR}/api.env" "${WORKSPACE}/apps/api/.env"
ln -sfn "${ENV_DIR}/admin.env" "${WORKSPACE}/apps/admin/.env.local"
ln -sfn "${ENV_DIR}/website.env" "${WEBSITE}/.env.local"

mkdir -p "${BASE_DIR}/shared/logs" "${BASE_DIR}/shared/data" "${BASE_DIR}/shared/uploads"

echo "→ Installing workspace dependencies"
cd "${WORKSPACE}"
npm ci --no-audit --no-fund

echo "→ Building admin console"
npm run build --workspace @vomp/admin

echo "→ Installing website dependencies"
cd "${WEBSITE}"
npm ci --no-audit --no-fund

echo "→ Building public website"
npm run build

echo "→ Reloading PM2"
cd "${WORKSPACE}"
"${PM2_BIN}" startOrReload deploy/pm2/ecosystem.config.cjs --env production
"${PM2_BIN}" save

echo "→ Waiting for services"
sleep 4

check() {
  local name="$1"
  local url="$2"
  if curl -fsS --max-time 10 "${url}" >/dev/null; then
    echo "  ✓ ${name}"
  else
    echo "  ✗ ${name} (${url})" >&2
    return 1
  fi
}

check "API" "http://127.0.0.1:8081/api/health"
check "Admin" "http://127.0.0.1:3002/login"
check "Website" "http://127.0.0.1:3000/healthz"

echo ""
echo "✓ Release complete."
"${PM2_BIN}" status
