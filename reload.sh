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
# read the database NAME and ensure SETTINGS_ENCRYPTION_KEY is configured, and
# never deletes uploads.
set -euo pipefail

DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd -P)"
case "$DIR" in
  /srv/ajda/test) TARGET=test; UNIT=ajda-api-test; PORT=4001; PUBLIC_URL=""; CADDY_FILE=Caddyfile.test.ajda ;;
  /srv/ajda/app)  TARGET=prod; UNIT=ajda-api;      PORT=4000; PUBLIC_URL="https://ajdaa.sa"; CADDY_FILE=Caddyfile.ajda ;;
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

ensure_settings_encryption_key() {
  local env_file="server/.env"
  local jwt_line jwt_val key_line key_val is_placeholder lower_key

  [ -f "$env_file" ] || { echo "$env_file is missing." >&2; exit 1; }

  jwt_line="$(grep -m1 -E '^[[:space:]]*JWT_SECRET[[:space:]]*=' "$env_file" 2>/dev/null || true)"
  jwt_val="${jwt_line#*=}"
  jwt_val="${jwt_val#"${jwt_val%%[![:space:]]*}"}"
  jwt_val="${jwt_val%"${jwt_val##*[![:space:]]}"}"
  if [[ "$jwt_val" == \"*\" || "$jwt_val" == \'*\' ]]; then
    jwt_val="${jwt_val:1:${#jwt_val}-2}"
  fi

  key_line="$(grep -m1 -E '^[[:space:]]*SETTINGS_ENCRYPTION_KEY[[:space:]]*=' "$env_file" 2>/dev/null || true)"
  key_val="${key_line#*=}"
  key_val="${key_val#"${key_val%%[![:space:]]*}"}"
  key_val="${key_val%"${key_val##*[![:space:]]}"}"
  if [[ "$key_val" == \"*\" || "$key_val" == \'*\' ]]; then
    key_val="${key_val:1:${#key_val}-2}"
  fi

  is_placeholder=0
  if [ -n "$key_val" ]; then
    case "$key_val" in
      *\<*|*\>*) is_placeholder=1 ;;
    esac
    lower_key="$(printf '%s' "$key_val" | tr '[:upper:]' '[:lower:]')"
    case "$lower_key" in
      changeme|change_me|change-me|secret|secrets|password|password123|placeholder|example|your-secret-key|your_secret_key|yoursecretkey|ajda_secret_development_key_super_secure_2026)
        is_placeholder=1
        ;;
      *changeme*|*change_me*|*change-me*|*super_secure_2026*)
        is_placeholder=1
        ;;
    esac
  fi

  if [ -n "$key_val" ] && [ "${#key_val}" -ge 24 ] && [ "$key_val" != "$jwt_val" ] && [ "$is_placeholder" -eq 0 ]; then
    echo "SETTINGS_ENCRYPTION_KEY: valid key present (${#key_val} chars)"
    return 0
  fi

  local reason="missing"
  if [ -z "$key_val" ]; then
    reason="missing"
  elif [ "${#key_val}" -lt 24 ]; then
    reason="too short (${#key_val} < 24)"
  elif [ "$is_placeholder" -eq 1 ]; then
    reason="placeholder value"
  elif [ "$key_val" = "$jwt_val" ]; then
    reason="identical to JWT_SECRET"
  fi

  echo "SETTINGS_ENCRYPTION_KEY is $reason in $env_file. Generating a dedicated encryption key..."

  local new_key=""
  if command -v openssl >/dev/null 2>&1; then
    new_key="$(openssl rand -base64 32)"
  elif command -v node >/dev/null 2>&1; then
    new_key="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
  else
    new_key="$(head -c 32 /dev/urandom | base64 | tr -d '\r\n')"
  fi

  [ -n "$new_key" ] || { echo "Failed to generate SETTINGS_ENCRYPTION_KEY." >&2; exit 1; }
  [ "${#new_key}" -ge 24 ] || { echo "Generated key is unexpectedly short." >&2; exit 1; }
  [ "$new_key" != "$jwt_val" ] || { echo "Generated key matches JWT_SECRET." >&2; exit 1; }

  local tmp_file="${env_file}.tmp.$$"
  if ! awk -v key="$new_key" '
  BEGIN { replaced = 0 }
  /^[[:space:]]*SETTINGS_ENCRYPTION_KEY[[:space:]]*=/ {
    print "SETTINGS_ENCRYPTION_KEY=\"" key "\""
    replaced = 1
    next
  }
  { print }
  END {
    if (!replaced) {
      print "SETTINGS_ENCRYPTION_KEY=\"" key "\""
    }
  }' "$env_file" > "$tmp_file"; then
    rm -f "$tmp_file"
    echo "Failed to write $tmp_file." >&2
    exit 1
  fi

  mv "$tmp_file" "$env_file"
  chmod 600 "$env_file" 2>/dev/null || true

  echo "SETTINGS_ENCRYPTION_KEY: generated and configured in $env_file (${#new_key} chars)"
  echo "  Note: Pick it once and never change it. Any SMTP password previously saved with"
  echo "  the old derived key must be re-entered in Admin -> Settings."
}

# --- 0. guards -------------------------------------------------------------
step "Instance: $TARGET ($DIR), commit $(git rev-parse --short HEAD)"
if git -c core.fileMode=false status --short --untracked-files=no | grep -q .; then
  echo "Tracked files are modified (permission-only changes are ignored); clean the checkout first:" >&2
  git -c core.fileMode=false status --short --untracked-files=no >&2
  exit 1
fi

DB_NAME="$(sed -n 's/^DATABASE_URL=.*\/\([A-Za-z0-9_]*\)\(?.*\)\{0,1\}"\{0,1\}$/\1/p' server/.env | head -1)"
[ -n "$DB_NAME" ] || { echo "Could not read the database name from server/.env." >&2; exit 1; }
if [ "$TARGET" = test ]; then
  case "$DB_NAME" in *_test) ;; *) echo "Refusing: test instance points at database '$DB_NAME'." >&2; exit 1 ;; esac
else
  case "$DB_NAME" in *_test) echo "Refusing: prod instance points at test database '$DB_NAME'." >&2; exit 1 ;; esac
fi
echo "Database: $DB_NAME"
ensure_settings_encryption_key

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
VITE_APP_ENV="$([ "$TARGET" = test ] && echo test)" ./node_modules/.bin/vite build --outDir dist.new --emptyOutDir
[ -d dist ] && mv dist dist.old
mv dist.new dist
rm -rf dist.old

# private storage for CVs (careers); idempotent
mkdir -p server/uploads server/private && chmod 700 server/private
# systemd (ReadWritePaths) fails with status 226/NAMESPACE if these files are missing
touch server/prod.log server/errors.log

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

step "Reload Caddy"
sudo systemctl reload caddy

# --- 6. things that are NOT automated ---------------------------------------
step "Reminders"
if ! diff -q "deploy/$CADDY_FILE" "/etc/caddy/$CADDY_FILE" >/dev/null 2>&1; then
  echo "deploy/$CADDY_FILE differs from /etc/caddy/$CADDY_FILE. Read the diff first:"
  echo "  diff -u /etc/caddy/$CADDY_FILE deploy/$CADDY_FILE"
  echo "If intended (the main /etc/caddy/Caddyfile is never touched):"
  echo "  sudo cp deploy/$CADDY_FILE /etc/caddy/$CADDY_FILE && sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy"
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
