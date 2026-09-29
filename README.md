# 🏗️ Ajda Real Estate Platform

Full-stack real estate management system: a React 19 + Vite SPA (AR/EN) with a Fastify + Prisma + PostgreSQL API.

## Repository Layout

```
ajda/
├── src/                    # Frontend — React 19 + Vite + Tailwind v4
│   ├── data/properties.ts  # Display helpers only (getPropertyDisplay)
│   ├── services/           # api.ts client + property/inquiry/auth/media services
│   │                        #   and adminStorage.ts (async facade over the API)
│   ├── hooks/              # useAsyncData (loading/error/reload), useRealtimeUnits
│   └── pages/              # public site + /admin/*
├── server/                 # Backend — Fastify + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # Canonical schema (SQLite provider = DEV)
│   │   ├── migrations/     # PRODUCTION Postgres migrations (committed)
│   │   ├── seed.ts         # Seeds admin users, categories, projects
│   │   └── seed-data/      # projects.seed.ts (AUTO-GENERATED, dev bootstrap only)
│   ├── scripts/
│   │   ├── generate-prod-schema.mjs   # schema.prisma → schema.postgresql.prisma
│   │   └── sync-data.mjs              # legacy bootstrap: static data → seed
│   ├── src/
│   │   ├── config/         # env.ts (zod-validated), constants.ts
│   │   ├── middleware/     # auth (JWT), validate (zod)
│   │   ├── routes/         # auth, projects, units, inquiries, media
│   │   ├── services/       # prisma, mediaService (sharp/WebP), serializers,
│   │   │                   #   mailService + mailTemplates, otpService, notifications
│   │   ├── sockets/        # Socket.io realtime engine
│   │   ├── types/          # Fastify/JWT type augmentation
│   │   ├── app.ts          # buildApp() factory (testable, no listen)
│   │   └── server.ts       # Entry point → listen
│   └── uploads/            # Local media storage (gitignored)
└── refactor.md             # Architecture & phase plan (Phase 4 complete)
```

## Database Strategy — SQLite (dev) / PostgreSQL (prod)

One canonical schema, two generated schemas — no Docker required.

| | Dev local | Production |
|---|---|---|
| Schema | `prisma/schema.prisma` (sqlite) | `prisma/schema.postgresql.prisma` (generated) |
| Sync | `npm run db:push` | committed migrations `npm run db:migrate` |
| DB file | `server/prisma/dev.db` | PostgreSQL 16 |

> Prisma cannot read `provider` from an env var (error P1012). The prod schema is
> generated from the canonical one — see `npm run db:gen:prod`.

### Creating PostgreSQL Database & User

To set up a fresh PostgreSQL database and dedicated user (e.g. on Ubuntu/Debian VPS):

1. **Open the PostgreSQL CLI as the `postgres` superuser**:
   ```bash
   sudo -u postgres psql
   ```

2. **Create the user (role), database, and grant privileges**:
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

   *Alternatively, run all at once in bash:*
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

3. **Set `DATABASE_URL` in `server/.env`**:
   ```dotenv
   DATABASE_URL="postgresql://ajda:YOUR_STRONG_PASSWORD@localhost:5432/ajda?schema=public"
   ```

4. **Verify connection (optional)**:
   ```bash
   psql -U ajda -d ajda -h localhost -W
   ```

5. **Generate client and apply migrations**:
   ```bash
   cd server
   npm run db:gen:prod   # generates PostgreSQL schema & compiles Prisma Client
   npm run db:migrate    # applies migrations via prisma migrate deploy
   npm run db:seed       # seeds initial admin user & catalogue
   ```

## Data Source of Truth

The **database is the source of truth** for projects, floors, units, and inquiries.
`src/data/properties.ts` survives only as a pure presentation helper
(`getPropertyDisplay`) — it is no longer the data layer.

| Concern | Owner |
|---|---|
| Projects / floors / units / inquiries / admin users | API + Prisma |
| Categories | API (`/api/categories`); the admin Categories tab is being migrated off browser `localStorage` |
| Auth token | `localStorage`, sent as `Authorization: Bearer` |
| UI loading / error / reload state | `useAsyncData` |
| Live unit-status sync | `useRealtimeUnits` (Socket.io) |

