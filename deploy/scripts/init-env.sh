#!/usr/bin/env bash
# Create production environment files outside the repositories.
# Run as the application user: sudo -u vomp bash deploy/scripts/init-env.sh
set -euo pipefail

DOMAIN="${DOMAIN:-venueonmyplate.in}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${DOMAIN}}"
BASE_DIR="${VOMP_BASE:-/var/www/vomp}"
ENV_DIR="${BASE_DIR}/shared/env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "${SCRIPT_DIR}")"

mkdir -p "${ENV_DIR}"
chmod 700 "${ENV_DIR}"

copy_env() {
  local source="$1"
  local target="$2"
  if [[ -f "${target}" ]]; then
    echo "• Keeping existing ${target}"
    return 1
  fi
  sed -e "s/venueonmyplate\.in/${DOMAIN}/g" -e "s/admin\.${DOMAIN}/${ADMIN_DOMAIN}/g" "${source}" > "${target}"
  chmod 600 "${target}"
  echo "• Created ${target}"
  return 0
}

copy_env "${DEPLOY_DIR}/env/api.env.example" "${ENV_DIR}/api.env" || true
copy_env "${DEPLOY_DIR}/env/admin.env.example" "${ENV_DIR}/admin.env" || true
copy_env "${DEPLOY_DIR}/env/website.env.example" "${ENV_DIR}/website.env" || true

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
echo "Review SEED_ADMIN_EMAIL, then run deploy.sh."
