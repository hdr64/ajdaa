# Ajda Real Estate Platform — Deployment Guide

> **Last Updated**: 2026-10-01
> **Environment**: Production (Ubuntu VPS)

---

## Overview

Production deployment uses **no Docker**. All services run natively on the VPS:

| Component | Technology | Managed By |
|-----------|------------|------------|
| Web Server | Caddy 2 | systemd |
| API Server | Node.js Fastify | systemd |
| Database | PostgreSQL 16 | system package |
| Process Manager | systemd | — |

---

## Prerequisites

- Ubuntu 22.04 LTS or later
- Node.js 20+ installed
- PostgreSQL 16 installed
- Domain pointed to server IP
- Cloudflare account (for Origin CA certificates)

---

## Initial Server Setup

### 1. System User

```bash
# Create dedicated user
sudo useradd -r -s /bin/false ajda
sudo mkdir -p /opt/ajda
sudo chown ajda:ajda /opt/ajda
```

### 2. Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. PostgreSQL 16

```bash
sudo apt-get install postgresql-16

# Create database and user
sudo -u postgres psql
```

```sql
CREATE USER ajda WITH PASSWORD 'secure_password_here';
CREATE DATABASE ajda_prod OWNER ajda;
GRANT ALL PRIVILEGES ON DATABASE ajda_prod TO ajda;
\q
```

---

## Application Deployment

### 1. Clone and Build

```bash
cd /opt/ajda
git clone <repository-url> .
npm ci

# Generate production Prisma schema
npm run db:gen:prod

# Build server
cd server
npm ci
npm run build
```

### 2. Environment Configuration

Create `server/.env`:

```env
NODE_ENV=production
DATABASE_URL="postgresql://ajda:secure_password_here@localhost:5432/ajda_prod"
JWT_SECRET="generate-strong-random-secret-here"
CLIENT_ORIGIN="https://ajda.weghetk.com"

# Mail (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_FROM="Ajda Real Estate <noreply@ajda.weghetk.com>"

# Optional: Force OTP for all logins
# LOGIN_OTP_REQUIRED=true

# Optional: Custom notification emails
# NOTIFY_INQUIRY_EMAILS=admin@ajda.sa,sales@ajda.sa
```

### 3. Database Migration

```bash
cd /opt/ajda/server

# Apply migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

---

## systemd Configuration

### API Service (`/etc/systemd/system/ajda-api.service`)

```ini
[Unit]
Description=Ajda Real Estate API
After=network.target postgresql.service

[Service]
Type=simple
User=ajda
WorkingDirectory=/opt/ajda/server
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security hardening
ProtectSystem=strict
ReadWritePaths=/opt/ajda/server/uploads
PrivateTmp=true
NoNewPrivileges=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ajda-api

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ajda-api
sudo systemctl start ajda-api
sudo systemctl status ajda-api
```

### Backup Service (`/etc/systemd/system/ajda-backup.service`)

```ini
[Unit]
Description=Ajda Database Backup

[Service]
Type=oneshot
User=postgres
ExecStart=/opt/ajda/server/scripts/backup_db.sh
```

### Backup Timer (`/etc/systemd/system/ajda-backup.timer`)

```ini
[Unit]
Description=Ajda Nightly Backup
Requires=ajda-backup.service

[Timer]
OnCalendar=*-*-* 03:17:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl enable ajda-backup.timer
sudo systemctl start ajda-backup.timer
```

---

## Caddy Configuration

### `/etc/caddy/Caddyfile`

```
ajda.weghetk.com {
    # Cloudflare Origin CA certificate
    tls /etc/caddy/certs/ajda.crt /etc/caddy/certs/ajda.key

    # Security headers
    header {
        -Server
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }

    # API routes
    handle /api/* {
        reverse_proxy localhost:4000
    }

    # WebSocket
    handle /socket.io/* {
        reverse_proxy localhost:4000 {
            flush_interval -1
        }
    }

    # Uploaded media
    handle /uploads/* {
        root * /opt/ajda/server
        file_server
    }

    # SPA fallback
    handle {
        root * /opt/ajda/dist
        try_files {path} /index.html
        file_server
    }

    # Compress responses
    encode gzip zstd
}
```

Restart Caddy:

```bash
sudo systemctl reload caddy
```

---

## Backup Strategy

### Database Backup

The `backup_db.sh` script:
- Runs `pg_dump` in custom format
- Verifies with `pg_restore --list`
- Prunes backups older than 14 days
- Maintains `ajda-latest.dump` symlink

### Uploads Backup

**Current Gap**: `server/uploads/` is not backed up.

**Recommended**: Add to backup script or use `rsync`:

```bash
# Add to crontab
0 3 * * * rsync -a /opt/ajda/server/uploads/ /backup/uploads/
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:4000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-10-01T..."}
```

### Logs

```bash
# API logs
sudo journalctl -u ajda-api -f

# Backup logs
sudo journalctl -u ajda-backup -f

# Caddy logs
sudo journalctl -u caddy -f
```

---

## Routine Deployment

```bash
# 1. Pull latest code
cd /opt/ajda
git pull origin main

# 2. Install dependencies
npm ci
cd server && npm ci

# 3. Generate prod schema (if schema.prisma changed)
npm run db:gen:prod

# 4. Apply migrations
npm run db:migrate

# 5. Build
npm run build
cd .. && npm run build

# 6. Restart services
sudo systemctl restart ajda-api
sudo systemctl reload caddy
```

---

## Rollback

```bash
# 1. Checkout previous commit
git checkout <previous-commit-hash>

# 2. Rebuild
npm ci && npm run build
cd server && npm ci && npm run build

# 3. Restart
sudo systemctl restart ajda-api
```

Database rollback requires restoring from backup:

```bash
sudo -u postgres pg_restore -d ajda_prod --clean /backup/ajda-20260930.dump
```

---

## Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct API access (only via Caddy)
sudo ufw deny 4000/tcp

sudo ufw enable
```

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| API not responding | `sudo systemctl status ajda-api` |
| Database connection failed | `sudo -u postgres psql -c "SELECT 1"` |
| Caddy not serving | `sudo caddy validate` |
| WebSocket issues | Check `flush_interval -1` in Caddyfile |
| Upload failures | Verify `ReadWritePaths` in systemd unit |

---

*See [architecture.md](architecture.md) for system design.*
