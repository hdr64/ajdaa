#!/usr/bin/env bash
#
# Server-side deploy runner for Ajda — TEST INSTANCE ONLY.
#
#   Usage: remote-deploy.sh <test> <git-ref>
#
# It runs on the VPS as the unprivileged user `salah`. The only privileged
# operation is `sudo systemctl restart ajda-api-test`, which the owner allows
# with a single sudoers rule (see deploy/README-deploy.md).
#
#   test -> /srv/ajda/test   ajda-api-test   :4001   ajda_test
#
# PRODUCTION IS NEVER DEPLOYED BY THIS SCRIPT. The production instance is
# deployed by hand, with the runbook in deploy/README-deploy.md. Any target
# other than `test` is rejected.
#
# Data-preservation rules (never break these):
#   * never runs `git clean`
#   * never deletes anything under server/uploads
#   * never reads, writes or removes a .env file itself
#     — with exactly one documented exception: the database guard below reads
#     ONLY the database name out of DATABASE_URL in <instance>/server/.env, to
#     prove that this deploy cannot touch the production database. The URL,
#     the user and the password are never printed, never logged and no other
#     key of the file is read.
#   * never runs a command against the production database
#
set -Eeuo pipefail

readonly TEST_DIR='/srv/ajda/test'
readonly TEST_UNIT='ajda-api-test'
readonly TEST_PORT=4001
readonly HEALTH_TIMEOUT_SECONDS=30
readonly LOCK_TIMEOUT_SECONDS=600

APP_DIR=''
UNIT=''
PORT=''
HEALTH_URL=''
TARGET=''
REF=''
RESOLVED_SHA=''
PREVIOUS_SHA=''

log() {
  local level="$1"
  shift
  printf '%s level=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$*"
}

# Errors go to stderr so that a failing helper inside a command substitution
# cannot pollute a captured value.
fail() {
  printf '%s level=error %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: remote-deploy.sh <test> <git-ref>

  test       deployment target (the only one that exists)
  git-ref    a 40-character commit SHA, or a branch name matching
             ^[A-Za-z0-9._/-]+$

Production is deployed manually - see deploy/README-deploy.md.
EOF
}

trap 'fail "aborted at line ${LINENO}"' ERR

# --- input validation -------------------------------------------------------

# Accepts a full commit SHA or a branch name. The branch pattern is tight on
# purpose: the value ends up in a `git checkout` argument, so anything that
# could be read as a flag, a path traversal or a refspec is rejected.
validate_ref() {
  local ref="$1"

  [[ "$ref" =~ ^[0-9a-f]{40}$ ]] && return 0

  [[ "$ref" =~ ^[A-Za-z0-9._/-]+$ ]] || return 1
  [[ "$ref" != -* ]] || return 1
  [[ "$ref" != *..* ]] || return 1
  [[ "$ref" != *//* ]] || return 1
  [[ "$ref" != */ ]] || return 1
  [[ "$ref" != *.lock ]] || return 1
  [[ "$ref" != */. ]] || return 1

  return 0
}

resolve_target() {
  case "$1" in
    test)
      APP_DIR="$TEST_DIR"
      UNIT="$TEST_UNIT"
      PORT="$TEST_PORT"
      ;;
    prod)
      usage
      fail "production is deployed manually, see README-deploy.md"
      ;;
    *)
      usage
      fail "unknown target '$1' (the only target is 'test')"
      ;;
  esac
  HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
}

# --- database guard ----------------------------------------------------------