Reads are public (`GET /api/projects`); every write is JWT-protected. In dev the
Vite server proxies `/api`, `/uploads`, and `/socket.io` to `http://localhost:4000`,
so both servers run on their default ports with no CORS setup.

## Backend — Quick Start (dev)

```bash
cd server
npm install
cp .env.example .env           # dev defaults are fine
npm run db:gen:prod            # generates prisma/schema.postgresql.prisma (gitignored)
npm run db:push                # create prisma/dev.db from sqlite schema
npm run db:seed                # admin users, categories, 7 projects / 12 floors / 30 units
npm run dev                    # API on :4000 with tsx watch
```

- Default admin: `admin@ajdaa.sa` / `password` (override via `SEED_ADMIN_PASSWORD`).
- Smoke tests: `curl http://localhost:4000/api/health`.

## Frontend — Quick Start (dev)

```bash
npm install
npm run dev      # SPA on :5173, proxying /api + /socket.io to :4000
npm run build    # production bundle → dist/ (static, served by Caddy)
```

Run the API first (`cd server && npm run dev`), otherwise every read returns a
network error and the UI shows its error state rather than empty data.

### Seed data

`server/prisma/seed-data/projects.seed.ts` is **auto-generated** by
`npm run db:sync-data` and is a **dev bootstrap only** — it seeds a starting dataset
(7 projects / 12 floors / 30 units). It is no longer the source of truth; the API and
database are. Once the API is live, projects are created and edited through
`/admin/dashboard`, not by regenerating this file.

```bash
npm run db:sync-data   # optional: regenerate the bootstrap seed, then npm run db:seed
```

**Safe to re-run.** The seed upserts admin users and categories, and seeds projects
*only when the `Project` table is empty*. On a database that already has projects it
logs `Projects already present (N) — skipping project seed.` and leaves everything
alone, so re-running it after a deploy never destroys dashboard edits. To force a
wipe-and-reseed of projects/floors/units:

```bash
SEED_RESET_PROJECTS=1 npm run db:seed
```

### Seed images and `uploads/`

The generated seed stores image paths as frontend source paths (`assets/ajda/...`,
relative to `src/`). Those are content-hashed by a production Vite build, so the
paths 404 once built. Before creating projects, `db:seed` therefore copies every
referenced file from `src/<path>` into `UPLOAD_DIR/seed/<path without "assets/">`
and stores the served URL (`/uploads/seed/ajda/prime/prime1.webp`) in the database.
Absolute `http(s)` URLs and paths already starting with `/uploads/` are stored
unchanged, and identical files are skipped on re-runs. If a source asset is missing
the seed fails and lists the missing files rather than storing a broken URL.

