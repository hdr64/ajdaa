# Production Deployment — Ajda (no Docker)

Target: Ubuntu 24.04 + Node 22 + PostgreSQL 16 + Caddy, TLS via Cloudflare Origin
Certificate. The API runs as a systemd service; the SPA is served as static files
by Caddy.

Layout on the VPS:

```
/opt/ajda/                     # git clone
├── src/, server/, deploy/     # the repo
├── dist/                      # built SPA, served by Caddy at /var/www/ajda
└── server/uploads/            # uploaded media (only writable path for the service)
/etc/caddy/Caddyfile           # from deploy/Caddyfile
/var/backups/ajda/             # pg_dump archives
```

> **Deploy ordering matters.** `prisma/schema.postgresql.prisma` is generated and
> gitignored, so `db:gen:prod` must run *before* `db:migrate`. See step 5.

---

## 1. System user and directories

```bash
sudo adduser --system --group --home /opt/ajda ajda
sudo mkdir -p /var/www/ajda /var/backups/ajda /var/log/caddy
sudo chown -R ajda:ajda /opt/ajda /var/backups/ajda
sudo chmod 700 /var/backups/ajda
```

## 2. Node.js 22 and PostgreSQL 16

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql-16 postgresql-client-16
sudo systemctl enable --now postgresql

# Database + role. Use a generated password, not a literal from this file.
sudo -u postgres psql <<'SQL'
CREATE ROLE ajda LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
CREATE DATABASE ajda OWNER ajda ENCODING 'UTF8';
SQL
```

## 3. Clone and install

```bash
sudo -u ajda git clone <your-repo-url> /opt/ajda
cd /opt/ajda
sudo -u ajda npm ci
sudo -u ajda npm --prefix server ci
```

## 4. Environment files

```bash
sudo -u ajda cp server/.env.example server/.env
sudo -u ajda openssl rand -base64 32      # use this for JWT_SECRET
sudo chmod 600 server/.env
sudo chown ajda:ajda server/.env
```

`server/.env` for production:

```dotenv
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://ajda:<password>@localhost:5432/ajda?schema=public"
JWT_SECRET="<output of openssl rand -base64 32>"
CLIENT_ORIGIN="https://ajda.weghetk.com"
UPLOAD_DIR="./uploads"
```

`CLIENT_ORIGIN` accepts a comma-separated list if you add origins later
(`https://ajda.weghetk.com,https://admin.example.com`). In production the
`localhost:5173` development origins are **not** added, so a page on a developer's
machine cannot make credentialed cross-origin calls to the live API.

Secrets for the backup unit go in a separate file so they are not readable by the
web-facing process:

```bash
sudo install -o root -g ajda -m 640 /dev/null server/.env.backup
sudo tee server/.env.backup >/dev/null <<EOF
DATABASE_URL="postgresql://ajda:<password>@localhost:5432/ajda?schema=public"
BACKUP_DIR=/var/backups/ajda
BACKUP_RETENTION_DAYS=14
EOF
```

## 5. Build and migrate

```bash
cd /opt/ajda
sudo -u ajda npm --prefix server run db:gen:prod   # generates the Postgres schema
sudo -u ajda npm run build                        # SPA -> dist/
sudo -u ajda npm --prefix server run build         # API -> server/dist/
sudo -u ajda npm --prefix server run db:migrate    # apply migrations
sudo install -o root -g ajda -d -m 755 dist/. /var/www/ajda/
```

Seed **only** on a brand-new empty database; it creates the first admin account:

```bash
sudo -u ajda npm --prefix server run db:seed
```

> Re-running the seed on a live database would overwrite real data. It is not part
> of routine deploys.

## 6. systemd

```bash
sudo cp deploy/ajda-api.service deploy/ajda-backup.service deploy/ajda-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ajda-api
sudo systemctl status ajda-api
curl -fsS http://localhost:4000/api/health     # {"status":"ok",...}
```

The unit sets `ProtectSystem=strict` with `ReadWritePaths` limited to
`/opt/ajda/server/uploads`, so a compromised process cannot write anywhere else.
If you relocate uploads, change `ReadWritePaths` to match.

Logs: `journalctl -u ajda-api -f`

## 7. TLS certificate (Cloudflare Origin)

1. Cloudflare → SSL/TLS → Origin Server → Create Certificate (RSA 2048, host `ajda.weghetk.com`).
2. On the VPS:

```bash
sudo mkdir -p /etc/caddy
sudo nano /etc/caddy/origin.pem      # paste the origin certificate
sudo nano /etc/caddy/origin.key      # paste the private key
sudo chmod 600 /etc/caddy/origin.key
```

3. Cloudflare SSL/TLS mode → **Full (strict)**.

## 8. Caddy

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile   # always validate first
sudo systemctl reload caddy
```

`/api/*`, `/uploads/*` and `/socket.io/*` proxy to `localhost:4000`; everything else
falls back to `index.html` for client-side routing. The websocket block sets
`flush_interval -1` so unit-status broadcasts are not buffered.

## 9. Nightly backups

```bash
sudo chmod 755 server/scripts/backup_db.sh
sudo cp deploy/ajda-backup.service deploy/ajda-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ajda-backup.timer

# Prove it works now, don't wait for 03:17:
sudo systemctl start ajda-backup.service
sudo -u ajda ls -l /var/backups/ajda
```

Each run writes `ajda-<UTC timestamp>.dump` (custom format, compressed, mode 600),
verifies it with `pg_restore --list`, refreshes `ajda-latest.dump`, and prunes
archives older than `BACKUP_RETENTION_DAYS`. Test a restore at least once:

```bash
sudo -u postgres createdb ajda_restore_test
sudo -u postgres pg_restore -d ajda_restore_test /var/backups/ajda/ajda-latest.dump
sudo -u postgres psql -d ajda_restore_test -c 'SELECT count(*) FROM "Project";'
sudo -u postgres dropdb ajda_restore_test
```

> **The database dump does not include uploaded media.** A restore will otherwise
> give you a healthy database pointing at missing images. Back up
> `/opt/ajda/server/uploads/` separately, or add it to this script.

## 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable     # PostgreSQL on 5432 stays closed; the API connects locally
```

---

## Routine deploy

```bash
cd /opt/ajda
sudo -u ajda git pull
sudo -u ajda npm ci && sudo -u ajda npm --prefix server ci
sudo -u ajda npm --prefix server run db:gen:prod
sudo -u ajda npm run build && sudo -u ajda npm --prefix server run build
sudo -u ajda npm --prefix server run db:migrate
sudo install -o root -g ajda -d -m 755 dist/. /var/www/ajda/
sudo systemctl restart ajda-api
curl -fsS http://localhost:4000/api/health
```

Wrap it in `deploy/deploy.sh` once you have run it by hand a few times.

## Post-deploy smoke

```bash
curl -fsS https://ajda.weghetk.com/api/health
curl -fsSI https://ajda.weghetk.com/            # 200, index.html not cached
curl -fsS  https://ajda.weghetk.com/api/projects | head -c 200
# Then in a browser: public projects render, /admin login works, a unit status
# change in one tab appears in another without a refresh.
```

## Rollback

```bash
sudo -u ajda git log --oneline -5
sudo -u ajda git checkout <sha>
# repeat the Routine deploy steps
```

Database migrations are not auto-reversible. Take a dump before migrating:

```bash
sudo systemctl start ajda-backup.service
```
