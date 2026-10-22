#!/usr/bin/env bash
# Shared helpers for the VOMP deployment scripts.
# This file is sourced by deploy-admin.sh, deploy-main.sh, deploy.sh and
# healthcheck.sh. It does not change the environment on its own.

vomp_init() {
  export VOMP_BASE="${VOMP_BASE:-/opt/vomp-deploy}"
  export VOMP_WORKSPACE="${VOMP_WORKSPACE:-${VOMP_BASE}/admin-backend}"
  export VOMP_WEBSITE="${VOMP_WEBSITE:-${VOMP_BASE}/main-website}"
  export VOMP_SHARED="${VOMP_SHARED:-${VOMP_BASE}/shared}"
  export VOMP_ENV="${VOMP_ENV:-${VOMP_SHARED}/env}"
  export VOMP_LOGS="${VOMP_LOGS:-${VOMP_SHARED}/logs}"
  export VOMP_DATA="${VOMP_DATA:-${VOMP_SHARED}/data}"
  export VOMP_UPLOADS="${VOMP_UPLOADS:-${VOMP_SHARED}/uploads}"
  export VOMP_BACKUPS="${VOMP_BACKUPS:-${VOMP_SHARED}/backups}"

  export API_PORT="${API_PORT:-3101}"
  export ADMIN_PORT="${ADMIN_PORT:-3102}"
  export WEB_PORT="${WEB_PORT:-3100}"
  export API_URL="${API_URL:-http://127.0.0.1:${API_PORT}}"
  export ADMIN_URL="${ADMIN_URL:-http://127.0.0.1:${ADMIN_PORT}}"
  export WEB_URL="${WEB_URL:-http://127.0.0.1:${WEB_PORT}}"
}

vomp_load_node() {
  if ! command -v node >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
    if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
      # shellcheck disable=SC1091
      . "${NVM_DIR}/nvm.sh"
      nvm use --silent 22 >/dev/null 2>&1 || true
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    local candidate
    candidate="$(printf '%s\n' "${HOME}"/.nvm/versions/node/v22.*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
    if [[ -n "${candidate}" && -d "${candidate}" ]]; then
      export PATH="${candidate}:${PATH}"
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js was not found. Install Node.js 22 or load nvm before deploying." >&2
    exit 1
  fi

  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "${major}" -lt 22 ]]; then
    echo "Node.js 22.5+ is required; found $(node -v)." >&2
    exit 1
  fi
}

vomp_load_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    local prefix
    prefix="$(npm prefix -g 2>/dev/null || true)"
    if [[ -n "${prefix}" && -x "${prefix}/bin/pm2" ]]; then
      export PATH="${prefix}/bin:${PATH}"
    fi
  fi

  PM2_BIN="${PM2_BIN:-$(command -v pm2 || true)}"
  if [[ -z "${PM2_BIN}" ]]; then
    echo "PM2 is not installed. Run: npm install -g pm2" >&2
    exit 1
  fi
  export PM2_BIN
}

vomp_prepare_dirs() {
  mkdir -p "${VOMP_LOGS}" "${VOMP_DATA}" "${VOMP_UPLOADS}" "${VOMP_BACKUPS}"
}

vomp_require_env() {
  local file
  for file in "$@"; do
    if [[ ! -f "${VOMP_ENV}/${file}" ]]; then
      echo "Missing ${VOMP_ENV}/${file}." >&2
      echo "Create the environment files first; see the deployment guide." >&2
      exit 1
    fi
  done
}

vomp_link_envs() {
  if [[ -f "${VOMP_ENV}/api.env" ]]; then
    ln -sfn "${VOMP_ENV}/api.env" "${VOMP_WORKSPACE}/apps/api/.env"
  fi
  if [[ -f "${VOMP_ENV}/admin.env" ]]; then
    ln -sfn "${VOMP_ENV}/admin.env" "${VOMP_WORKSPACE}/apps/admin/.env.local"
  fi
  if [[ -f "${VOMP_ENV}/website.env" ]]; then
    ln -sfn "${VOMP_ENV}/website.env" "${VOMP_WEBSITE}/.env.local"
  fi
}

vomp_wait_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-40}"
  local i
  for ((i = 0; i < attempts; i += 1)); do
    if curl -fsS --max-time 3 "${url}" >/dev/null 2>&1; then
      echo "  ✓ ${name} (${url})"
      return 0
    fi
    sleep 1
  done
  echo "  ✗ ${name} did not become ready (${url})" >&2
  return 1
}

vomp_start_or_reload() {
  local name="$1"
  if "${PM2_BIN}" describe "${name}" >/dev/null 2>&1; then
    "${PM2_BIN}" reload "${name}" --update-env
  else
    "${PM2_BIN}" start "${VOMP_WORKSPACE}/deploy/pm2/ecosystem.config.cjs" --only "${name}" --env production
  fi
}

vomp_pm2_save() {
  "${PM2_BIN}" save >/dev/null
}

vomp_print_paths() {
  cat <<EOF
  Base        : ${VOMP_BASE}
  Workspace   : ${VOMP_WORKSPACE}
  Website     : ${VOMP_WEBSITE}
  Shared data : ${VOMP_SHARED}
  API         : ${API_URL}
  Admin       : ${ADMIN_URL}
  Website     : ${WEB_URL}
EOF
}
