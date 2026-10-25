# Task w2-monitoring — development-period monitoring endpoint (test + prod)

Start only after `task-w4-i18n-core` and the auth lane are merged into `feat/backend-admin` (sec0 and foundation already are) and after the owner has given `MONITOR_ALLOWED_IPS` and `MONITOR_EXTERNAL_UNTIL`. Create the worktree from the merged `feat/backend-admin`.

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
3. **Auth:** dashboard mode = existing `authenticate` + super admin (DB-checked). External mode = `Authorization: Bearer <MONITOR_TOKEN>` compared with `timingSafeEqual`; GET only; read-only; rate limit 30/min per IP; every call logged (path, IP, status). When external mode is inactive the token path answers **404** (indistinguishable from a missing route). Never accept tokens in the query string. Optional `MONITOR_ALLOWED_IPS` env (comma list; empty = any IP): when set, external mode also requires the client IP (respecting the trust-proxy setting) to be in the list, else 404. The owner is the only external user.
4. **What gets logged additionally:** unhandled rejection / uncaught exception handlers (log then exit non-zero so systemd restarts), Fastify error hook, slow requests (> 1 s) at `warn`, service state transitions (redis up/down, queue driver fallback, smtp verify result at boot), boot line with version/commit/appEnv, graceful shutdown. Redact `authorization`, cookies, `password`, `token`, `otp`, `key`, CV/PII bodies from all entries.
5. **Retention and rotation:** size-based rotation of `prod.log`/`errors.log` (e.g. 20 MB × 5 files) implemented in `loggerService` (no new dependency unless trivial); document `logrotate` alternative in `deploy/README-deploy.md` only if that file exists in your branch, otherwise in `docs/monitoring.md`.
6. **Admin dashboard section "مراقبة الخادم / Server monitor"** (super admin only, route `/admin/monitor`, all labels through the admin i18n system: `useAdminT()` and a new area file `src/i18n/admin/monitor.ts` registered in `src/i18n/admin/index.ts`, following `docs/ADMIN-I18N.md`; no Arabic literals in components): status cards (db, redis, queue, smtp, disk, uptime), banner "External monitoring active until <date> (N days)" or "off", log table with level filter, search, auto-refresh 5 s toggle, errors tab with stack expand, download button, clear button with confirm dialog (use existing `ConfirmDialog`, not `window.confirm`).
6b. **Critical alerts email** (owner request): new admin setting "Critical alerts email" (Arabic label «بريد التنبيهات الحرجة») in the existing admin Settings screen (find the settings section/panel and the settings route/service pattern, e.g. `siteSettings`/`securitySettings`; store as AppSetting `monitor.alertEmails`, JSON list of emails, validated, max 5, super admin only). Backend `server/src/services/alertService.ts`: `sendCriticalAlert(kind, details)` mails the list directly through `mailService` (NOT through the queue, since Redis may be the thing that is down), 5 s timeout, never throws. Throttle: at most one email per `kind` per 30 minutes, in-memory plus a "recovered" email when the condition clears. A 60 s watcher (started in `server.ts` after listen, cleared on shutdown) checks db, redis (only if the queue driver uses it), disk free < 10 %, and the queue failed count growing; it alerts on ok→down transitions. Also alert on: uncaught exception / unhandled rejection (best effort, 3 s cap, then exit), and at boot if the previous run did not shut down cleanly (write a `.clean-shutdown` marker file on graceful stop, remove it at boot) with text "server restarted after unclean exit". Alert text includes appEnv, version/commit, time, and short details, never secrets or PII. Tests with a fake mail transport: throttle, recovered message, no throw when mail fails, validation of the settings field.
7. **Docs `docs/monitoring.md`:** how to enable (env lines to add on the server, with `MONITOR_EXTERNAL_UNTIL` = go-live + 30 days), curl examples, how to disable early (unset token + restart), what remains after expiry (dashboard only).
8. **Tests:** token valid/invalid/expired/missing token env → 404; no query-string token; super-admin dashboard access; viewer role denied; redaction; status shape with redis/smtp down; clear is audited; log tail respects `limit`.

## Out of scope
SEO, other audit items, Prometheus/Grafana/third-party services, Prometheus-style alert rules, SMS/WhatsApp alerts, schema changes (none needed).

## Constraints
No commits, no installs, never read `.env*`. Free model only.

## Gates
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test`; then run the server locally and `curl` the three GET endpoints with a test token, paste output with secrets masked.

## Report
`D:\projects\html\ajda\docs\prompts\task-w2-monitoring-report.md`: files changed, gate results, curl outputs, decisions.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.
