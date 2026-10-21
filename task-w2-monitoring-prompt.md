# Task w2-monitoring — development-period monitoring endpoint (test + prod)

START ONLY AFTER `lane/sec0` and `lane/foundation` are merged. Create the worktree from the merged `feat/backend-admin`.

## Goal
A monitoring surface for the first month after go-live: logs of everything (requests, exceptions, service status, queue), plus a server status report. Two access modes:
- **External mode** (for tools/curl outside the dashboard): bearer-token API, **auto-expires** on a date, can be disabled any time.
- **Dashboard mode**: the same data for logged-in super admins inside the admin dashboard, permanent.

## Read first
`server/src/routes/logs.routes.ts` (as changed by sec0), `server/src/services/loggerService.ts`, `server/src/app.ts` (hooks, `/api/health`), `server/src/config/env.ts`, `server/src/services/{queueService,mailSettings}.ts`, `server/src/sockets/index.ts`, `server/scripts/backup_db.sh`, `server/test/` (style), admin UI: `src/pages/admin/adminRoutes.ts`, one existing section under `src/pages/admin/sections/`, `src/services/api.ts`.

## Decided design
1. **Env (add to `env.ts`, `.env.example`, docs):** `APP_ENV` (`production|test|development`, label only, shown in every payload), `MONITOR_TOKEN` (optional, ≥32 chars when set), `MONITOR_EXTERNAL_UNTIL` (ISO date; empty = external mode OFF). External mode is active only if token set AND now < until. No default token.
2. **Routes under `/api/monitor/*`** (replace the old `/api/logs/*` secret-key flow; keep `/api/logs` paths as thin aliases only if tests/UI depend on them, same guards):
   - `GET /api/monitor/status` — `{ appEnv, version, commit (from env GIT_COMMIT or package.json), uptimeSec, node, memory{rss,heapUsed}, loadAvg, db{ok,latencyMs}, redis{ok,latencyMs|null}, queue{driver, waiting, active, failed, delayed}, smtp{configured,lastVerifyOk|null}, disk{uploadsMB, logsMB, freeGB}, externalMonitor{active, until, daysLeft} }`. Each probe has a 2 s timeout and never throws.
   - `GET /api/monitor/logs?level=&since=&limit=&q=` — structured entries (requests, errors, service events); `limit` max 1000; read the file by tailing the last N KB (no full `readFileSync`).
   - `GET /api/monitor/errors` — exceptions with stack, request id, route, user id (no email/PII bodies).
   - `POST /api/monitor/logs/clear` — dashboard mode + super admin only, audited.
3. **Auth:** dashboard mode = existing `authenticate` + super admin (DB-checked). External mode = `Authorization: Bearer <MONITOR_TOKEN>` compared with `timingSafeEqual`; GET only; read-only; rate limit 30/min per IP; every call logged (path, IP, status). When external mode is inactive the token path answers **404** (indistinguishable from a missing route). Never accept tokens in the query string.
4. **What gets logged additionally:** unhandled rejection / uncaught exception handlers (log then exit non-zero so systemd restarts), Fastify error hook, slow requests (> 1 s) at `warn`, service state transitions (redis up/down, queue driver fallback, smtp verify result at boot), boot line with version/commit/appEnv, graceful shutdown. Redact `authorization`, cookies, `password`, `token`, `otp`, `key`, CV/PII bodies from all entries.
5. **Retention and rotation:** size-based rotation of `prod.log`/`errors.log` (e.g. 20 MB × 5 files) implemented in `loggerService` (no new dependency unless trivial); document `logrotate` alternative in `deploy/README-deploy.md` only if that file exists in your branch, otherwise in `docs/monitoring.md`.
6. **Admin dashboard section "مراقبة الخادم / Server monitor"** (super admin only, route `/admin/monitor`, Arabic first then English labels via the existing language mechanism): status cards (db, redis, queue, smtp, disk, uptime), banner "External monitoring active until <date> (N days)" or "off", log table with level filter, search, auto-refresh 5 s toggle, errors tab with stack expand, download button, clear button with confirm dialog (use existing `ConfirmDialog`, not `window.confirm`).
7. **Docs `docs/monitoring.md`:** how to enable (env lines to add on the server, with `MONITOR_EXTERNAL_UNTIL` = go-live + 30 days), curl examples, how to disable early (unset token + restart), what remains after expiry (dashboard only).
8. **Tests:** token valid/invalid/expired/missing token env → 404; no query-string token; super-admin dashboard access; viewer role denied; redaction; status shape with redis/smtp down; clear is audited; log tail respects `limit`.

## Out of scope
SEO, other audit items, Prometheus/Grafana/third-party services, alerting (a later wave can add email alerts via the notification listeners), schema changes (none needed).

## Constraints
No commits, no installs, never read `.env*`. Free model only.

## Gates
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test`; then run the server locally and `curl` the three GET endpoints with a test token, paste output with secrets masked.

## Report
`task-w2-monitoring-report.md`: files changed, gate results, curl outputs, decisions.
