#!/usr/bin/env bash
# Install the Nginx reverse proxy and obtain HTTPS certificates.
# Run as root after DNS points to the VPS:
#   sudo DOMAIN=venueonmyplate.in LETSENCRYPT_EMAIL=you@domain.com \
#     bash deploy/scripts/enable-nginx.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

DOMAIN="${DOMAIN:-venueonmyplate.in}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${DOMAIN}}"
EMAIL="${LETSENCRYPT_EMAIL:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "${SCRIPT_DIR}")"

if [[ -z "${EMAIL}" ]]; then
  echo "Set LETSENCRYPT_EMAIL to receive certificate expiry notices." >&2
  exit 1
fi

mkdir -p /var/www/certbot
install -m 644 "${DEPLOY_DIR}/nginx/http-bootstrap.conf" /etc/nginx/sites-available/vomp.conf
sed -i "s/venueonmyplate\.in/${DOMAIN}/g" /etc/nginx/sites-available/vomp.conf
sed -i "s/admin\.${DOMAIN}/${ADMIN_DOMAIN}/g" /etc/nginx/sites-available/vomp.conf

ln -sfn /etc/nginx/sites-available/vomp.conf /etc/nginx/sites-enabled/vomp.conf
rm -f /etc/nginx/sites-enabled/default

echo "→ Testing HTTP configuration"
nginx -t
systemctl reload nginx

echo "→ Requesting certificates"
certbot certonly --webroot -w /var/www/certbot \
  -d "${DOMAIN}" -d "www.${DOMAIN}" -d "${ADMIN_DOMAIN}" \
  --email "${EMAIL}" --agree-tos --non-interactive --keep-until-expiring

echo "→ Installing HTTPS configuration"
install -m 644 "${DEPLOY_DIR}/nginx/venueonmyplate.conf" /etc/nginx/sites-available/vomp.conf
sed -i "s/venueonmyplate\.in/${DOMAIN}/g" /etc/nginx/sites-available/vomp.conf
sed -i "s/admin\.${DOMAIN}/${ADMIN_DOMAIN}/g" /etc/nginx/sites-available/vomp.conf

nginx -t
systemctl reload nginx

echo ""
echo "✓ Nginx is live."
echo "  Website : https://${DOMAIN}"
echo "  Admin   : https://${ADMIN_DOMAIN}"
echo "  API     : https://${ADMIN_DOMAIN}/api/health"