Because seed media now lives in the upload directory, **`server/uploads/` holds real
site content and must be backed up** (the deploy backup script at
`deploy/README-deploy.md` does not include it by default).

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | – | Login → `{ token, user }`, or `{ otpRequired, challengeId, emailHint }` + emailed code when OTP applies |
| POST | `/api/auth/login/verify-otp` | – | Exchange the emailed code → `{ token, user }` (wrong: `400` + `attemptsLeft`; dead: `410`) |
| POST | `/api/auth/login/resend-otp` | – | Re-send the login code → `{ sent }` (`429` inside the cooldown) |
| POST | `/api/auth/password/forgot` | – | Start a reset. Always `{ sent }`, whether or not the address exists |
| POST | `/api/auth/password/reset` | – | `{ email, code, newPassword }` → `{ reset }`; kills every earlier token |
| PATCH | `/api/auth/me/login-otp` | JWT | Turn login OTP on/off for the signed-in admin (requires the current password) |
| GET | `/api/auth/me` | JWT | Current user |
| PATCH | `/api/auth/me` | JWT | Update own profile (name, email, phone) |
| POST | `/api/auth/me/password` | JWT | Change password (requires current password verification) |
| GET/POST | `/api/auth/users` | JWT | List / create admin users |
| PUT/DELETE | `/api/auth/users/:id` | JWT | Update / deactivate (no self-delete, no last `super_admin`) |
| GET | `/api/permissions` | JWT | List fixed permission catalogue |
| GET/POST | `/api/roles` | JWT | List roles (with userCount) / create role (manageUsers) |
| PUT/DELETE | `/api/roles/:id` | JWT | Update role (applyToUsers) / delete unused role (manageUsers) |
| GET/POST | `/api/departments` | JWT | List departments (with userCount) / create department (manageUsers) |
| PUT/DELETE | `/api/departments/:id` | JWT | Update department / delete unused department (manageUsers) |
| GET | `/api/projects` | – | Published projects `?city=&type=&priceType=`; admin list via `?scope=admin[&status=]` (JWT) |
| GET | `/api/projects/:id` | – | Published project + floors + units; admin view via `?scope=admin` (JWT) |
| POST/PUT/DELETE | `/api/projects/:id` | JWT | Admin CRUD (new projects default to draft) |
| PATCH | `/api/projects/:id/publish` | JWT | Update project publish status (manageProjects) |
| POST/PUT/DELETE | `/api/projects/:id/floors*` | JWT | Nested floor CRUD; deleting a floor cascades its units |
| POST/PUT/DELETE | `/api/units*` | JWT | Unit CRUD |
| PATCH | `/api/units/:id/status` | JWT | Update unit status (Socket.io broadcast) |
| POST | `/api/inquiries` | – | Public inquiry against published project (Socket.io alert + admin email) |
| GET | `/api/inquiries` | JWT | CRM list `?status=&projectId=` |
| GET | `/api/inquiries/export` | JWT | Export inquiries to CSV (BOM, RFC 4180) |
| PATCH | `/api/inquiries/:id` | JWT | CRM inquiry update (notes, status) |
| PATCH | `/api/inquiries/:id/status` | JWT | CRM status change |
| DELETE | `/api/inquiries/:id` | JWT | Delete inquiry (super_admin only) |
| GET | `/api/categories` | – | List categories sorted by id |
| POST | `/api/categories` | JWT | Create category (manageProjects) |
| PUT | `/api/categories/:id` | JWT | Update category (manageProjects) |
| DELETE | `/api/categories/:id` | JWT | Delete category (manageProjects) |
| POST | `/api/newsletter` | – | Subscribe to newsletter (idempotent, 200) |
| GET | `/api/newsletter` | JWT | List subscribers newest first (exportData, ?q=) |
| GET | `/api/newsletter/export` | JWT | Export subscribers to CSV (exportData, BOM, RFC 4180) |
| DELETE | `/api/newsletter/:id` | JWT | Unsubscribe / remove subscriber (exportData) |
| POST | `/api/media/upload` | JWT | Image → WebP (sharp, 2400px q82) or PDF |
| GET | `/api/health` | – | Health check |

Bodies are validated with zod (`400` + `issues` on failure). Arrays stored in the DB
(JSON) are serialized back to real arrays by `services/serializers.ts`.

Notable server-side guarantees:

- **Prisma error mapping** — `P2025` → `404`, `P2002` → `409`, `P2003` → `400`, so a
  missing row never surfaces as an opaque `500`.
- **Uploads are type-sniffed, not trusted** — the media type is detected from magic
  bytes, not the client-declared mimetype. Images are always re-encoded through
  sharp; PDFs are stored as-is and served with `Content-Disposition: attachment` and
  `X-Content-Type-Options: nosniff`. Anything outside the allowlist → `400`,
  over 50 MB → `413`.
- **Inquiries are self-describing** — `projectTitle` / `unitNumber` are resolved from
  the referenced `Project` / `PropertyUnit` rows, so a client cannot spoof or omit them.
