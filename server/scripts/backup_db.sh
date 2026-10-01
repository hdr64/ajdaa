#!/usr/bin/env bash
#
# Nightly PostgreSQL backup for the Ajda API.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
trap 'fail "aborted at line ${LINENO}"' ERR

# Load secrets: prefer dedicated .env.backup, fall back to server/.env
if [[ -f "${SERVER_DIR}/.env.backup" ]]; then
  set -a
  source "${SERVER_DIR}/.env.backup"
  set +a
elif [[ -f "${SERVER_DIR}/.env" ]]; then
  set -a
  source "${SERVER_DIR}/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL is required (set it in ${SERVER_DIR}/.env or ${SERVER_DIR}/.env.backup)"
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ajda}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found (install postgresql-client-16)"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

PLAIN="${WORK_DIR}/ajda-${STAMP}.sql"
CUSTOM="${WORK_DIR}/ajda-${STAMP}.dump"

# Strip Prisma-specific query parameters (e.g. ?schema=public) that libpq/pg_dump rejects
CLEAN_DB_URL="$(printf '%s' "${DATABASE_URL}" | sed -E 's/([?&])(schema|connection_limit|pool_timeout)=[^&]*(&|$)/\1/g; s/[?&]$//')"

log "dumping database to ${CUSTOM}"
if ! pg_dump --dbname="${CLEAN_DB_URL}" --format=custom --compress=9 \
      --no-owner --no-acl --file="${CUSTOM}"; then
  fail "pg_dump failed"
fi

[[ -s "${CUSTOM}" ]] || fail "pg_dump produced an empty file"

if command -v pg_restore >/dev/null 2>&1; then
  log "verifying archive with pg_restore --list"
  pg_restore --list "${CUSTOM}" >/dev/null || fail "archive failed pg_restore verification"
fi

SIZE="$(du -h "${CUSTOM}" | cut -f1)"
log "archive OK (${SIZE})"

install -m 600 "${CUSTOM}" "${BACKUP_DIR}/ajda-${STAMP}.dump"
LATEST="${BACKUP_DIR}/ajda-latest.dump"
install -m 600 "${CUSTOM}" "${LATEST}"

log "pruning dumps older than ${RETENTION_DAYS} days (keeping ajda-latest.dump)"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'ajda-*.dump' \
  ! -name 'ajda-latest.dump' -mtime "+${RETENTION_DAYS}" -print -delete \
  || log "WARNING: prune step failed"

REMAINING="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'ajda-*.dump' | wc -l | tr -d ' ')"
log "done: ${REMAINING} archive(s) in ${BACKUP_DIR}"
