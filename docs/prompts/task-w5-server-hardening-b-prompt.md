# Task w5-server-hardening-b — tests for the hardening fixes, plus H-7

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). Server only. Same file restrictions as `task-w5-server-hardening-prompt.md`: do **not** touch `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/src/routes/auth.routes.ts`, `server/src/middleware/auth.ts`, `server/src/sockets/`, `securitySettings.ts`, `otpService.ts`, `mailTemplates.ts`, and do not touch `ajda-wt/auth` or any file under `src/`.

## Why this task exists

Claude reviewed the first run (`task-w5-server-hardening-report.md`). The source changes for H-8, H-9, M-2, M-8, M-9, M-10, M-14, M-20 are in the working tree and were corrected by Claude in review (a `split('\\n')` typo that broke the log tail was fixed; the case-insensitive helper was reduced to one typed function and the re-export shims were deleted). What is **missing**:

1. The original prompt required a test per item that fails without the fix. The report claimed tests, but the diff contains only edits to `env-config.test.ts` and `request-log.test.ts`. The other items were checked with throwaway scripts that are gone.
2. Item 9 (H-7) was added to the original prompt after you started, and was not done.

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply), `docs/prompts/task-w5-server-hardening-prompt.md` (the nine items, decided designs), `docs/prompts/review-ajda-project.md` (H-7, H-8, H-9, M-2, M-8, M-9, M-14, M-20)
- the current source diff: `git diff server/` and `server/src/utils/caseInsensitive.ts`
- `server/test/helpers.ts`, `server/test/security.test.ts`, `server/test/user-phone.test.ts` (style to copy)

## Do

1. **Write one test (or a small group) per item, no mocks, real Fastify injector and the throwaway SQLite, and prove each fails without its fix** (temporarily revert that fix, run only that test, restore; list the failing assertion in the report). Items:
   - **H-8** the tail read: a log file larger than 1 MiB returns exactly the last N lines as separate lines (this catches a wrong line separator), the first partial line is dropped, `lines=0`, `lines=5001` and `lines=abc` return 400 on `/api/logs/raw` and `/api/logs/errors`. Use a temp log path the way `request-log.test.ts` does; do not touch a real log file.
   - **H-9** a multi-line `message` produces exactly one line in the log; a hostile `source` is reduced to the safe token set; `context: { ip, userAgent, url }` cannot override the trusted values.
   - **M-2** two concurrent `PUT /api/cms/content/:key` calls: one 200 and one 409 with a plain message, or both 200 with consecutive versions. Never a 400 containing a Prisma dump, never a duplicate version. State which outcome the code produces and why.
   - **M-8** `caseInsensitiveContains('file:./x.db', 'a')` has no `mode`; with a `postgresql://` URL it has `mode: 'insensitive'`.
   - **M-9** `productionConfigErrors` rejects a missing and a `file:` `DATABASE_URL` in production and accepts `postgresql://` and `postgres://` (extend `env-config.test.ts`).
   - **M-14** partner create without `order` gets `max + 1`; update without `visible` leaves a hidden partner hidden.
   - **M-20** a corrupt stored `site` row and a corrupt `mail` row still return defaults (`GET /api/settings/site`, and the mail settings getter).
2. **H-7** (decided design in item 9 of the original prompt): implement it in `server/src/routes/notifications.routes.ts` (and `notificationListeners.ts` only if needed), with tests for every case listed there.
3. **H-8 timing gate**: with no dev API running, run a short script that writes a ~20 MB log file to a temp path and measures `getRawFileContent(500)`; report that time is flat versus file size. Delete the script afterwards.

## Out of scope and rules

- No change to the nine source fixes except bugs your tests expose; if a test exposes one, fix it minimally and say so in the report.
- Do not add re-export shims, alternative import names, or code written to guess what a hidden test expects. If you believe a test needs a different import path, say so in the report instead.
- No commits, no installs, no `.env*` reads or writes, no production commands. Match neighbouring code and preserve each file's line endings.
- Report everything honestly: anything not run is "not verified", not "verified by implementation".

## Gates (paste real output)

- `npm --prefix server run build`, `npm --prefix server test` (all green; report the new total, currently 300 tests / 36 files), `npm run lint`

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-server-hardening-b-report.md`: files changed, per-item test names and the failing assertion without the fix, gates, the timing result, decisions, and `## Guard results` as required by `docs/TODO.md` section 3.