- **Rate limiting & reverse proxy** — Per-route rate limits (login, inquiries, newsletter, OTP, password reset) and account lockouts protect against abuse; Fastify respects `trustProxy` when deployed behind Caddy.
- **Email is optional at boot** — with no `MAIL_HOST` (or under `NODE_ENV=test`) every send becomes a logged no-op, so the API never fails to start because SMTP is missing. The test suite reads the in-memory capture through `getSentMail()`.
- **OTP codes are never stored in the clear** — only a SHA-256 digest of `JWT_SECRET + admin + purpose + code` is persisted, compared in constant time, and bounded by a 10-minute TTL, five attempts and a 60-second resend cooldown. Issuing a new challenge supersedes the previous one.
- **Notifications never leak to the wrong inbox** — a new inquiry is emailed only to active admins holding `viewInquiries` (or to `NOTIFY_INQUIRY_EMAILS` when set), and spam-dropped submissions send nothing.

## Email

`server/src/services/mailService.ts` holds the transport; `mailTemplates.ts` renders
Arabic-first RTL bodies (inline styles, a plain-text alternative, everything
interpolated escaped). Copy these placeholders into `server/.env`:

```dotenv
MAIL_HOST=""                 # empty = mail disabled (logged no-op)
MAIL_PORT=587
MAIL_USERNAME=""
MAIL_PASSWORD=""             # Gmail: an app password, not the account password
MAIL_ENCRYPTION=tls          # tls = STARTTLS (587) | ssl = implicit TLS (465) | none
MAIL_FROM_ADDRESS=""
MAIL_FROM_NAME="Ajda"        # sender display name and the heading of every email
APP_URL="https://ajda.weghetk.com"   # base for links inside emails

LOGIN_OTP_REQUIRED="false"   # true = every admin login needs a code
LOGIN_OTP_TTL_MS=600000
LOGIN_OTP_MAX_ATTEMPTS=5
LOGIN_OTP_RESEND_COOLDOWN_MS=60000

NOTIFY_INQUIRY_EMAILS=""     # empty = every active admin with viewInquiries
```

| Variable | Effect |
|---|---|
| `MAIL_HOST` unset, or `NODE_ENV=test` | Sending is disabled; messages are captured in memory instead of delivered |
| `LOGIN_OTP_REQUIRED=false` (default) | Only admins with `loginOtpEnabled` (set via `PATCH /api/auth/me/login-otp`) need a code |
| `LOGIN_OTP_REQUIRED=true` | Every admin login answers `otpRequired` until the flag is turned off |
| `NOTIFY_INQUIRY_EMAILS=a@x.com,b@y.com` | Only these addresses receive new-inquiry notices |
| `APP_URL` | Prefix for the "view inquiries" link in the notification email |

A send failure is logged and swallowed, so it can never turn a successful inquiry
or password change into a `500`. The one deliberate exception: the OTP code is
awaited by the login/reset routes, because without the mail there is nothing to
verify.

## Production Checklist

- [ ] PostgreSQL 16 user + database (see [Creating PostgreSQL Database & User](#creating-postgresql-database--user)); `DATABASE_URL` → `postgresql://...` in `server/.env`
- [ ] `JWT_SECRET` = `openssl rand -base64 32`
- [ ] `CLIENT_ORIGIN` = production origin (e.g. `https://ajda.weghetk.com`)
- [ ] `npm run db:migrate` → applies committed Postgres migrations
- [ ] `npm run build` in the repo root → serve `dist/` as static files from Caddy
      (the SPA calls same-origin `/api`, `/uploads`, `/socket.io`; in dev these are
      Vite proxies, in production they are Caddy `reverse_proxy` blocks)
- [ ] Caddy block: `/api/*`, `/uploads/*`, `/socket.io/*` → `localhost:4000`
- [ ] `uploads/` must be writable by the service user
- [ ] SPA fallback: unknown paths → `index.html` (client-side routing)
- [ ] Email (see [Email](#email)): `MAIL_*` filled in, `APP_URL` = production origin.
      The API boots without it, but OTP logins, password reset and inquiry
      notifications stay silent until `MAIL_HOST` is set

### Known non-blocking items

- The frontend ships as a single ~600 kB chunk (166 kB gzipped). Route-level code
  splitting is the obvious next win if first paint on mobile needs to be faster.
- `npm run lint` (oxlint) reports 3 pre-existing warnings in `ClientsPage.tsx` and
  `PropertyModal.tsx`; they predate Phase 4 and are unrelated to it.