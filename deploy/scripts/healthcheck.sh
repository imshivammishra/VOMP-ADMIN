#!/usr/bin/env bash
# Read-only production checks for the current VOMP layout.
# Usage: bash /opt/vomp-deploy/admin-backend/deploy/scripts/healthcheck.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "${SCRIPT_DIR}/lib.sh"
vomp_init

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
FAILURES=0

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; FAILURES=$((FAILURES + 1)); }

http_code() {
  curl -sS -o "$2" -w '%{http_code}' --max-time 10 "$1" 2>/dev/null || echo "000"
}

check_status() {
  local name="$1" url="$2" expected="$3" body="${TMP_DIR}/body"
  local code
  code="$(http_code "${url}" "${body}")"
  if [[ "${code}" == "${expected}" ]]; then
    pass "${name} (HTTP ${code})"
  else
    fail "${name}: expected HTTP ${expected}, got ${code} (${url})"
  fi
}

check_css() {
  local name="$1" page="$2" origin="${3:-$2}" body="${TMP_DIR}/page"
  local code css type
  code="$(http_code "${page}" "${body}")"
  if [[ "${code}" != "200" ]]; then
    fail "${name}: page returned HTTP ${code}"
    return
  fi
  css="$(grep -oE '/_next/static/css/[^" ]+\.css' "${body}" | head -n 1 || true)"
  if [[ -z "${css}" ]]; then
    fail "${name}: no stylesheet link in HTML"
    return
  fi
  type="$(curl -fsS -o /dev/null -w '%{content_type}' --max-time 10 "${origin%/}${css}" 2>/dev/null || true)"
  if [[ "${type}" == text/css* ]]; then
    pass "${name}: stylesheet ${css} (${type})"
  else
    fail "${name}: stylesheet ${css} returned ${type:-no response}"
  fi
}

if [[ "${VOMP_WEBSITE_ONLY:-0}" == "1" ]]; then
  echo "== API / admin (deferred) =="
  echo "  • skipped: website-only deployment; API/admin intentionally not started"
else
  echo "== API =="
  check_status "API health" "${API_URL}/api/health" 200
  if curl -fsS --max-time 10 "${API_URL}/api/health" | grep -q '"ok":true'; then
    pass "API reports database ok"
  else
    fail "API health does not report ok=true"
  fi
  check_status "Unauthenticated admin API (must be 401)" "${API_URL}/api/admin/overview" 401

  echo "== Admin console =="
  check_status "Admin login" "${ADMIN_URL}/login" 200
  check_status "Admin same-origin API proxy" "${ADMIN_URL}/api/health" 200
  check_css "Admin CSS" "${ADMIN_URL}/login" "${ADMIN_URL}"
  check_status "Unauthenticated admin proxy (must be 401)" "${ADMIN_URL}/api/admin/overview" 401
fi

echo "== Public website =="
check_status "Website health" "${WEB_URL}/healthz" 200
if [[ "${VOMP_WEBSITE_ONLY:-0}" == "1" ]]; then
  echo "  • skipped: /api proxy (API not deployed yet)"
else
  check_status "Public venues API proxy" "${WEB_URL}/api/v1/public/venues" 200
fi
check_css "Website CSS" "${WEB_URL}/" "${WEB_URL}"

echo "== HTTP CSP =="
while IFS='|' read -r name url envfile; do
  if [[ -f "${envfile}" ]] && grep -q '^CSP_UPGRADE_INSECURE_REQUESTS=0' "${envfile}"; then
    if curl -sS -D - -o /dev/null --max-time 10 "${url}/" | grep -qi 'upgrade-insecure-requests'; then
      fail "${name}: CSP still forces HTTPS assets"
    else
      pass "${name}: CSP does not force HTTPS assets"
    fi
  fi
done <<EOF
website|${WEB_URL}|${VOMP_ENV}/website.env
EOF
if [[ "${VOMP_WEBSITE_ONLY:-0}" != "1" ]]; then
  while IFS='|' read -r name url envfile; do
    if [[ -f "${envfile}" ]] && grep -q '^CSP_UPGRADE_INSECURE_REQUESTS=0' "${envfile}"; then
      if curl -sS -D - -o /dev/null --max-time 10 "${url}/" | grep -qi 'upgrade-insecure-requests'; then
        fail "${name}: CSP still forces HTTPS assets"
      else
        pass "${name}: CSP does not force HTTPS assets"
      fi
    fi
  done <<EOF
admin|${ADMIN_URL}|${VOMP_ENV}/admin.env
EOF
fi

echo
if [[ "${FAILURES}" -eq 0 ]]; then
  echo "✓ All checks passed."
else
  echo "✗ ${FAILURES} check(s) failed." >&2
  exit 1
fi
