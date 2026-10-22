#!/usr/bin/env bash
# Deploy the VOMP API and admin console only.
# Run as the application user from anywhere:
#   bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy-admin.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "${SCRIPT_DIR}/lib.sh"

vomp_init
vomp_load_node
vomp_load_pm2
vomp_require_env api.env admin.env

if [[ ! -d "${VOMP_WORKSPACE}/apps/api" || ! -d "${VOMP_WORKSPACE}/apps/admin" ]]; then
  echo "VOMP workspace not found at ${VOMP_WORKSPACE}." >&2
  exit 1
fi

vomp_prepare_dirs
vomp_link_envs

if [[ "${VOMP_SKIP_BACKUP:-0}" != "1" ]]; then
  echo "→ Backing up current environment"
  bash "${SCRIPT_DIR}/backup-config.sh"
fi

echo "→ Installing API + admin dependencies"
cd "${VOMP_WORKSPACE}"
npm ci --no-audit --no-fund

echo "→ Checking API syntax"
npm run check --workspace @vomp/api

echo "→ Starting API (3101, loopback only)"
vomp_start_or_reload VOMP-API
if ! vomp_wait_http "API health" "${API_URL}/api/health" 45; then
  "${PM2_BIN}" logs VOMP-API --lines 40 --nostream || true
  exit 1
fi

echo "→ Building admin console"
npm run build --workspace @vomp/admin

echo "→ Starting admin console (3102)"
vomp_start_or_reload VOMP-ADMIN
if ! vomp_wait_http "Admin login" "${ADMIN_URL}/login" 60; then
  "${PM2_BIN}" logs VOMP-ADMIN --lines 40 --nostream || true
  exit 1
fi

if ! vomp_wait_http "Admin → API proxy" "${ADMIN_URL}/api/health" 30; then
  echo "The admin Next server cannot reach the API. Check API_INTERNAL_URL in ${VOMP_ENV}/admin.env." >&2
  exit 1
fi

vomp_pm2_save
echo "✓ API and admin deployed."
"${PM2_BIN}" status
