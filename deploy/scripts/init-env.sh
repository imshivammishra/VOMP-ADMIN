#!/usr/bin/env bash
# Create production environment files outside the repositories.
# Run as the application user: sudo -u vomp bash deploy/scripts/init-env.sh
#
# Production (.in, same-origin API):
#   sudo -u vomp bash deploy/scripts/init-env.sh
#
# Staging/development (.com, three hosts):
#   sudo -u vomp env \
#     FRONTEND_DOMAIN=dev.venueonmyplate.com \
#     ADMIN_DOMAIN=dev-admin.venueonmyplate.com \
#     API_DOMAIN=dev.api.venueonmyplate.com \
#     bash deploy/scripts/init-env.sh
set -euo pipefail

FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-${DOMAIN:-venueonmyplate.in}}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${FRONTEND_DOMAIN}}"
API_DOMAIN="${API_DOMAIN:-}"

FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://${FRONTEND_DOMAIN}}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-https://${ADMIN_DOMAIN}}"
API_ORIGIN="${API_ORIGIN:-https://${API_DOMAIN:-${ADMIN_DOMAIN}}}"

# Browsers use /api on the current origin by default, which keeps the session
# cookie first-party. Set BROWSER_API_URL to the API origin if you deliberately
# want direct browser-to-API traffic.
BROWSER_API_URL="${BROWSER_API_URL:-/}"

# Include www only for the production two-host profile unless overridden.
if [[ -z "${INCLUDE_WWW:-}" ]]; then
  if [[ -z "${API_DOMAIN}" ]]; then INCLUDE_WWW=1; else INCLUDE_WWW=0; fi
fi

CORS_ORIGINS="${FRONTEND_ORIGIN}"
if [[ "${INCLUDE_WWW}" == "1" ]]; then
  CORS_ORIGINS+=",https://www.${FRONTEND_DOMAIN}"
fi
CORS_ORIGINS+=",${ADMIN_ORIGIN}"

SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@venueonmyplate.com}"
BASE_DIR="${VOMP_BASE:-/var/www/vomp}"
ENV_DIR="${BASE_DIR}/shared/env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "${SCRIPT_DIR}")"

mkdir -p "${ENV_DIR}"
chmod 700 "${ENV_DIR}"

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
    "${source}" > "${target}"
  chmod 600 "${target}"
  echo "• Created ${target}"
  return 0
}

render_env "${DEPLOY_DIR}/env/api.env.example" "${ENV_DIR}/api.env" || true
render_env "${DEPLOY_DIR}/env/admin.env.example" "${ENV_DIR}/admin.env" || true
render_env "${DEPLOY_DIR}/env/website.env.example" "${ENV_DIR}/website.env" || true

if grep -q "replace-with-a-strong-password" "${ENV_DIR}/api.env" 2>/dev/null; then
  ADMIN_PASS="Vomp$(openssl rand -hex 4)!$(openssl rand -hex 2)"
  sed -i "s/replace-with-a-strong-password/${ADMIN_PASS}/" "${ENV_DIR}/api.env"
  echo ""
  echo "Initial admin password: ${ADMIN_PASS}"
  echo "Store it now. It is only printed once."
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
echo "  API     : ${API_ORIGIN}"
echo "  Browser API base: ${BROWSER_API_URL}"
echo ""
echo "Review SEED_ADMIN_EMAIL in ${ENV_DIR}/api.env, then run deploy.sh."
