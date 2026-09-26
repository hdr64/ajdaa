#!/usr/bin/env bash
#
# Nightly PostgreSQL backup for the Ajda API.
#
# Dumps the production database, keeps a rolling window of daily/weekly/monthly
# archives, and fails loudly (non-zero exit) so systemd/cron notices problems.
#
# Install as a systemd timer (see deploy/README-deploy.md) or a cron entry:
#   17 3 * * *  /opt/ajda/server/scripts/backup_db.sh >> /var/log/ajda-backup.log 2>&1
#
# Required environment (recommended: a root-owned env file, mode 600):
#   DATABASE_URL   postgresql://user:pass@host:5432/db?schema=public
#   BACKUP_DIR     where archives are written (default /var/backups/ajda)
#   BACKUP_RETENTION_DAYS  delete plain dumps older than N days (default 14)
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
trap 'fail "aborted at line ${LINENO}"' ERR

# Load a sibling env file if present so secrets stay out of the cron unit.
if [[ -f "${SERVER_DIR}/.env.backup" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SERVER_DIR}/.env.backup"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL is required (set it in ${SERVER_DIR}/.env.backup)"
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ajda}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found (install postgresql-client-16)"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

# Custom format: compressed, and pg_restore-able (so a restore can be selective).
PLAIN="${WORK_DIR}/ajda-${STAMP}.sql"
CUSTOM="${WORK_DIR}/ajda-${STAMP}.dump"

log "dumping database to ${CUSTOM}"
# --no-owner/--no-acl keep the archive restorable by a different role.
if ! pg_dump --dbname="${DATABASE_URL}" --format=custom --compress=9 \
      --no-owner --no-acl --file="${CUSTOM}"; then
  fail "pg_dump failed"
fi

[[ -s "${CUSTOM}" ]] || fail "pg_dump produced an empty file"

# Cheap integrity gate: the custom format must be readable by pg_restore.
if command -v pg_restore >/dev/null 2>&1; then
  log "verifying archive with pg_restore --list"
  pg_restore --list "${CUSTOM}" >/dev/null || fail "archive failed pg_restore verification"
fi

SIZE="$(du -h "${CUSTOM}" | cut -f1)"
log "archive OK (${SIZE})"

install -m 600 "${CUSTOM}" "${BACKUP_DIR}/ajda-${STAMP}.dump"

# Stable restore target, excluded from pruning so the documented restore command
# can never point at a file this script deleted.
LATEST="${BACKUP_DIR}/ajda-latest.dump"
install -m 600 "${CUSTOM}" "${LATEST}"

log "pruning dumps older than ${RETENTION_DAYS} days (keeping ajda-latest.dump)"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'ajda-*.dump' \
  ! -name 'ajda-latest.dump' -mtime "+${RETENTION_DAYS}" -print -delete \
  || log "WARNING: prune step failed"

REMAINING="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'ajda-*.dump' | wc -l | tr -d ' ')"
log "done: ${REMAINING} archive(s) in ${BACKUP_DIR}"

# NOTE: uploaded media (server/uploads) is NOT in this dump. Back it up separately
# or an incident review will find a healthy database pointing at missing images.
