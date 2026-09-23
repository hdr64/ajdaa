# 🏗️ Ajda Real Estate Platform

Full-stack real estate management system: a React 19 + Vite SPA (AR/EN) with a Fastify + Prisma + PostgreSQL API.

## Repository Layout

```
ajda/
├── src/                    # Frontend — React 19 + Vite + Tailwind v4
│   ├── data/properties.ts  # Source of truth for project data
│   ├── services/           # adminStorage.ts (localStorage), API layer (Phase 4)
│   └── pages/              # public site + /admin/*
├── server/                 # Backend — Fastify + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # Canonical schema (SQLite provider = DEV)
│   │   ├── migrations/     # PRODUCTION Postgres migrations (committed)
│   │   ├── seed.ts         # Seeds admin users, categories, projects
│   │   └── seed-data/      # projects.seed.ts (AUTO-GENERATED from frontend data)
│   ├── scripts/
│   │   ├── generate-prod-schema.mjs   # schema.prisma → schema.postgresql.prisma
│   │   └── sync-data.mjs              # src/data/properties.ts → seed data
│   ├── src/
│   │   ├── config/         # env.ts (zod-validated), constants.ts
│   │   ├── middleware/     # auth (JWT), validate (zod)
│   │   ├── routes/         # auth, projects, units, inquiries, media
│   │   ├── services/       # prisma, mediaService (sharp/WebP), serializers
│   │   ├── sockets/        # Socket.io realtime engine
│   │   ├── types/          # Fastify/JWT type augmentation
│   │   ├── app.ts          # buildApp() factory (testable, no listen)
│   │   └── server.ts       # Entry point → listen
│   └── uploads/            # Local media storage (gitignored)
└── refactor.md             # Architecture & phase plan
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

### Regenerating seed data

`server/prisma/seed-data/projects.seed.ts` is **auto-generated** from the frontend
source of truth `src/data/properties.ts`:

```bash
npm run db:sync-data   # regenerate, then npm run db:seed
```

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | – | Login → JWT token |
| GET | `/api/auth/me` | JWT | Current user |
| GET/POST | `/api/auth/users` | JWT | List / create admin users |
| GET | `/api/projects` | – | Projects `?city=&type=&priceType=` |
| GET | `/api/projects/:id` | – | Project + floors + units |
| POST/PUT/DELETE | `/api/projects/:id` | JWT | Admin CRUD |
| PATCH | `/api/units/:id/status` | JWT | Update unit status (Socket.io broadcast) |
| POST | `/api/inquiries` | – | Public inquiry (Socket.io alert) |
| GET/PATCH | `/api/inquiries*` | JWT | CRM list / status |
| POST | `/api/media/upload` | JWT | Image→WebP (sharp 2400px q82) or PDF |
| GET | `/api/health` | – | Health check |

Bodies are validated with zod (`400` + `issues` on failure). Arrays stored in the DB
(JSON) are serialized back to real arrays by `services/serializers.ts`.

## Production Checklist

- [ ] PostgreSQL 16 user + database; `DATABASE_URL` → `postgresql://...` in `server/.env`
- [ ] `JWT_SECRET` = `openssl rand -base64 32`
- [ ] `CLIENT_ORIGIN` = production origin (e.g. `https://ajda.weghetk.com`)
- [ ] `npm run db:migrate` → applies committed Postgres migrations
- [ ] Caddy block: `/api/*`, `/uploads/*`, `/socket.io/*` → `localhost:4000`
- [ ] `uploads/` must be writable by the service user