# Task w5-server-hardening — server fixes from the whole-project review (no schema, no auth)

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). Server only (`server/`, plus one runbook file). It runs in parallel with `ajda-wt/auth`, so it must **not** touch `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/src/routes/auth.routes.ts`, `server/src/middleware/auth.ts`, `server/src/sockets/`, `server/src/services/securitySettings.ts`, `otpService.ts`, `mailTemplates.ts`. Do not edit `ajda-wt/auth`.

## Goal

Fix nine confirmed server defects from `docs/prompts/review-ajda-project.md` (entries H-7, H-8, H-9, M-2, M-8, M-9, M-10, M-14, M-20: each lists file, lines, trigger and fix).

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply), `docs/prompts/review-ajda-project.md` (the nine entries)
- `server/src/routes/notifications.routes.ts`, `server/src/services/notificationListeners.ts`, `server/src/routes/roles.routes.ts` (the existing super-admin guard to imitate), `server/src/services/loggerService.ts`, `server/src/routes/logs.routes.ts`, `server/src/services/cmsService.ts`, `server/src/routes/cms.routes.ts`, `server/src/schemas/cms.schema.ts`, `server/src/routes/newsletter.routes.ts`, `developerNotes.routes.ts`, `careers.routes.ts`, `server/src/config/env.ts`, `server/src/services/mailSettings.ts`, `siteSettings.ts`, `careersSettings.ts`, `deploy/README-deploy.md`
- `server/test/helpers.ts` and one existing route test, to match test style

## Decided design (no open choices)

For each item **first re-read the cited lines. If the claim is false or already fixed, skip it and say so in the report.** Every fix gets a test that fails without it (no mocks; real Fastify injector and the throwaway SQLite, like the existing suite).

1. **H-8** `loggerService.ts`: replace the three `readFileSync` whole-file reads with a bounded tail read (open the file, read at most the last 1 MiB with `fs.promises` / a byte-range read, drop the first partial line, then take the last N lines). Validate `lines` in `logs.routes.ts` with `z.coerce.number().int().min(1).max(5000)` (default as today). Test: a log file larger than the read window returns the correct last N lines and a bad `lines` value returns 400.
2. **H-9** `logs.routes.ts` client-error endpoint: strip CR/LF from `message` and `stack`-derived text written to the line (replace runs with one space), restrict `source` to `[A-Za-z0-9_-]` and cap its length, cap `message` length, and spread `context` **before** the trusted `url`/`ip`/`userAgent` so it cannot override them. Test: a multi-line message produces exactly one log line; `context.ip` does not override the request IP.
3. **M-2** `cmsService.ts` `updateSectionContent`: compute the next version inside the transaction, and catch `P2002` into a readable 409 in `cms.routes.ts` (no Prisma dump in the response). Test: two concurrent updates yield one 200 and one 409 with a plain message, and versions stay unique.
4. **M-8** hoist the datasource-aware case-insensitive `contains` from `careers.routes.ts:304-309` into one helper (new small file under `server/src/utils/` or the existing util module that fits) and use it in careers, newsletter and developer notes. Test the helper's query shape for a `file:` URL vs a `postgresql://` URL (an HTTP assertion cannot catch this).
5. **M-9** `env.ts` `productionConfigErrors`: in production, `DATABASE_URL` must be set and start with `postgres://` or `postgresql://`. Test it next to the existing production-config tests.
6. **M-10** `deploy/README-deploy.md` migration-safety grep: replace with an anchored pattern (`\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)\b`, `\bTRUNCATE\b`, `\bDELETE\s+FROM\b`) and add one sentence that `ON DELETE …` inside a foreign-key clause is expected. Run the new pattern over all migrations and report that it matches zero lines, and matches a synthetic `DROP TABLE "X";`.
7. **M-14** `cms.schema.ts` partners: `order` and `visible` become `.nullish()` instead of `.default(...)`; `cmsService.ts` create falls back to `nextOrder` / `true` when absent, and update writes only fields actually present. Test: create without `order` gets `max+1`; update without `visible` leaves a hidden partner hidden.
8. **M-20** `mailSettings.ts` and `siteSettings.ts`: wrap `JSON.parse` of the stored row in try/catch and fall back to the defaults (copy the guard style from `careersSettings.ts:92-104`), logging a warning once through the logger. Test: a corrupt row still returns defaults from `GET /api/settings/site`.

9. **H-7** (owner decision 2026-10-25: require super admin for explicit emails) `notifications.routes.ts`: a non-super-admin holding only `manageNotifications` may not create a listener with a non-empty `config.emails` (403 `Only a super admin can send notifications to explicit email addresses`), and may not update a listener so that its `config.emails` set differs from the stored one (compare as sets, case-insensitive); toggling `enabled`, `name`, `toInquiryViewers` and `toApplicationViewers` stays allowed. Super admins are unrestricted. Deleting a listener stays allowed for `manageNotifications`. Log every listener create/update/delete with the actor id and the resulting email list through `loggerService.info` (source `notifications`); never log mail bodies. Tests: non-super-admin POST with emails is 403 and nothing is stored; non-super-admin POST with only `toInquiryViewers` is 201; non-super-admin PUT that changes emails is 403 while a PUT that only renames is 200; super admin does both; no inquiry mail reaches an address a refused request tried to inject.

## Out of scope

Everything else in the review. No schema or migration changes (M-1, M-15, M-19, M-21 wait for the auth lane to merge), no auth routes, no client files, no new dependencies, no refactors beyond the lines you must change.

## Constraints

- No commits, no installs, no `.env*` reads or writes, no production commands.
- Match neighbouring code: naming, comment density, error shape. Preserve CRLF/LF of each file you edit; never rewrite a whole file for line endings.
- Do not edit files under `docs/prompts/` except your report. Update `docs/api-reference.md` only if a response shape or status code you changed is documented there.

## Gates (run all, paste results)

- `npm --prefix server run build`
- `npm --prefix server test` (all green; report the new test count)
- `npm run lint`
- For H-8: with a ~20 MB log file, show the response time of `/api/logs/view` is flat versus `lines` and does not grow with file size (a short script is fine; delete it afterwards).

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-server-hardening-report.md`: files changed, per-item result (fixed / skipped with the reason), gate results, decisions made, and `## Guard results` as required by `docs/TODO.md` section 3.
