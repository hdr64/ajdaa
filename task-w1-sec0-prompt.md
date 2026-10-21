# Task w1-sec0 — security criticals (backend)

Worktree lane `sec0`. Backend only.

## Read first
`server/src/config/env.ts`, `server/src/app.ts`, `server/src/server.ts`, `server/src/routes/logs.routes.ts`, `server/src/routes/developerNotes.routes.ts`, `server/src/routes/auth.routes.ts`, `server/src/middleware/*` (authenticate, requirePermission, requireSuperAdmin), `server/src/services/{mailService,queueService,loginFailureService,passwordPolicy}.ts`, `server/src/sockets/index.ts`, `server/prisma/seed.ts`, `server/.env.example`, `server/test/` (helpers + one authz test for style).

## Decided design (each item gets a test)
1. **Secrets:** remove the defaults of `LOGS_SECRET_KEY` and `DEVELOPER_NOTES_SECRET` in `env.ts`. In production they are required (min 24 chars); in dev/test default to a random per-process value (so the routes work only via an authenticated super admin). Compare keys with `crypto.timingSafeEqual` (equal-length buffers; length mismatch = reject).
2. **Logs and dev-notes guard:** both routes require the JWT-authenticated admin loaded from the database (use the existing `authenticate`; reject suspended/deleted users) AND super admin (existing helper) — the secret key becomes an additional header-only factor (`x-logs-key` / `x-dev-notes-key`), no more `?key=` query. Update `/api/logs/view` page: remove the secret from the HTML and inline JS, escape any interpolated value; it should use the stored session token or ask for the key via a form field sent as a header.
3. **`POST /developer-notes`:** require `authenticate`; ignore `adminEmail` from the body (use the authenticated user's email); cap field lengths (`title` 200, `body` 5000, `solution` 5000, `screenshotUrl` 500 and must be `https://` or start with `/uploads/`); socket event `developer:note:new` goes only to the admins room (use the existing `ADMINS_ROOM` constant in `sockets`).
4. **Passwords:** `createUserSchema` password becomes required (remove `.default('password123')`) and both `POST /auth/users` and `PUT /auth/users/:id` password paths run `meetsPasswordPolicy`. `seed.ts`: in production refuse to seed unless `SEED_ADMIN_PASSWORD` is set (min 10 chars, passes policy); dev default stays but is documented.
5. **Request log:** the `onResponse` hook in `app.ts` must log the path without the query string (and never log `key`, `token`, `otp`, `password` params anywhere).
6. **Network:** add `HOST` env (default `127.0.0.1`) used by `server.ts` instead of `'0.0.0.0'`; `TRUST_PROXY` default becomes `false`. Add both to `.env.example` with comments (production behind Caddy needs `TRUST_PROXY=true` or a hop count; document that).
7. **Mail queue:** `mailService.sendMail` must throw on SMTP failure so BullMQ retries run; the inline (no-Redis) path keeps catching and logging. Add a test with a failing transport.
8. **Helmet:** register `@fastify/helmet` (`npm --prefix server install @fastify/helmet` is the ONE allowed install) with a conservative config: no CSP for `/api` JSON (set `contentSecurityPolicy:false` for now and note it in the report), HSTS only when `NODE_ENV=production`, `crossOriginResourcePolicy: 'cross-origin'` so `/uploads` images still load from the SPA.
9. **JWT/env hygiene:** production requires `JWT_SECRET` ≥ 32 chars and rejects obvious placeholders (`changeme`, `secret`, `password`, values from `.env.example`). Remove the personal-Gmail default for `DEVELOPER_EMAIL`.

## Out of scope
Anything else from the audit (lockout, token revocation, indexes, pagination), frontend, deploy files, Prisma schema.

## Constraints
No commits, no other installs, never read `.env*`, do not touch `server/prisma/schema*` or `server/src/config/permissions.ts`. Free model only. Existing tests must still pass; update tests that relied on the removed defaults.

## Gates
`npm --prefix server run build`, `npm --prefix server test` (all green), new tests for items 1-5, 7. Show the final test counts.

## Report
`task-w1-sec0-report.md`: files changed, gates, behavior changes the owner must know (new required env vars for production: `LOGS_SECRET_KEY`, `DEVELOPER_NOTES_SECRET`, `HOST`, `TRUST_PROXY`), decisions.
