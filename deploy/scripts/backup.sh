#!/usr/bin/env bash
# Safe SQLite backup for the current /opt/vomp-deploy layout.
# Add to the application user's crontab:
#   15 2 * * * /opt/vomp-deploy/admin-backend/deploy/scripts/backup.sh >> /opt/vomp-deploy/shared/logs/backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "${SCRIPT_DIR}/lib.sh"
vomp_init

DB_PATH="${DB_PATH:-${VOMP_DATA}/vomp.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-${VOMP_BACKUPS}}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "$(date -Is) database not found: ${DB_PATH}"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for backups. Install it with: sudo apt-get install -y sqlite3" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}" || true
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/vomp-${STAMP}.sqlite"

sqlite3 "${DB_PATH}" ".backup '${TARGET}'"
gzip -f "${TARGET}"
chmod 600 "${TARGET}.gz"
find "${BACKUP_DIR}" -name 'vomp-*.sqlite.gz' -mtime "+${KEEP_DAYS}" -delete

echo "$(date -Is) backup written: ${TARGET}.gz"
