# Ajda Real Estate Platform

> **Version 1.2.x** | React 19 SPA + Fastify 5 API + Prisma 6 | SQLite (dev) / PostgreSQL 16 (production)

Real-estate marketing site and admin dashboard for ajdaa.sa: a bilingual (AR/EN) public site, a database-driven CMS, projects/floors/units with live status, inquiries and careers handling, past-projects showcase, role- and action-level permissions, and a multi-factor admin login (email code, authenticator app, passkeys). The admin dashboard is Arabic first with an English translation.

This README covers setup and day-to-day commands only. Everything else has one home:

| Topic | Where |
|---|---|
| Open tasks and order of work | [docs/TODO.md](docs/TODO.md) |
| System design, data models, auth, queue | [docs/architecture.md](docs/architecture.md) |
| CMS design | [docs/cms-architecture.md](docs/cms-architecture.md) |
| Every API route and its guard | [docs/api-reference.md](docs/api-reference.md) |
| Deploying (test instance, production, backups, Caddy, systemd) | [deploy/README-deploy.md](deploy/README-deploy.md), [docs/github-actions-deploy.md](docs/github-actions-deploy.md) |
| Tests | [docs/testing-strategy.md](docs/testing-strategy.md) |
| Admin translation rules | [docs/ADMIN-I18N.md](docs/ADMIN-I18N.md) |
| Release notes | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| Full documentation index | [docs/README.md](docs/README.md) |

---

## Repository layout

```
ajda/
├── src/                    # Frontend: React 19 + Vite + Tailwind v4
│   ├── components/admin/   # Admin dashboard (auth, users, projects, settings, cms, floorplan, ...)
│   ├── i18n/admin/         # Admin AR/EN strings (one file per area)
│   ├── context/            # CmsContext, Language, Theme providers
│   ├── services/           # api.ts client and per-domain services
│   └── pages/              # Public site and /admin/*
├── server/                 # Backend: Fastify + Prisma
│   ├── prisma/             # schema.prisma (SQLite, dev), migrations/ (PostgreSQL SQL, committed), seed
│   ├── src/                # config, middleware, routes, services, sockets, app.ts, server.ts
│   └── test/               # Vitest suites
├── deploy/                 # Playbook, Caddyfiles, systemd units, deploy and backup scripts
├── scripts/                # deploy-test.mjs / deploy-prod.mjs helpers
├── docs/                   # Documentation (see table above)
├── CLAUDE.md               # Context file for Claude Code (planner)
├── refactor.md             # Owner requests log
└── salah-tasks.md          # Owner's own actions (secrets, servers, first production deploy)
```

---

## Quick start

Requires Node 20+ (production and CI run Node 24).

```bash
npm install
npm --prefix server install
cp server/.env.example server/.env     # set JWT_SECRET (min 16 chars); the rest has dev defaults
npm --prefix server run db:push        # create the SQLite dev database
npm --prefix server run db:seed        # super admin, categories, demo projects
npm run dev:all                        # API on :4000 and Vite on :5173 (proxies /api, /uploads, /socket.io)
```

- Seeded super admin: `admin@ajdaa.sa` / `password` (override with `SEED_ADMIN_PASSWORD`). Change it before anything is exposed.
- Health check: `curl http://localhost:4000/api/health`.
- Redis is optional in dev. The queue probes it on boot and falls back to inline (`sync`) execution; set `QUEUE_DRIVER=sync` to force that.
- Mail is a logged no-op while `MAIL_HOST` is empty.
- After pulling schema changes: `cd server && npx prisma generate && npm run db:push`. If `prisma generate` fails with `EPERM` on Windows, stop the running dev API first (it locks the query engine DLL).

### Database

One canonical schema, `server/prisma/schema.prisma` (SQLite provider), used for dev and tests. Production uses PostgreSQL through a generated, gitignored copy: `npm run db:gen:prod` writes `schema.postgresql.prisma`, then `npm run db:migrate` runs `prisma migrate deploy`. Committed migrations in `server/prisma/migrations/` are hand-written PostgreSQL SQL; `db:push` never creates a migration, so every schema change needs one. Production migrations are always run by the owner by hand after a backup (Prisma has no rollback). Creating the production role and database: [deploy/README-deploy.md](deploy/README-deploy.md) section 3.3.

### Seed data

`server/prisma/seed-data/projects.seed.ts` is generated (`npm run db:sync-data`) and is a dev bootstrap only; the database is the source of truth for everything the site shows. `db:seed` is idempotent and skips projects when any exist; `SEED_RESET_PROJECTS=1 npm run db:seed` wipes and reseeds them.

---

## Configuration

All variables are validated with Zod at startup (`server/src/config/env.ts`); the commented template is `server/.env.example` (root `.env.example` holds only the `VITE_*` client variables, copied to `.env.local`). Production refuses to start with missing or weak secrets.

Required in production, not placeholders, all different: `JWT_SECRET` (at least 32 characters), `SETTINGS_ENCRYPTION_KEY`, `LOGS_SECRET_KEY` and `DEVELOPER_NOTES_SECRET` (at least 24 each). Generate with `openssl rand -base64 32`. Never change `SETTINGS_ENCRYPTION_KEY` after anyone has enrolled an authenticator app or saved SMTP credentials. Other settings that matter in production: `NODE_ENV`, `DATABASE_URL`, `APP_URL`, `CLIENT_ORIGIN`, `TRUST_PROXY` (set it behind Caddy), `HOST=127.0.0.1`, `MAIL_*`, `WEBAUTHN_RP_ID` (defaults to the `APP_URL` host; changing it later breaks every passkey), `REDIS_URL`/`QUEUE_DRIVER`. See [deploy/README-deploy.md](deploy/README-deploy.md) section 2.1 for the production table.

Never paste `.env` contents into chats or tickets; to show a file safely use `sed -E 's/=.*/=<hidden>/' server/.env`.

---

## Quality gates

Every change must pass all of these:

```bash
npm run lint                                # oxlint, 0 errors
npx tsc -p tsconfig.app.json --noEmit       # frontend types
npm run build                               # tsc -b && vite build
npm --prefix server run build               # backend types and build
npm --prefix server test                    # Vitest (44 files, 428 tests at 2026-10-26)
```

UI work also needs a browser pass in both languages (lint and build do not catch raw translation keys or handler mismatches).

Versions: the root `package.json`, `server/package.json` and the `/api/health` response should carry the same number; they currently differ (1.2.2 / 1.2.3 / 1.2.2) and need aligning at the next release.

---

## Deployment

Bare-metal Ubuntu 24.04 (no Docker): PostgreSQL 16, Redis, Node, Caddy 2 in front, API under systemd. CI (`.github/workflows/deploy.yml`) deploys the **test instance only** (`ajda.weghetk.com`). Production (`ajdaa.sa`) and every production database command are run by the owner by hand, after a backup, with `reload.sh` on the server. From the owner's PC: `npm run deploy:test` pushes `HEAD` plus an empty redeploy commit to the `deploy-test` branch (dirty files are not deployed) (CI lints, builds, tests, deploys) and watches the run until it succeeds or fails; `npm run deploy:prod` checks out the pushed commit on the server and runs `reload.sh` after a typed confirmation. Full runbook: [deploy/README-deploy.md](deploy/README-deploy.md).
