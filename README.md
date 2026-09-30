# 🏗️ Ajda Real Estate Platform

> **Version: 1.2.1** | React 19 SPA + Fastify 5 API + Prisma + PostgreSQL 16 / SQLite

Full-stack real estate management and marketing system: a modern React 19 + Vite SPA (AR/EN) with a high-performance Fastify + Prisma API, complete Content Management System (CMS v2.1), action-level RBAC, telemetry logging, and isolated developer feedback channels.

---

## 📑 Table of Contents

- [Repository Layout](#-repository-layout)
- [Documentation Suite](#-documentation-suite)
- [Key Features](#-key-features)
- [Database Strategy (SQLite / PostgreSQL)](#-database-strategy--sqlite-dev--postgresql-prod)
  - [PostgreSQL Database & User Setup](#creating-postgresql-database--user)
- [Data Source of Truth](#-data-source-of-truth)
- [Quick Start](#-quick-start)
  - [Full-Stack Development (Recommended)](#full-stack-development-recommended)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Seed Data & Media Assets](#seed-data--media-assets)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [API Overview](#-api-overview)
- [Production Logs & Telemetry](#-production-logs--telemetry)
- [Developer Notes Isolation](#-developer-notes-isolation)
- [Production Deployment](#-production-deployment)
- [Quality Gates & Standards](#-quality-gates--standards)

---

## 📂 Repository Layout

```
ajda/
├── docs/                   # Complete documentation suite (Architecture, CMS, Deployment, etc.)
│   ├── archive/            # Historical archives (including original-refactor.md)
│   ├── architecture.md     # System architecture, schemas, caching, ETags
│   ├── cms-architecture.md # Complete CMS v2.1 specification & design
│   ├── api-reference.md    # REST & WebSocket API specification
│   ├── deployment.md       # Ubuntu 24.04 bare-metal deployment (No Docker)
│   ├── testing-strategy.md # Vitest test suites & QA guidelines
│   ├── TODO.md             # Active sprint items & backlog
│   ├── CHANGELOG.md        # Detailed version history
│   └── gap-analysis.md     # Feature gap audit & roadmap
├── src/                    # Frontend — React 19 + Vite + Tailwind v4
│   ├── components/admin/   # Admin dashboard suites, CMS panels (cms/*), feedback pet
│   ├── context/            # CmsContext & public real-time providers
│   ├── data/properties.ts  # Display helpers only (getPropertyDisplay)
│   ├── services/           # api.ts client + property/inquiry/auth/cms/media services
│   ├── hooks/              # useAsyncData, useRealtimeUnits, useCmsSection, useCmsContact
│   └── pages/              # public site + /admin/*
├── server/                 # Backend — Fastify + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # Canonical schema (SQLite provider = DEV)
│   │   ├── migrations/     # PRODUCTION Postgres migrations (committed)
│   │   ├── seed.ts         # Seeds admin users, categories, projects, CMS
│   │   └── seed-data/      # projects.seed.ts (AUTO-GENERATED, dev bootstrap only)
│   ├── src/
│   │   ├── config/         # env.ts (zod-validated), constants.ts
│   │   ├── middleware/     # auth (JWT), validate (zod)
│   │   ├── routes/         # auth, projects, units, inquiries, cms, logs, developerNotes, media
│   │   ├── services/       # prisma, cmsCacheService, loggerService, mailService, mediaService
│   │   ├── sockets/        # Socket.io realtime engine
│   │   ├── app.ts          # buildApp() factory (testable, no listen)
│   │   └── server.ts       # Entry point → listen
│   ├── prod.log            # Local production log file (gitignored)
│   └── uploads/            # Local media storage (gitignored)
├── deploy/                 # Production deployment scripts & systemd units
│   ├── ajda-api.service    # Systemd service unit for Fastify API
│   ├── backup.sh           # Automated PostgreSQL & uploads backup script
│   └── README-deploy.md    # Production deployment playbook
```

---

## 📖 Documentation Suite

For detailed technical specifications, operational procedures, and design docs, refer to the [`docs/`](docs/README.md) suite:

- 🏛️ [System Architecture](docs/architecture.md) — Comprehensive technical architecture, caching, security, and schema topology.
- 📝 [CMS Architecture v2.1 Specification](docs/cms-architecture.md) — Dynamic CMS schema, section specifications, version rollback, and caching.
- 🔌 [API & WebSocket Reference](docs/api-reference.md) — Complete endpoint reference, payload schemas, query parameters, and Socket.io events.
- 🚀 [Production Deployment (No Docker)](docs/deployment.md) — Ubuntu 24.04 LTS native setup with PostgreSQL 16, Caddy 2, and systemd.
- 🧪 [Testing Strategy & QA Suites](docs/testing-strategy.md) — Vitest suites, security regression tests, and verification checklist.
- 📋 [Sprint Backlog & TODO](docs/TODO.md) — Active roadmap, upcoming milestones, and completed features.
- 📜 [Changelog & Release Notes](docs/CHANGELOG.md) — Granular release tracking from v1.0.0 through v1.2.0+.
- 🔍 [Feature Gap Analysis](docs/gap-analysis.md) — Deep audit comparing target architecture with current implementation.
- 📦 [Historical Archives](docs/archive/) — Unmodified preservation of historical planning documents (including `original-refactor.md`).

---

## ✨ Key Features

- **🏢 Property Portfolio & Unit Inventory**: Hierarchical project management (Projects → Floors → Units) with real-time status transitions (`available`, `reserved`, `sold`), amenity tagging, and dynamic pricing.
- **🎨 Dynamic CMS v2.1 Engine**: Granular control over Navbar, Footer, Hero, Services, Stats, Features, Projects, Clients, and Contact sections with 10-revision history rollback and instant cache eviction.
- **⚡ Real-Time WebSocket Synchronization**: Instant unit availability sync across all connected clients (`units:changed`, `units:status_updated`) and push invalidation for CMS updates (`cms:updated`).
- **🛡️ Action-Level Role-Based Access Control (RBAC)**: Fine-grained permissions (e.g. `manageProjects`, `viewInquiries`, `manage_cms_content`), customizable roles, departments, and user assignment.
- **📊 Live Production Telemetry & Log Viewer**: Real-time dark-mode HTML console (`/api/logs/view`) with 3s live polling, level filters, debounced text search, system stats bar, and raw tail stream.
- **🐞 Isolated Developer Feedback System**: Dedicated `DeveloperNote` database table strictly isolated from customer CRM inquiries, immediate HTML email alerts to developer inbox, and programmatic export API.
- **🔒 Enterprise Security Hardening**: Constant-time token comparison, SHA-256 digested OTP logins, magic byte file-type verification, Sharp image sanitization, account lockouts, and rate limiting.
- **📬 Inquiries & CRM Automation**: Positional index-tracked contact form submissions, CSV export (UTF-8 BOM RFC 4180), automated email dispatch, and newsletter subscriber tracking.

---

## 🗄️ Database Strategy — SQLite (dev) / PostgreSQL (prod)

One canonical schema, two generated schemas — no Docker required.

| Dimension | Dev Local | Production |
|---|---|---|
| **Prisma Schema** | `prisma/schema.prisma` (provider = `sqlite`) | `prisma/schema.postgresql.prisma` (provider = `postgresql`) |
| **Sync Mechanism** | `npm run db:push` | Committed migrations via `npm run db:migrate` |
| **Storage Engine** | `server/prisma/dev.db` | PostgreSQL 16 (Native Linux Service) |
| **Client Generation**| `npx prisma generate` | `npm run db:gen:prod` |

> [!NOTE]
> Prisma does not permit setting `provider` dynamically via environment variables (error `P1012`). The production PostgreSQL schema is deterministically generated from the canonical SQLite schema via `npm run db:gen:prod`.

### Creating PostgreSQL Database & User

To set up a fresh PostgreSQL 16 database and dedicated service user on Ubuntu/Debian:

1. **Open PostgreSQL as the `postgres` superuser**:
   ```bash
   sudo -u postgres psql
   ```

2. **Execute role and database provisioning**:
   ```sql
   -- 1. Create role with login credentials:
   CREATE ROLE ajda WITH LOGIN PASSWORD 'YOUR_STRONG_PASSWORD';

   -- 2. Create database owned by this user:
   CREATE DATABASE ajda OWNER ajda ENCODING 'UTF8';

   -- 3. Grant privileges on the database:
   GRANT ALL PRIVILEGES ON DATABASE ajda TO ajda;

   -- 4. Switch to the ajda database and ensure public schema ownership (PostgreSQL 15+):
   \c ajda
   GRANT ALL ON SCHEMA public TO ajda;
   ALTER SCHEMA public OWNER TO ajda;

   -- Exit psql
   \q
   ```

   *Or run as a single one-liner in bash:*
   ```bash
   sudo -u postgres psql <<'SQL'
   CREATE ROLE ajda WITH LOGIN PASSWORD 'YOUR_STRONG_PASSWORD';
   CREATE DATABASE ajda OWNER ajda ENCODING 'UTF8';
   GRANT ALL PRIVILEGES ON DATABASE ajda TO ajda;
   \c ajda
   GRANT ALL ON SCHEMA public TO ajda;
   ALTER SCHEMA public OWNER TO ajda;
   SQL
   ```

3. **Configure `DATABASE_URL` in `server/.env`**:
   ```dotenv
   DATABASE_URL="postgresql://ajda:YOUR_STRONG_PASSWORD@localhost:5432/ajda?schema=public"
   ```

4. **Deploy migrations & seed database**:
   ```bash
   cd server
   npm run db:gen:prod   # Generates schema.postgresql.prisma and compiles Prisma Client
   npm run db:migrate    # Applies committed migrations (prisma migrate deploy)
   npm run db:seed       # Seeds super admin, categories, and initial catalogue
   ```

---

## 🎯 Data Source of Truth

The **database is the absolute source of truth** for all platform data. `src/data/properties.ts` survives solely as a presentation display helper (`getPropertyDisplay`) — it is never used as a data storage layer.

| Platform Concern | Source of Truth / Owner | Primary Access |
|---|---|---|
| **Projects / Floors / Units** | PostgreSQL / SQLite via Prisma | `GET /api/projects`, `POST/PUT /api/projects/:id` |
| **CMS Site Content** | Prisma (`CmsSection`, `CmsClient`, `CmsSectionVersion`) | `GET /api/cms`, `PUT /api/cms/:sectionKey` |
| **Developer Notes & Feedback**| Prisma (`DeveloperNote`) — strictly isolated | `POST /api/developer/notes`, `GET /api/developer/notes` |
| **Customer Inquiries (CRM)** | Prisma (`CustomerInquiry`) | `POST /api/inquiries`, `GET /api/inquiries` |
| **Categories & Metadata** | Prisma (`CategoryItem`) | `GET /api/categories`, `POST/PUT /api/categories` |
| **Authentication & RBAC** | Prisma (`AdminUser`, `Role`, `Department`) | `POST /api/auth/login`, `GET /api/roles` |
| **Auth Session State** | Browser `localStorage` (sent as `Authorization: Bearer <jwt>`) | Managed via `authService.ts` |
| **UI Loading / Cache States** | React Hooks (`useAsyncData`, `useCmsSection`) | Component-level reactive state |
| **Live Synchronization** | Socket.io (`useRealtimeUnits`, `CmsProvider`) | WebSockets (`units:*`, `cms:updated`) |

---

## 🚀 Quick Start

### Full-Stack Development (Recommended)

Run both the Fastify backend and the Vite frontend concurrently with a single command from the project root:

```bash
npm install
npm run dev:all
```

- **Frontend SPA**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000` (proxied automatically via Vite)
- **Live Logs Monitor**: `http://localhost:4000/api/logs/view?key=ajda-logs-secret-2026`

---

### Backend Setup

```bash
cd server
npm install
cp .env.example .env           # Adjust credentials as needed
npm run db:push                # Sync SQLite schema to dev.db
npm run db:seed                # Seed super admin, categories, and demo projects
npm run dev                    # Starts Fastify on :4000 with tsx watch
```

- **Default Super Admin**: `admin@ajdaa.sa` / `password` (configurable via `SEED_ADMIN_PASSWORD`).
- **Health & Telemetry Check**: `curl http://localhost:4000/api/health`

---

### Frontend Setup

```bash
npm install
npm run dev      # Vite dev server on :5173 (proxies /api, /uploads, /socket.io to :4000)
npm run build    # Production build → dist/ (static bundle served by Caddy)
npm run lint     # Oxlint static analysis
```

---

### Seed Data & Media Assets

- `server/prisma/seed-data/projects.seed.ts` is **auto-generated** by `npm run db:sync-data` as a dev bootstrap dataset (7 projects / 12 floors / 30 units). It is never modified manually.
- When `npm run db:seed` executes, it copies source images from `src/assets/ajda/...` into `server/uploads/seed/...` and stores the permanent URL in the database.
- **Idempotent by default**: The seed will skip project seeding if the `Project` table already has entries, preserving all admin dashboard edits.
- To force a full wipe and reseed:
  ```bash
  SEED_RESET_PROJECTS=1 npm run db:seed
  ```

---

## ⚙️ Configuration & Environment Variables

Copy `server/.env.example` to `server/.env`. All variables are validated at startup with Zod.

### Core Server & Database

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | `4000` | Port for the Fastify server |
| `DATABASE_URL` | `file:./dev.db` | SQLite URL in dev; PostgreSQL connection string in production |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated list of allowed CORS browser origins |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded media and seed assets |
| `TRUST_PROXY` | `true` | Enables proxy header resolution (`X-Forwarded-For`) behind Caddy |

### Security & Authentication

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(required)* | Secret key for signing admin JWTs (min 16 chars; use `openssl rand -base64 32`) |
| `SETTINGS_ENCRYPTION_KEY` | Derived from JWT | Encryption key for securing sensitive admin settings |
| `LOGIN_OTP_REQUIRED` | `false` | When `true`, forces email 2FA OTP for all admin accounts |
| `LOGIN_OTP_TTL_MS` | `600000` (10m) | Expiration window for 2FA one-time verification codes |
| `LOGIN_OTP_MAX_ATTEMPTS` | `5` | Maximum incorrect verification attempts before invalidation |
| `LOGIN_OTP_RESEND_COOLDOWN_MS` | `60000` (1m) | Cooldown period between resending OTP challenge codes |

### SMTP & Email Notifications

| Variable | Default | Description |
|---|---|---|
| `MAIL_HOST` | `""` (disabled) | SMTP host. If empty, mail sending is a safe logged no-op |
| `MAIL_PORT` | `587` | SMTP port (`587` for STARTTLS, `465` for SSL) |
| `MAIL_USERNAME` | `""` | SMTP username / address |
| `MAIL_PASSWORD` | `""` | SMTP password (or Google App Password) |
| `MAIL_ENCRYPTION` | `tls` | Encryption protocol (`tls`, `ssl`, or `none`) |
| `MAIL_FROM_ADDRESS` | `""` | Sender address shown in outgoing emails |
| `MAIL_FROM_NAME` | `Ajda` | Brand display name in email header |
| `APP_URL` | `https://ajda.weghetk.com` | Base URL used to construct links inside emails |
| `NOTIFY_INQUIRY_EMAILS` | `""` | Comma-separated allowlist for CRM inquiry alerts (empty = all admins with `viewInquiries`) |

### Production Logs & Monitoring

| Variable | Default | Description |
|---|---|---|
| `LOG_FILE_PATH` | `./prod.log` | Path to persistent production log file |
| `LOGS_SECRET_KEY` | `ajda-logs-secret-2026` | Secret key for log API and live terminal viewer access |
| `LOGS_PUBLIC` | `false` | When `true`, allows unrestricted access to logs without credentials |

### Developer Notes & Feedback

| Variable | Default | Description |
|---|---|---|
| `DEVELOPER_EMAIL` | `cloud.data.sa@gmail.com` | Target email for instant technical bug / feedback notifications |
| `DEVELOPER_NOTES_SECRET` | `ajda-dev-notes-2026` | Secret key for programmatic developer API and export endpoints |

---

## 🔌 API Overview

### Authentication & Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login → `{ token, user }` or 2FA OTP challenge |
| `POST` | `/api/auth/login/verify-otp` | Public | Verify 2FA emailed OTP code → `{ token, user }` |
| `POST` | `/api/auth/login/resend-otp` | Public | Resend 2FA login code (subject to rate limit cooldown) |
| `POST` | `/api/auth/password/forgot` | Public | Initiate password reset email |
| `POST` | `/api/auth/password/reset` | Public | Complete password reset with verification code |
| `GET` | `/api/auth/me` | JWT | Get current authenticated user profile and permissions |
| `PATCH`| `/api/auth/me` | JWT | Update current user profile (name, email, phone) |
| `POST` | `/api/auth/me/password` | JWT | Change password (verifies current password) |
| `PATCH`| `/api/auth/me/login-otp` | JWT | Enable/disable personal login 2FA OTP |
| `GET` | `/api/auth/users` | JWT | List admin users (`manageUsers`) |
| `POST` | `/api/auth/users` | JWT | Create new admin user (`manageUsers`) |
| `PUT` | `/api/auth/users/:id` | JWT | Update admin user (`manageUsers`) |
| `DELETE`| `/api/auth/users/:id` | JWT | Deactivate admin user (protects last `super_admin`) |

### Role-Based Access Control (RBAC)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/permissions` | JWT | List system permission catalogue |
| `GET` | `/api/roles` | JWT | List custom roles with assigned user counts |
| `POST` | `/api/roles` | JWT | Create new role with permission set (`manageUsers`) |
| `PUT` | `/api/roles/:id` | JWT | Update role permissions and cascade to users (`manageUsers`) |
| `DELETE`| `/api/roles/:id` | JWT | Delete unused role (`manageUsers`) |
| `GET` | `/api/departments` | JWT | List departments with member counts |
| `POST` | `/api/departments` | JWT | Create department (`manageUsers`) |
| `PUT` | `/api/departments/:id` | JWT | Update department (`manageUsers`) |
| `DELETE`| `/api/departments/:id` | JWT | Delete unused department (`manageUsers`) |

### Properties, Floors & Units

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects` | Public | List published projects (filters: `city`, `type`, `priceType`); admin via `?scope=admin` |
| `GET` | `/api/projects/:id` | Public | Get project details, floors, and units; admin via `?scope=admin` |
| `POST` | `/api/projects` | JWT | Create project (defaults to draft) (`manageProjects`) |
| `PUT` | `/api/projects/:id` | JWT | Update project details (`manageProjects`) |
| `DELETE`| `/api/projects/:id` | JWT | Delete project (`manageProjects`) |
| `PATCH`| `/api/projects/:id/publish` | JWT | Toggle publish status (`manageProjects`) |
| `POST` | `/api/projects/:id/floors` | JWT | Add floor to project (`manageProjects`) |
| `PUT` | `/api/projects/:id/floors/:floorId` | JWT | Update floor details (`manageProjects`) |
| `DELETE`| `/api/projects/:id/floors/:floorId` | JWT | Delete floor and cascade its units (`manageProjects`) |
| `POST` | `/api/units` | JWT | Create unit on floor (`manageProjects`) |
| `PUT` | `/api/units/:id` | JWT | Update unit details (`manageProjects`) |
| `DELETE`| `/api/units/:id` | JWT | Delete unit (`manageProjects`) |
| `PATCH`| `/api/units/:id/status` | JWT | Update unit status (`available`/`reserved`/`sold`) + Socket broadcast |

### Content Management System (CMS v2.1)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/cms` | Public | Aggregated CMS bundle for all sections (ETag-backed) |
| `GET` | `/api/cms/:sectionKey` | Public | Specific section data (supports HTTP 304 `If-None-Match`) |
| `PUT` | `/api/cms/:sectionKey` | JWT | Update section content (auto-creates revision snapshot) (`manage_cms_content`) |
| `GET` | `/api/cms/:sectionKey/versions` | JWT | View up to 10 historical snapshots (`manage_cms_content`) |
| `POST` | `/api/cms/:sectionKey/rollback/:version` | JWT | Roll back section to previous version snapshot (`manage_cms_content`) |
| `GET` | `/api/cms/clients` | Public | List published partner/client logos sorted by order |
| `POST` | `/api/cms/clients` | JWT | Add client logo (`manage_cms_clients`) |
| `PUT` | `/api/cms/clients/:id` | JWT | Update client logo / URL / visibility (`manage_cms_clients`) |
| `DELETE`| `/api/cms/clients/:id` | JWT | Remove client logo (`manage_cms_clients`) |
| `POST` | `/api/cms/clients/reorder` | JWT | Bulk update client logo ordering (`manage_cms_clients`) |
| `POST` | `/api/cms/cache/clear` | JWT | Flush in-memory CMS cache & broadcast reload signal (`manage_cms`) |

### Inquiries & CRM

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/inquiries` | Public | Submit customer inquiry (triggers email + WebSocket notification) |
| `GET` | `/api/inquiries` | JWT | List CRM customer inquiries (`viewInquiries`) |
| `GET` | `/api/inquiries/export` | JWT | Export inquiries to CSV (UTF-8 BOM, RFC 4180) (`exportData`) |
| `PATCH`| `/api/inquiries/:id` | JWT | Update inquiry internal notes (`manageInquiries`) |
| `PATCH`| `/api/inquiries/:id/status` | JWT | Transition inquiry status (`new`/`contacted`/`qualified`/`closed`) |
| `DELETE`| `/api/inquiries/:id` | JWT | Delete inquiry (`super_admin` only) |

### Newsletter & Categories

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/newsletter` | Public | Subscribe to newsletter (idempotent, 200) |
| `GET` | `/api/newsletter` | JWT | List newsletter subscribers (`exportData`) |
| `GET` | `/api/newsletter/export` | JWT | Export newsletter list to CSV (`exportData`) |
| `DELETE`| `/api/newsletter/:id` | JWT | Unsubscribe / remove subscriber (`exportData`) |
| `GET` | `/api/categories` | Public | List active property categories |
| `POST` | `/api/categories` | JWT | Create category (`manageProjects`) |
| `PUT` | `/api/categories/:id` | JWT | Update category (`manageProjects`) |
| `DELETE`| `/api/categories/:id` | JWT | Delete category (`manageProjects`) |

### Production Logs & Telemetry

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/logs/view` | Key/JWT | Interactive dark-mode live HTML terminal log monitor |
| `GET` | `/api/logs` | Key/JWT | Structured JSON log stream with query filters (`level`, `search`, `limit`) |
| `GET` | `/api/logs/raw` | Key/JWT | Plain-text raw log tail stream for terminal piping |
| `POST` | `/api/logs/clear` | Key/JWT | Truncate `prod.log` and flush the 2,000-event memory buffer |

### Developer Notes & Bug Reports

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/developer/notes` | Public | Submit developer note from floating pet (dispatches instant email alert) |
| `GET` | `/api/developer/notes` | Key/JWT | Fetch developer notes with filters (`status`, `priority`, `search`) |
| `GET` | `/api/developer/notes/export` | Key/JWT | Export developer notes as Markdown or JSON |
| `PATCH`| `/api/developer/notes/:id` | Key/JWT | Update status (`open`/`in_progress`/`resolved`/`closed`) or priority |
| `DELETE`| `/api/developer/notes/:id` | Key/JWT | Permanently delete developer note |

### Media & System Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/media/upload` | JWT | Upload image (re-encoded to WebP 2400px q82) or PDF attachment |
| `GET` | `/api/health` | Public | System status and platform version (`{ status: "ok", version: "1.2.1" }`) |

---

## 📊 Production Logs & Telemetry

The platform includes a zero-dependency high-speed logging and telemetry engine:

- **In-Memory Ring Buffer**: Retains the last 2,000 log events in memory for 0ms retrieval.
- **Persistent Disk Stream**: Concurrently appends every log entry to `server/prod.log`.
- **Live Terminal Monitor**: Navigate to `/api/logs/view?key=YOUR_SECRET_KEY` in any browser to open an interactive dark-mode terminal featuring:
  - 3-second live auto-polling.
  - Level filter buttons (`ALL`, `INFO`, `WARN`, `ERROR`, `DEBUG`).
  - Debounced real-time text search.
  - System telemetry bar displaying memory usage, uptime, and platform version.
  - One-click log flushing.
- **Terminal Tail Piping**:
  ```bash
  curl -s "http://localhost:4000/api/logs/raw?key=ajda-logs-secret-2026"
  ```
- **Authentication**: Access is authorized via `?key=<LOGS_SECRET_KEY>`, `x-logs-key` header, Admin JWT (`super_admin`), or when `LOGS_PUBLIC=true`.

---

## 🐞 Developer Notes Isolation

Developer bug reports, performance observations, and technical tasks submitted through the floating Admin Feedback Pet (`AdminFeedbackPet.tsx`) are **strictly isolated** from customer business inquiries:

- **Dedicated Table**: Stored in `DeveloperNote` (never touching `CustomerInquiry` or CRM tables).
- **Instant Email Alerts**: Automatically emails `DEVELOPER_EMAIL` (`cloud.data.sa@gmail.com`) with full technical context (reporter name, URL path, user agent, viewport dimensions, and priority).
- **Restricted Access**: Accessible only via `DEVELOPER_NOTES_SECRET` or `super_admin` JWT.
- **Developer CLI / Curl Export**:
  ```bash
  # View all open notes
  curl -H "x-developer-key: ajda-dev-notes-2026" "http://localhost:4000/api/developer/notes?status=open"

  # Export all notes to a markdown document
  curl -H "x-developer-key: ajda-dev-notes-2026" "http://localhost:4000/api/developer/notes/export?format=markdown" > dev-notes.md
  ```

---

## 🚀 Production Deployment

The platform is designed for **native bare-metal Linux deployment** (Ubuntu 24.04 LTS) without Docker containers:

1. **Operating System**: Ubuntu 24.04 LTS
2. **Database**: PostgreSQL 16 managed via native `systemd` (`postgresql.service`)
3. **API Process**: Node.js 22 LTS managed via `systemd` (`/etc/systemd/system/ajda-api.service`)
4. **Web Server & Reverse Proxy**: Caddy 2 with automatic Let's Encrypt TLS:
   - Serves static frontend bundle (`/opt/ajda/dist`)
   - Reverse proxies `/api/*`, `/uploads/*`, and `/socket.io/*` to `http://127.0.0.1:4000`
5. **Backups**: Automated cron job running `/opt/ajda/deploy/backup.sh` (PostgreSQL dump + compressed uploads archive).

For complete step-by-step instructions, see the [Production Deployment Guide](docs/deployment.md).

---

## 🛡️ Quality Gates & Standards

Every change must pass our automated quality gates before merging:

1. **TypeScript Type Safety**:
   ```bash
   npx tsc -p tsconfig.app.json --noEmit   # Frontend (0 errors)
   npx tsc -p server/tsconfig.json --noEmit # Backend (0 errors)
   ```
2. **Fast Static Analysis (Oxlint)**:
   ```bash
   npm run lint                          # 0 errors across 230+ files
   ```
3. **Automated Testing (Vitest)**:
   ```bash
   cd server && npm run test             # Unit & integration suites
   ```
4. **Production Build**:
   ```bash
   npm run build                         # Compiles frontend static bundle (~300ms)
   ```
5. **Version Alignment**: Version numbers are kept strictly in sync across `package.json`, `server/package.json`, `docs/CHANGELOG.md`, `docs/README.md`, and `GET /api/health`.