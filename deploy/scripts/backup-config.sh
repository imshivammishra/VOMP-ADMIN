#!/usr/bin/env bash
# Capture the current environment files and Git revisions before a deploy.
# Secrets stay on the server in a mode-600 archive; they are never printed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "${SCRIPT_DIR}/lib.sh"
vomp_init

mkdir -p "${VOMP_BACKUPS}"
chmod 700 "${VOMP_BACKUPS}" || true
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${VOMP_BACKUPS}/config-${STAMP}.tar.gz"

if [[ -d "${VOMP_ENV}" ]]; then
  tar -czf "${ARCHIVE}" -C "${VOMP_SHARED}" env
  chmod 600 "${ARCHIVE}"
  echo "  ✓ environment backup: ${ARCHIVE}"
else
  echo "  • no environment directory yet (${VOMP_ENV})"
fi

INFO="${VOMP_BACKUPS}/revisions-${STAMP}.txt"
{
  echo "created=$(date -Is)"
  echo "base=${VOMP_BASE}"
  for repo in "${VOMP_WORKSPACE}" "${VOMP_WEBSITE}"; do
    echo ""
    echo "[${repo}]"
    git -C "${repo}" rev-parse HEAD 2>/dev/null || echo "not-a-git-checkout"
    git -C "${repo}" status --short --branch 2>/dev/null || true
  done
} >"${INFO}"
chmod 600 "${INFO}"
echo "  ✓ revision record: ${INFO}"

# Keep a month of config snapshots.
find "${VOMP_BACKUPS}" -maxdepth 1 -name 'config-*.tar.gz' -mtime +30 -delete 2>/dev/null || true
find "${VOMP_BACKUPS}" -maxdepth 1 -name 'revisions-*.txt' -mtime +30 -delete 2>/dev/null || true
