#!/usr/bin/env bash
# Install the Nginx reverse proxy and obtain HTTPS certificates.
# Run as root after DNS points to the VPS.
#
# Production (two hosts, same-origin API):
#   sudo DOMAIN=venueonmyplate.in LETSENCRYPT_EMAIL=you@domain.com \
#     bash deploy/scripts/enable-nginx.sh
#
# Staging/development (three hosts):
#   sudo FRONTEND_DOMAIN=dev.venueonmyplate.com \
#     ADMIN_DOMAIN=dev-admin.venueonmyplate.com \
#     API_DOMAIN=dev.api.venueonmyplate.com \
#     LETSENCRYPT_EMAIL=you@domain.com \
#     bash deploy/scripts/enable-nginx.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-${DOMAIN:-venueonmyplate.in}}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${FRONTEND_DOMAIN}}"
API_DOMAIN="${API_DOMAIN:-}"
CERT_NAME="${CERT_NAME:-${FRONTEND_DOMAIN}}"
EMAIL="${LETSENCRYPT_EMAIL:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "${SCRIPT_DIR}")"
NGINX_SITE="/etc/nginx/sites-available/vomp.conf"

if [[ -z "${EMAIL}" ]]; then
  echo "Set LETSENCRYPT_EMAIL to receive certificate expiry notices." >&2
  exit 1
fi

mkdir -p /var/www/certbot

render_split() {
  local source="$1"
  local target="$2"
  install -m 644 "${source}" "${target}"
  sed -i \
    -e "s|__FRONTEND_HOST__|${FRONTEND_DOMAIN}|g" \
    -e "s|__ADMIN_HOST__|${ADMIN_DOMAIN}|g" \
    -e "s|__API_HOST__|${API_DOMAIN}|g" \
    -e "s|__CERT_NAME__|${CERT_NAME}|g" \
    "${target}"
}

render_same_origin() {
  local source="$1"
  local target="$2"
  install -m 644 "${source}" "${target}"
  sed -i \
    -e "s/venueonmyplate\.in/${FRONTEND_DOMAIN}/g" \
    -e "s/admin\.${FRONTEND_DOMAIN}/${ADMIN_DOMAIN}/g" \
    "${target}"
}

if [[ -n "${API_DOMAIN}" ]]; then
  PROFILE="split"
  render_split "${DEPLOY_DIR}/nginx/http-bootstrap-split.conf" "${NGINX_SITE}"
  CERT_DOMAINS=(-d "${FRONTEND_DOMAIN}" -d "${ADMIN_DOMAIN}" -d "${API_DOMAIN}")
else
  PROFILE="same-origin"
  render_same_origin "${DEPLOY_DIR}/nginx/http-bootstrap.conf" "${NGINX_SITE}"
  CERT_DOMAINS=(-d "${FRONTEND_DOMAIN}" -d "www.${FRONTEND_DOMAIN}" -d "${ADMIN_DOMAIN}")
fi

ln -sfn "${NGINX_SITE}" /etc/nginx/sites-enabled/vomp.conf
rm -f /etc/nginx/sites-enabled/default

echo "→ Testing HTTP configuration"
nginx -t
systemctl reload nginx

echo "→ Requesting certificates (${PROFILE})"
certbot certonly --webroot -w /var/www/certbot \
  "${CERT_DOMAINS[@]}" \
  --cert-name "${CERT_NAME}" \
  --email "${EMAIL}" --agree-tos --non-interactive \
  --keep-until-expiring --expand

echo "→ Installing HTTPS configuration"
if [[ "${PROFILE}" == "split" ]]; then
  render_split "${DEPLOY_DIR}/nginx/venueonmyplate-split.conf" "${NGINX_SITE}"
else
  render_same_origin "${DEPLOY_DIR}/nginx/venueonmyplate.conf" "${NGINX_SITE}"
fi

nginx -t
systemctl reload nginx

echo ""
echo "✓ Nginx is live."
echo "  Website : https://${FRONTEND_DOMAIN}"
echo "  Admin   : https://${ADMIN_DOMAIN}"
if [[ -n "${API_DOMAIN}" ]]; then
  echo "  API     : https://${API_DOMAIN}/api/health"
else
  echo "  API     : https://${ADMIN_DOMAIN}/api/health"
fi
