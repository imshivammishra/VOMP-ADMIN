#!/usr/bin/env bash
# Safe SQLite backup. Add to the application user's crontab:
#   15 2 * * * /var/www/vomp/workspace/deploy/scripts/backup.sh >> /var/www/vomp/shared/logs/backup.log 2>&1
set -euo pipefail

BASE_DIR="${VOMP_BASE:-/var/www/vomp}"
DB_PATH="${DB_PATH:-${BASE_DIR}/shared/data/vomp.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-${BASE_DIR}/shared/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "$(date -Is) database not found: ${DB_PATH}"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/vomp-${STAMP}.sqlite"

sqlite3 "${DB_PATH}" ".backup '${TARGET}'"
gzip -f "${TARGET}"
find "${BACKUP_DIR}" -name 'vomp-*.sqlite.gz' -mtime "+${KEEP_DAYS}" -delete

echo "$(date -Is) backup written: ${TARGET}.gz"
