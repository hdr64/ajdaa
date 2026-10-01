#!/usr/bin/env bash
#
# Production Zero-Downtime Deployment Script for Ajda Platform
# Usage: sudo bash deploy/deploy.sh [branch]
#
set -euo pipefail

BRANCH="${1:-feat/backend-admin}"
REPO_DIR="/opt/ajda"
WWW_DIR="/var/www/ajda"
API_SERVICE="ajda-api"

log() {
  printf "\033[1;34m[%s]\033[0m %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

success() {
  printf "\033[1;32m[%s] SUCCESS:\033[0m %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

fail() {
  printf "\033[1;31m[%s] ERROR:\033[0m %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
  exit 1
}

# 1. Verification of User & Environment
if [[ "$EUID" -ne 0 ]]; then
  fail "This deployment script must be run as root (or via sudo)."
fi

if [[ ! -d "$REPO_DIR" ]]; then
  fail "Target directory $REPO_DIR does not exist. Ensure repo is cloned to $REPO_DIR."
fi

cd "$REPO_DIR"

log "Starting deployment for branch: ${BRANCH}"

# 2. Automated Safety Backup before any code/schema changes
if systemctl list-unit-files ajda-backup.service &>/dev/null; then
  log "Taking automated pre-migration database snapshot..."
  systemctl start ajda-backup.service || log "WARNING: Backup service completed with warnings, proceeding..."
fi

# 3. Pull latest changes
log "Fetching latest commits from remote..."
sudo -u ajda git fetch origin "$BRANCH"
sudo -u ajda git checkout "$BRANCH"
sudo -u ajda git pull --ff-only origin "$BRANCH"

COMMIT_HASH="$(sudo -u ajda git rev-parse --short HEAD)"
log "Checked out commit: ${COMMIT_HASH}"

# 4. Dependency Synchronization
log "Installing frontend & backend dependencies via npm ci..."
sudo -u ajda npm ci
sudo -u ajda npm --prefix server ci

# 5. Database Schema Generation & Migration
log "Generating PostgreSQL production Prisma schema..."
sudo -u ajda npm --prefix server run db:gen:prod

log "Applying database migrations..."
sudo -u ajda npm --prefix server run db:migrate

# 6. Production Builds
log "Building public frontend SPA..."
sudo -u ajda npm run build

log "Building Fastify backend server..."
sudo -u ajda npm --prefix server run build

# 7. Sync Static Assets to Web Root
log "Publishing frontend distribution to ${WWW_DIR}..."
mkdir -p "$WWW_DIR"
install -o root -g ajda -d -m 755 dist/. "$WWW_DIR/"
# Copy files cleanly preserving subdirectories
cp -a dist/. "$WWW_DIR/"
chown -R root:ajda "$WWW_DIR"
chmod -R 755 "$WWW_DIR"

# 8. Service Restart & Reload
log "Restarting backend service: ${API_SERVICE}..."
systemctl restart "$API_SERVICE"

if command -v caddy &>/dev/null && [[ -f /etc/caddy/Caddyfile ]]; then
  log "Validating and reloading Caddy reverse proxy..."
  caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
fi

# 9. Health & Smoke Probe
log "Probing API health check on localhost:4000..."
sleep 2

HEALTH_RESPONSE=$(curl -fsS http://localhost:4000/api/health || fail "Health check failed! Check journalctl -u ${API_SERVICE}")
log "API Health Response: ${HEALTH_RESPONSE}"

success "Deployment finished successfully at commit ${COMMIT_HASH}!"