# Proves that the instance this script deploys can only ever write to a test
# database. The database name is read from DATABASE_URL in the instance's
# .env file - the one documented exception to the "never reads .env" rule.
# The URL, the user and the password are never printed and never logged.
check_database_target() {
  local env_file="${APP_DIR}/server/.env"
  local url=''
  local base=''
  local db_name=''

  [[ -f "$env_file" ]] \
    || fail "database guard: ${env_file} is missing - refusing to deploy"

  # Only the DATABASE_URL line is read. The value stays in a local variable:
  # it is never echoed, never logged and never handed to another command.
  url="$(grep -m1 -E '^[[:space:]]*DATABASE_URL[[:space:]]*=' "$env_file" 2>/dev/null || true)"
  url="${url#*=}"
  url="${url#"${url%%[![:space:]]*}"}"
  url="${url%"${url##*[![:space:]]}"}"
  if [[ "$url" == \"*\" ]]; then
    url="${url:1:${#url}-2}"
  elif [[ "$url" == \'*\' ]]; then
    url="${url:1:${#url}-2}"
  fi

  [[ -n "$url" ]] \
    || fail "database guard: DATABASE_URL is missing from ${env_file} - refusing to deploy"

  # Drop the query string, then take the path segment after the last slash.
  base="${url%%\?*}"
  db_name="${base##*/}"

  [[ "$db_name" != "$base" && -n "$db_name" ]] \
    || fail "database guard: cannot parse the database name from DATABASE_URL - refusing to deploy"

  # A database name is a plain identifier: anything else means the URL was not
  # parsed the way it was meant to be.
  [[ "$db_name" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || fail "database guard: cannot parse the database name from DATABASE_URL - refusing to deploy"

  [[ "$db_name" =~ ^[A-Za-z0-9_]*_test$ ]] \
    || fail "database guard: the database name must end with _test (got '${db_name}') - refusing to deploy"

  log info "event=db.guard.ok name=${db_name}"
}

# --- environment ------------------------------------------------------------

# The VPS keeps node under nvm, which is not on the PATH of a non-login shell.
resolve_node() {
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
    nvm use --silent >/dev/null 2>&1 || true
  fi

  if ! command -v npm >/dev/null 2>&1; then
    local candidate
    candidate="$(find "$HOME/.nvm/versions/node" -mindepth 2 -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -n 1)"
    [[ -n "$candidate" ]] && export PATH="$candidate:$PATH"
  fi

  command -v npm >/dev/null 2>&1 || fail "npm not found (nvm is expected under $HOME/.nvm)"
}

require_tools() {
  local tool
  for tool in git curl flock; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool is required but not installed"
  done
  resolve_node
}

# --- locking ----------------------------------------------------------------

# One deploy at a time. The lock lives in the instance checkout.
acquire_lock() {
  mkdir -p "${APP_DIR}/.deploy"
  exec 9>"${APP_DIR}/.deploy/deploy.lock"
  if ! flock -w "$LOCK_TIMEOUT_SECONDS" 9; then
    fail "another deploy is already running for ${APP_DIR}"
  fi
}

# --- git --------------------------------------------------------------------

resolve_ref_sha() {
  local ref="$1"
  local sha=''

  if [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then
    git cat-file -e "${ref}^{commit}" 2>/dev/null \
      || fail "commit ${ref} is not known to this checkout (run git fetch --prune origin first)"
    printf '%s' "$ref"
    return 0
  fi

  sha="$(git rev-parse --verify --quiet "refs/remotes/origin/${ref}^{commit}" 2>/dev/null || true)"
  if [[ -z "$sha" ]]; then
    sha="$(git rev-parse --verify --quiet "refs/heads/${ref}^{commit}" 2>/dev/null || true)"
  fi
  [[ -n "$sha" ]] || fail "ref '${ref}' does not exist on origin"

  printf '%s' "$sha"
}

# --- build ------------------------------------------------------------------

# The SPA is built into a staging directory and swapped in, so a failed build
# never leaves the site without a `dist/`.
build_frontend() {
  rm -rf dist.new dist.old
  ./node_modules/.bin/tsc -b
  ./node_modules/.bin/vite build --outDir dist.new --emptyOutDir
  if [[ -d dist ]]; then
    mv dist dist.old
  fi
  mv dist.new dist
  rm -rf dist.old
}

# --- health -----------------------------------------------------------------

wait_for_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  while ((SECONDS < deadline)); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      log info "event=health.ok url=${HEALTH_URL}"
      return 0
    fi
    sleep 1
  done

  log error "event=health.timeout url=${HEALTH_URL} seconds=${HEALTH_TIMEOUT_SECONDS}"
  return 1
}

# --- rollback ---------------------------------------------------------------

# Rollback restores the code only. Database migrations are not reversible; the
# test database is a disposable copy, so a re-seed is the way back for the
# data.
rollback() {
  log error "event=deploy.rollback.start sha=${PREVIOUS_SHA}"

  if ! git checkout --detach "$PREVIOUS_SHA"; then
    log error "event=deploy.rollback.checkout_failed sha=${PREVIOUS_SHA}"
    exit 1
  fi

  # Rebuild both sides from the previous commit so the running instance matches
  # the rolled-back code (the SPA and the API are served together).
  if ! npm --prefix server run db:gen:prod; then
    log error "event=deploy.rollback.schema_failed"
  fi
  if ! npm --prefix server run build; then
    log error "event=deploy.rollback.server_build_failed"
  fi
  if ! build_frontend; then
    log error "event=deploy.rollback.frontend_build_failed"
  fi
  if ! sudo systemctl restart "$UNIT"; then
    log error "event=deploy.rollback.restart_failed"
  fi

  log error "event=deploy.rollback.done sha=${PREVIOUS_SHA}"
  exit 1
}

# --- deploy steps ------------------------------------------------------------

# Moves the checkout to the requested commit. The previous commit is recorded
# first, because it is the rollback target.
prepare_checkout() {
  PREVIOUS_SHA="$(git rev-parse HEAD)"
  printf '%s\n' "$PREVIOUS_SHA" >"${APP_DIR}/.deploy/previous"
  log info "event=deploy.previous_commit sha=${PREVIOUS_SHA}"

  git fetch --prune origin
  RESOLVED_SHA="$(resolve_ref_sha "$REF")"
  git checkout --detach "$RESOLVED_SHA"
  log info "event=deploy.checkout sha=${RESOLVED_SHA}"
}

# Installs, migrates and builds. The database guard has already proved that
# the target database is a test database.
build_instance() {
  log info "event=build.start"
  npm ci
  npm --prefix server ci
  npm --prefix server run db:gen:prod
  npm --prefix server run db:migrate
  npm --prefix server run build
  build_frontend
  log info "event=build.done"
}

# Restarts the unit and waits for the health endpoint. A failed health check
# rolls the instance back to the previous commit.
restart_and_verify() {
  log info "event=service.restart unit=${UNIT}"

  if ! sudo systemctl restart "$UNIT"; then
    log error "event=service.restart_failed unit=${UNIT}"
    rollback
  fi

  if ! wait_for_health; then
    rollback
  fi
}

# --- main -------------------------------------------------------------------

main() {
  [[ $# -eq 2 ]] || {
    usage
    fail "expected 2 arguments, got $#"
  }

  TARGET="$1"
  REF="$2"

  validate_ref "$REF" || fail "invalid git ref '${REF}'"
  resolve_target "$TARGET"
  require_tools

  log info "event=deploy.start target=${TARGET} dir=${APP_DIR} unit=${UNIT} ref=${REF}"

  [[ -d "$APP_DIR" ]] || fail "instance directory ${APP_DIR} does not exist"
  cd "$APP_DIR"
  git rev-parse --git-dir >/dev/null 2>&1 || fail "${APP_DIR} is not a git checkout"

  # Prisma prefers a process environment variable over the .env file. If the
  # login shell of this user exports one (e.g. for manual production work), the
  # guard below would approve the file while migrate hit another database.
  unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL

  # Before the checkout, before any npm command: prove that this instance can
  # only write to a test database.
  check_database_target

  acquire_lock
  prepare_checkout
  build_instance
  restart_and_verify

  log info "event=deploy.success target=${TARGET} sha=${RESOLVED_SHA} url=${HEALTH_URL}"
}

main "$@"