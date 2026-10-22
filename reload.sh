#!/usr/bin/env bash
# Run ON THE SERVER, by hand, after the new commit is checked out.
#
#   ./reload.sh
#
# The instance is decided by where this file lives, never by an argument:
#   /srv/ajda/test/reload.sh -> test (unit ajda-api-test, port 4001, DB ajda_test)
#   /srv/ajda/app/reload.sh  -> prod (unit ajda-api,      port 4000, DB ajda)
# Anywhere else it refuses to run, so the test copy can never reload prod and
# the prod copy can never reload test.
#
# Does what deploy/README-deploy.md §6.1 describes, in order:
#   backup (prod) -> install -> prisma schema -> read pending migrations ->
#   migrate -> build API + SPA -> swap dist -> restart -> health check -> smoke test.
# It never runs git fetch/checkout (do that first), never touches .env except to
# read the database NAME, and never deletes uploads.
set -euo pipefail

DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd -P)"
case "$DIR" in
  /srv/ajda/test) TARGET=test; UNIT=ajda-api-test; PORT=4001; PUBLIC_URL="" ;;
  /srv/ajda/app)  TARGET=prod; UNIT=ajda-api;      PORT=4000; PUBLIC_URL="https://ajdaa.sa" ;;
  *) echo "reload.sh must live in /srv/ajda/test or /srv/ajda/app (found in $DIR)." >&2; exit 2 ;;
esac
[ $# -eq 0 ] || { echo "reload.sh takes no arguments; the instance is the folder it is in ($TARGET)." >&2; exit 2; }

[ "$(id -u)" -ne 0 ] || { echo "Run as the deploy user (salah), not root." >&2; exit 1; }
cd "$DIR"

# node from nvm, same binary the systemd units use
export PATH="/home/salah/.nvm/versions/node/v24.21.0/bin:$PATH"

step() { printf '\n==> %s\n' "$*"; }
confirm() { # confirm "<question>" "<word to type>"
  local answer
  read -r -p "$1 Type '$2' to continue: " answer
  [ "$answer" = "$2" ] || { echo "Aborted."; exit 1; }
}

# --- 0. guards -------------------------------------------------------------
step "Instance: $TARGET ($DIR), commit $(git rev-parse --short HEAD)"
git status --short --untracked-files=no | grep -q . && { echo "Tracked files are modified; clean the checkout first." >&2; exit 1; }

DB_NAME="$(sed -n 's/^DATABASE_URL=.*\/\([A-Za-z0-9_]*\)\(?.*\)\{0,1\}"\{0,1\}$/\1/p' server/.env | head -1)"
[ -n "$DB_NAME" ] || { echo "Could not read the database name from server/.env." >&2; exit 1; }
if [ "$TARGET" = test ]; then
  case "$DB_NAME" in *_test) ;; *) echo "Refusing: test instance points at database '$DB_NAME'." >&2; exit 1 ;; esac
else
  case "$DB_NAME" in *_test) echo "Refusing: prod instance points at test database '$DB_NAME'." >&2; exit 1 ;; esac
fi
echo "Database: $DB_NAME"

# --- 1. backup (prod only; read-only on the database) ----------------------
if [ "$TARGET" = prod ]; then
  step "Backup of production"
  confirm "Take a fresh backup now (pg_dump is read-only)?" backup
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  DUMP="/var/backups/ajda/ajda-manual-$STAMP.dump"
  sudo -u postgres pg_dump -Fc -d "$DB_NAME" --file="$DUMP"
  sudo -u postgres pg_restore --list "$DUMP" | head -5
  SIZE="$(stat -c %s "$DUMP")"
  [ "$SIZE" -gt 10240 ] || { echo "Dump is suspiciously small ($SIZE bytes)." >&2; exit 1; }
  echo "Dump OK: $DUMP ($SIZE bytes)"
  rsync -a server/uploads/ /var/backups/ajda/uploads/
  [ -d server/private ] && rsync -a server/private/ /var/backups/ajda/private/
fi

# --- 2. install + prisma schema (no database access) -----------------------
step "Install dependencies"
npm ci
npm --prefix server ci
step "Generate the PostgreSQL Prisma schema"
npm --prefix server run db:gen:prod

# --- 3. pending migrations: show them, refuse destructive ones -------------
step "Pending migrations"
STATUS="$(cd server && npx prisma migrate status --schema prisma/schema.postgresql.prisma 2>&1 || true)"
echo "$STATUS"
PENDING="$(echo "$STATUS" | awk '/have not yet been applied/{f=1;next} f&&/^[0-9]{14}_/{print $1} f&&/^$/{if(n++)f=0}')"
if [ -n "$PENDING" ]; then
  for m in $PENDING; do
    file="server/prisma/migrations/$m/migration.sql"
    echo "--- $m"
    if grep -nEi 'drop|truncate|delete' "$file"; then
      echo "Pending migration $m contains DROP/TRUNCATE/DELETE. Read it, then migrate by hand if it is intended." >&2
      exit 1
    fi
  done
  [ "$TARGET" = prod ] && confirm "Apply the migrations above to '$DB_NAME'?" migrate
  step "Migrate"
  npm --prefix server run db:migrate
else
  echo "None."
fi

# --- 4. build ---------------------------------------------------------------
step "Build API"
npm --prefix server run build
step "Build SPA into dist.new, then swap"
rm -rf dist.new
./node_modules/.bin/tsc -b
./node_modules/.bin/vite build --outDir dist.new --emptyOutDir
[ -d dist ] && mv dist dist.old
mv dist.new dist
rm -rf dist.old

# private storage for CVs (careers); idempotent
mkdir -p server/private && chmod 700 server/private

# --- 5. restart + health ----------------------------------------------------
step "Restart $UNIT"
sudo systemctl restart "$UNIT"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  echo "Health check failed after 30 s. Logs: journalctl -u $UNIT -n 100 --no-pager" >&2
  echo "Rollback: git checkout --detach <previous sha> (see: git reflog -5), then run this script again." >&2
  exit 1
fi
curl -fsS "http://127.0.0.1:$PORT/api/health"; echo

# --- 6. things that are NOT automated ---------------------------------------
step "Reminders"
if ! diff -q deploy/Caddyfile /etc/caddy/Caddyfile >/dev/null 2>&1; then
  echo "deploy/Caddyfile differs from /etc/caddy/Caddyfile. If the change is intended:"
  echo "  sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy"
fi
if ! diff -q "deploy/$UNIT.service" "/etc/systemd/system/$UNIT.service" >/dev/null 2>&1; then
  echo "deploy/$UNIT.service differs from the installed unit. If intended:"
  echo "  sudo cp deploy/$UNIT.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart $UNIT"
fi

# --- 7. smoke test ----------------------------------------------------------
step "Smoke test"
curl -fsS "http://127.0.0.1:$PORT/api/projects" | head -c 200; echo
if [ -n "$PUBLIC_URL" ]; then
  curl -fsS "$PUBLIC_URL/api/health"; echo
  curl -fsSI "$PUBLIC_URL/" | head -1
fi
echo; echo "Done: $TARGET is running commit $(git rev-parse --short HEAD)."
