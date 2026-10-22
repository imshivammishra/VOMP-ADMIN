#!/usr/bin/env bash
# Create production environment files outside the repositories.
#
# Current VPS layout:
#   sudo -u adarsharma bash /opt/vomp-deploy/admin-backend/deploy/scripts/init-env.sh
#
# Direct-IP / plain-HTTP bootstrap (what the current server uses until DNS+TLS):
#   sudo -u adarsharma env \
#     FRONTEND_ORIGIN=http://94.136.188.197:3100 \
#     ADMIN_ORIGIN=http://94.136.188.197:3102 \
#     API_ORIGIN=http://127.0.0.1:3101 \
#     COOKIE_SECURE=false TRUST_PROXY=0 INCLUDE_WWW=0 \
#     EXTRA_CORS_ORIGINS=http://127.0.0.1:3100,http://127.0.0.1:3102 \
#     bash /opt/vomp-deploy/admin-backend/deploy/scripts/init-env.sh
#
# Once DNS and HTTPS are ready, use the domain profile:
#   sudo -u adarsharma env DOMAIN=venueonmyplate.in \
#     bash /opt/vomp-deploy/admin-backend/deploy/scripts/init-env.sh
set -euo pipefail

FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-${DOMAIN:-venueonmyplate.in}}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${FRONTEND_DOMAIN}}"
API_DOMAIN="${API_DOMAIN:-}"

FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://${FRONTEND_DOMAIN}}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-https://${ADMIN_DOMAIN}}"
API_ORIGIN="${API_ORIGIN:-http://127.0.0.1:3101}"

# Browsers use /api on the current origin by default, which keeps the session
# cookie first-party. Set BROWSER_API_URL to the API origin only if you
# deliberately want direct browser-to-API traffic.
BROWSER_API_URL="${BROWSER_API_URL:-/}"

COOKIE_SECURE="${COOKIE_SECURE:-true}"
CSP_UPGRADE_INSECURE_REQUESTS="${CSP_UPGRADE_INSECURE_REQUESTS:-0}"
TRUST_PROXY="${TRUST_PROXY:-1}"

# Include www only for the production domain profile. Plain-HTTP/IP profiles
# must not advertise an HTTPS www origin.
if [[ -z "${INCLUDE_WWW:-}" ]]; then
  if [[ -n "${API_DOMAIN}" || "${FRONTEND_ORIGIN}" == http://* ]]; then
    INCLUDE_WWW=0
  else
    INCLUDE_WWW=1
  fi
fi

CORS_ORIGINS="${FRONTEND_ORIGIN}"
if [[ "${INCLUDE_WWW}" == "1" && "${FRONTEND_ORIGIN}" == https://* ]]; then
  CORS_ORIGINS+=",https://www.${FRONTEND_DOMAIN}"
fi
CORS_ORIGINS+=",${ADMIN_ORIGIN}"
if [[ -n "${EXTRA_CORS_ORIGINS:-}" ]]; then
  CORS_ORIGINS+=",${EXTRA_CORS_ORIGINS}"
fi

# Remove duplicates while preserving order.
IFS=',' read -r -a _origins <<< "${CORS_ORIGINS}"
declare -A _seen=()
_clean_origins=()
for _origin in "${_origins[@]}"; do
  [[ -z "${_origin}" || -n "${_seen[$_origin]:-}" ]] && continue
  _seen["$_origin"]=1
  _clean_origins+=("$_origin")
done
CORS_ORIGINS="$(IFS=,; echo "${_clean_origins[*]}")"
unset _origins _seen _clean_origins _origin

SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@venueonmyplate.in}"
BASE_DIR="${VOMP_BASE:-/opt/vomp-deploy}"
ENV_DIR="${BASE_DIR}/shared/env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "${SCRIPT_DIR}")"

mkdir -p "${ENV_DIR}"
chmod 700 "${BASE_DIR}/shared" "${ENV_DIR}" 2>/dev/null || true

render_env() {
  local source="$1"
  local target="$2"
  if [[ -f "${target}" ]]; then
    echo "• Keeping existing ${target}"
    return 1
  fi
  sed \
    -e "s|__FRONTEND_ORIGIN__|${FRONTEND_ORIGIN}|g" \
    -e "s|__ADMIN_ORIGIN__|${ADMIN_ORIGIN}|g" \
    -e "s|__API_ORIGIN__|${API_ORIGIN}|g" \
    -e "s|__CORS_ORIGINS__|${CORS_ORIGINS}|g" \
    -e "s|__BROWSER_API_URL__|${BROWSER_API_URL}|g" \
    -e "s|__SEED_ADMIN_EMAIL__|${SEED_ADMIN_EMAIL}|g" \
    -e "s|__COOKIE_SECURE__|${COOKIE_SECURE}|g" \
    -e "s|__CSP_UPGRADE_INSECURE_REQUESTS__|${CSP_UPGRADE_INSECURE_REQUESTS}|g" \
    -e "s|__TRUST_PROXY__|${TRUST_PROXY}|g" \
    -e "s|__DB_PATH__|${BASE_DIR}/shared/data/vomp.sqlite|g" \
    -e "s|__UPLOADS_DIR__|${BASE_DIR}/shared/uploads|g" \
    "${source}" > "${target}"
  chmod 600 "${target}"
  echo "• Created ${target}"
  return 0
}

render_env "${DEPLOY_DIR}/env/api.env.example" "${ENV_DIR}/api.env" || true
render_env "${DEPLOY_DIR}/env/admin.env.example" "${ENV_DIR}/admin.env" || true
render_env "${DEPLOY_DIR}/env/website.env.example" "${ENV_DIR}/website.env" || true

if grep -q "replace-with-a-strong-password" "${ENV_DIR}/api.env" 2>/dev/null; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl is required to generate the initial admin password." >&2
    exit 1
  fi
  ADMIN_PASS="Vomp$(openssl rand -hex 6)!$(openssl rand -hex 3)"
  sed -i "s/replace-with-a-strong-password/${ADMIN_PASS}/" "${ENV_DIR}/api.env"
  CRED_FILE="${ENV_DIR}/initial-admin.txt"
  {
    echo "VOMP initial admin credentials"
    echo "email=${SEED_ADMIN_EMAIL}"
    echo "password=${ADMIN_PASS}"
    echo ""
    echo "Change this password after the first login, then delete this file."
  } >"${CRED_FILE}"
  chmod 600 "${CRED_FILE}"
  echo ""
  echo "Initial admin credentials written to: ${CRED_FILE}"
  echo "Read them with: cat ${CRED_FILE}"
fi

echo ""
echo "Environment files:"
echo "  ${ENV_DIR}/api.env"
echo "  ${ENV_DIR}/admin.env"
echo "  ${ENV_DIR}/website.env"
echo ""
echo "Public hosts:"
echo "  Website : ${FRONTEND_ORIGIN}"
echo "  Admin   : ${ADMIN_ORIGIN}"
echo "  API     : ${API_ORIGIN} (private)"
echo "  Browser API base: ${BROWSER_API_URL}"
echo "  Cookie Secure: ${COOKIE_SECURE}"
echo "  CSP upgrade-insecure-requests: ${CSP_UPGRADE_INSECURE_REQUESTS}"
echo "  TRUST_PROXY: ${TRUST_PROXY}"
echo ""
echo "Next: bash ${DEPLOY_DIR}/scripts/deploy.sh"
