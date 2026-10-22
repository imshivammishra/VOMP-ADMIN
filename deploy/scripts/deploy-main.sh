#!/usr/bin/env bash
# Deploy the public website only.
# Run as the application user:
#   bash /opt/vomp-deploy/admin-backend/deploy/scripts/deploy-main.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "${SCRIPT_DIR}/lib.sh"

vomp_init
vomp_load_node
vomp_load_pm2
vomp_require_env website.env

if [[ ! -d "${VOMP_WEBSITE}" ]]; then
  echo "Website project not found at ${VOMP_WEBSITE}." >&2
  exit 1
fi

vomp_prepare_dirs
vomp_link_envs

if [[ "${VOMP_SKIP_BACKUP:-0}" != "1" ]]; then
  echo "→ Backing up current environment"
  bash "${SCRIPT_DIR}/backup-config.sh"
fi

if [[ "${VOMP_SKIP_API_CHECK:-0}" != "1" ]]; then
  echo "→ Checking API before building the website"
  if ! curl -fsS --max-time 5 "${API_URL}/api/health" >/dev/null; then
    echo "API is not healthy at ${API_URL}/api/health. Deploy the API first." >&2
    exit 1
  fi
  echo "  ✓ API is healthy"
else
  echo "→ Website-only mode: API check skipped"
fi

echo "→ Installing website dependencies"
cd "${VOMP_WEBSITE}"
npm ci --no-audit --no-fund

echo "→ Building public website"
npm run build

echo "→ Starting website (3100)"
vomp_start_or_reload VOMP-MAIN
if ! vomp_wait_http "Website health" "${WEB_URL}/healthz" 60; then
  "${PM2_BIN}" logs VOMP-MAIN --lines 40 --nostream || true
  exit 1
fi

if [[ "${VOMP_SKIP_API_CHECK:-0}" != "1" ]]; then
  echo "→ Checking same-origin API proxy"
  if ! curl -fsS --max-time 10 "${WEB_URL}/api/v1/public/venues" >/dev/null; then
    echo "Website cannot reach /api/v1/public/venues through its Next proxy." >&2
    exit 1
  fi
  echo "  ✓ /api/v1/public/venues"
else
  echo "→ Website-only mode: /api proxy check skipped (API not deployed yet)"
fi

echo "→ Checking CSS and CSP"
HTML="$(curl -fsS --max-time 10 "${WEB_URL}/")"
CSS_PATH="$(printf '%s' "${HTML}" | grep -oE '/_next/static/css/[^" ]+\.css' | head -n 1 || true)"
if [[ -z "${CSS_PATH}" ]]; then
  echo "Could not find a stylesheet link in the homepage HTML." >&2
  exit 1
fi
CSS_TYPE="$(curl -fsS -o /dev/null -w '%{content_type}' --max-time 10 "${WEB_URL}${CSS_PATH}")"
if [[ "${CSS_TYPE}" != text/css* ]]; then
  echo "Stylesheet ${CSS_PATH} returned ${CSS_TYPE}, expected text/css." >&2
  exit 1
fi
echo "  ✓ ${CSS_PATH} (${CSS_TYPE})"

if grep -q '^CSP_UPGRADE_INSECURE_REQUESTS=0' "${VOMP_ENV}/website.env"; then
  if curl -sS -D - -o /dev/null --max-time 10 "${WEB_URL}/" | grep -qi 'upgrade-insecure-requests'; then
    echo "CSP still contains upgrade-insecure-requests while the site is served over HTTP." >&2
    exit 1
  fi
  echo "  ✓ CSP is HTTP-safe (no upgrade-insecure-requests)"
fi

vomp_pm2_save
echo "✓ Website deployed."
"${PM2_BIN}" status
