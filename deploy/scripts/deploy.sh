#!/usr/bin/env bash
# Full release: API + admin + public website.
# Run as the application user:
#   bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy.sh
#
# Pull code first. This script builds and reloads services; it never resets the
# database, uploads or environment files.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "${SCRIPT_DIR}/lib.sh"

vomp_init
vomp_load_node
vomp_load_pm2

echo "→ Pre-deploy backup"
bash "${SCRIPT_DIR}/backup-config.sh"
if [[ -f "${VOMP_DATA}/vomp.sqlite" ]]; then
  bash "${SCRIPT_DIR}/backup.sh" || echo "  • database backup skipped/failed; review before continuing" >&2
else
  echo "  • no production database yet"
fi

if [[ "${VOMP_WEBSITE_ONLY:-0}" == "1" ]]; then
  vomp_require_env website.env
  echo "→ Deploying public website only (API/admin deferred)"
  VOMP_SKIP_BACKUP=1 VOMP_SKIP_API_CHECK=1 bash "${SCRIPT_DIR}/deploy-main.sh"
  echo "→ Running website checks"
  VOMP_WEBSITE_ONLY=1 bash "${SCRIPT_DIR}/healthcheck.sh"
else
  vomp_require_env api.env admin.env website.env
  echo "→ Deploying API + admin"
  VOMP_SKIP_BACKUP=1 bash "${SCRIPT_DIR}/deploy-admin.sh"
  echo "→ Deploying public website"
  VOMP_SKIP_BACKUP=1 bash "${SCRIPT_DIR}/deploy-main.sh"
  echo "→ Running production checks"
  bash "${SCRIPT_DIR}/healthcheck.sh"
fi

echo ""
echo "✓ Release complete."
"${PM2_BIN}" status
