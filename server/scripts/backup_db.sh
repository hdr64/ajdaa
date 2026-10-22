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

# --- Uploaded media ---------------------------------------------------------
# The database dump does not contain uploaded files, so they are mirrored into
# the backup directory as well.
#
# `rsync -a` WITHOUT --delete is deliberate: a file removed from the app stays
# recoverable in the backup. --no-owner/--no-group keep the run green when a
# file in the uploads tree is owned by another user.
UPLOAD_DIR_RAW="${UPLOAD_DIR:-./uploads}"
if [[ "${UPLOAD_DIR_RAW}" = /* ]]; then
  UPLOADS_DIR="${UPLOAD_DIR_RAW}"
else
  UPLOADS_DIR="${SERVER_DIR}/${UPLOAD_DIR_RAW#./}"
fi
UPLOADS_BACKUP_DIR="${UPLOADS_BACKUP_DIR:-${BACKUP_DIR}/uploads}"

if [[ ! -d "${UPLOADS_DIR}" ]]; then
  log "WARNING: uploads directory ${UPLOADS_DIR} not found — media was NOT backed up"
elif ! command -v rsync >/dev/null 2>&1; then
  log "WARNING: rsync not found — media was NOT backed up"
else
  log "mirroring uploads to ${UPLOADS_BACKUP_DIR}"
  mkdir -p "${UPLOADS_BACKUP_DIR}"
  rsync -a --no-owner --no-group "${UPLOADS_DIR}/" "${UPLOADS_BACKUP_DIR}/"
  log "uploads mirrored: $(find "${UPLOADS_BACKUP_DIR}" -type f | wc -l | tr -d ' ') file(s)"
fi

# --- Private CV storage -----------------------------------------------------
# CVs live in a private directory and must be backed up alongside uploads, but
# they are NOT copied to the test instance.
PRIVATE_DIR_RAW="${PRIVATE_DIR:-./private}"
if [[ "${PRIVATE_DIR_RAW}" = /* ]]; then
  PRIVATE_DIR_ABS="${PRIVATE_DIR_RAW}"
else
  PRIVATE_DIR_ABS="${SERVER_DIR}/${PRIVATE_DIR_RAW#./}"
fi
PRIVATE_BACKUP_DIR="${PRIVATE_BACKUP_DIR:-${BACKUP_DIR}/private}"

if [[ ! -d "${PRIVATE_DIR_ABS}" ]]; then
  log "WARNING: private directory ${PRIVATE_DIR_ABS} not found — CVs were NOT backed up"
elif ! command -v rsync >/dev/null 2>&1; then
  log "WARNING: rsync not found — CVs were NOT backed up"
else
  log "mirroring private storage to ${PRIVATE_BACKUP_DIR}"
  mkdir -p "${PRIVATE_BACKUP_DIR}"
  chmod 700 "${PRIVATE_BACKUP_DIR}"
  rsync -a --no-owner --no-group "${PRIVATE_DIR_ABS}/" "${PRIVATE_BACKUP_DIR}/"
  log "private storage mirrored: $(find "${PRIVATE_BACKUP_DIR}" -type f | wc -l | tr -d ' ') file(s)"
fi
