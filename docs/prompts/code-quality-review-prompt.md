# Reusable task — full code-quality review of the Ajda project

Run this any time, and always after a major update (a merged lane, a new feature area, before a production deploy). It is a **read-only review**: you find, verify and report problems; you do not fix them. The owner turns the findings into fix tasks.

## Output
- Write the report to `code-quality-review.md` in the repository root (the latest review always lives there).
- If `code-quality-review.md` already exists, first move it to `docs/reviews/code-quality-review-<its review date YYYY-MM-DD>-<its short commit>.md` (create the folder if needed), then write the new one. Read the old report before you start: the new report must say, for every old finding, whether it is **fixed**, **still open** or **no longer applicable**, keeping the old finding ID.

## Where and what
- Repository: the folder you were started in (normally `D:\projects\html\ajda`, branch `feat/backend-admin`; a worktree under `D:\projects\html\ajda-wt\` is also fine). Review the **committed state plus any uncommitted changes**, and record which in the report header.
- Stack: Vite + React 19 + Tailwind v4 SPA (`src/`), Fastify + Prisma API (`server/`), SQLite in dev and tests, PostgreSQL 16 + Redis in production, Caddy in front, systemd unit `ajda-api`. Admin dashboard Arabic first with an AR/EN i18n system (`src/i18n/admin/`, `docs/ADMIN-I18N.md`). Public site AR/EN (`src/i18n/translations.ts`).
- Read first: `CLAUDE.md` (project rules; skip its "FIRST ACTION" section), `README.md`, `docs/architecture.md`, `docs/MASTER-PLAN.md`, `docs/TODO.md`, `docs/api-reference.md`, `docs/testing-strategy.md`, `refactor.md`, `deploy/README-deploy.md`, `server/prisma/schema.prisma`, `server/src/app.ts`, `server/src/config/env.ts`, `server/src/middleware/*`, then the areas below.

## Mandatory skills
Load each by name with your skill tool; if it is not offered, read the file directly.
- **`clean-code-guard`** in **review mode** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`; walk `references/review-checklist.md`, read `references/ai-failure-modes.md` first).
- **`test-guard`** for the test suite (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, `references/jest.md` for Vitest).
- **`docs-guard`** in **review mode** for the docs (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`).
- If available, also use `deep-bug-hunter`, `adversarial-verification` and `honest-reporting` (`C:\Users\salah\.config\opencode\skills\`), or the equivalent security/code-review skills of your runtime. Name every skill you actually used in the report header.

## Review areas (cover all; say what you sampled when a full read is impossible)
1. **Security** (highest priority; read every file under `server/src/routes`, `server/src/middleware`, `server/src/services` that touches auth, users, uploads, careers, logs, settings, mail):
   authentication (login, email OTP, password reset and change, email verification, invites, 2FA/passkeys if present), JWT issue and revocation (`passwordChangedAt`, status checks), authorisation on every route (`requirePermission`, super-admin-only paths, self-escalation, acting on a super admin), lockouts and rate limits, user enumeration and response oracles, input validation (Zod on every body/query/param), file uploads (type and size checks, path traversal, CVs kept out of the public `UPLOAD_DIR`), stored XSS through CMS content and `dangerouslySetInnerHTML`, raw SQL (`$queryRaw`, `$executeRawUnsafe`), secrets handling (env validation, `secretBox`, nothing secret in logs, mails, queue payloads, API responses or the client bundle), CORS, trust-proxy, security headers, CSRF exposure, cookies/storage of tokens in the client, logging of PII, dependency vulnerabilities (`npm audit --omit=dev` in the root and in `server/`; report only, never `audit fix`).
2. **Bugs and correctness**: logic errors, unhandled promise rejections, race conditions (double submit, token or code double spend, concurrent edits), wrong status codes, inconsistent response shapes, timezone and date handling, SQLite-vs-PostgreSQL differences (case sensitivity, JSON, `mode: 'insensitive'`), Prisma schema vs `server/prisma/migrations/` drift (compare by reading; list every model/column the schema has that no migration creates, and the reverse), React bugs (stale closures, effect dependencies, keys, state after unmount, uncontrolled/controlled switches).
3. **Clean code** (clean-code-guard checklist): duplication of knowledge, oversized functions and files (list the largest route handlers and components with line counts), dead code, leftover TODO/console.log, naming, comments that lie, layering (routes doing service work), type safety (`any`, unchecked casts, non-null assertions).
4. **UI / UX** (browser required; see "Running the app"): every public page and every admin section in Arabic and English, RTL/LTR, desktop and 390 px width; layout breaks, overflow, truncation, raw translation keys (`area.some.key` text on screen), console errors and warnings (`[admin i18n] missing key`), loading/empty/error states, toasts (right kind, one per action), confirm dialogs for destructive actions, form validation messages localised, keyboard access and focus rings, focus traps in dialogs, colour contrast of text on the brand colours, images without `alt`, buttons without accessible names.
5. **Performance**: bundle size (read the `vite build` output; chunks over 500 kB and what is in them), lazy-loading of admin routes, N+1 Prisma queries, missing indexes for the filters the routes use, unbounded list endpoints (no pagination or `take`), large synchronous file reads, cache headers on `/uploads`.
6. **Tests** (test-guard): what the suite covers per route file, critical paths with no test (list them), flaky tests, tests asserting implementation details, duplicated tests that should be data-driven.
7. **Ops and deploy**: `deploy/remote-deploy.sh`, `reload.sh`, `.github/workflows/deploy.yml`, `server/scripts/backup_db.sh`, the systemd/Caddy files under `deploy/`: safety guards, migration handling, secrets in CI, backup coverage (DB, uploads, private CVs), log rotation, health check.
8. **Docs** (docs-guard): README, `docs/*.md` (not `docs/archive/`), `.env.example` files: every command, script name, env var and path checked against the code; stale statements listed.
9. **i18n completeness**: Arabic literals left in admin components outside `src/i18n/admin/` (`LC_ALL=C.UTF-8 grep -rnP "[\x{0600}-\x{06FF}]" src/components/admin src/pages/admin`), missing English keys, server messages in one language only.

## Verify before you report
Every finding must be **verified**, not guessed: re-read the code path end to end, and where cheap, prove it (a failing request with `curl` against your own smoke server, a test you run in a scratch copy, a browser screenshot description). Try to refute each Critical and High finding before keeping it. Mark each finding `Confirmed` (reproduced or proven by reading the full path) or `Plausible` (strong evidence, not reproduced) and never report anything weaker. If you are not sure, leave it out and list it under "Questions for the owner".

## Running the app (for the UI and the proofs)
Never touch the owner's `server/.env`, `server/prisma/dev.db` or the owner's running servers (ports 4000, 4011, 4012, 5173, 5191, 5192).
1. Make a scratch folder outside the repo (`$env:TEMP\ajda-review-<date>`), write a `.env` there from `server/.env.example` with `PORT=4016`, `HOST=127.0.0.1`, `APP_URL=http://localhost:5194`, `CLIENT_ORIGIN=http://localhost:5194`, `DATABASE_URL="file:<scratch folder, forward slashes>/review.db"`, `UPLOAD_DIR=./uploads`, all `MAIL_*` keys empty.
2. From `server/`, with only `DATABASE_URL` overridden in the shell: `npx prisma db push --skip-generate`, then `npm run db:seed`.
3. Start the API with the scratch folder as working directory: `node <repo>\server\node_modules\tsx\dist\cli.mjs <repo>\server\src\server.ts`; check `http://localhost:4016/api/health`.
4. Start the web app from the repo root with `VITE_API_PROXY_TARGET=http://localhost:4016` and `npx vite --port 5194 --strictPort`. Sign in with `admin@ajdaa.sa` / `password`; also create a low-permission user (for example a `viewer` role) to check what it can and cannot see and call.
5. When finished stop both servers and delete the scratch folder. If PostgreSQL is the dev database by the time you run this (check `schema.prisma`'s provider and `README.md`), follow the README instead and use a throwaway database or schema; never the developer's.
If no browser is available, do the UI area by reading the components, and say clearly in the report that the UI was not seen.

## Gates to run and record (results go in the report header table)
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test` (pass/fail counts and duration; name any failing or flaky test), `npm audit --omit=dev` in the root and in `server/` (counts per severity).

## Constraints
- Read-only on the code: no edits outside `code-quality-review.md`, `docs/reviews/` and the scratch folder. No commits, no installs, no `npm audit fix`, no git operations that change state, no production or test-server access, no real emails.
- Never print secret values (env files, tokens, hashes) in the report; refer to them by name.
- Do not report style nits that the linter or formatter owns, and do not pad the report: a short report with verified findings beats a long one with guesses.

## Report format (`code-quality-review.md`)
Start with this header, all fields filled (write `unknown` only when a value truly cannot be obtained, and say why):

```
# Code-quality review — Ajda

| Field | Value |
|---|---|
| Review date/time | 2026-10-23 21:40 +03:00 (ISO 8601 with offset; from `date`/`Get-Date`, not guessed) |
| Reviewer | agent and model, exactly as your runtime reports them, e.g. `claude claude-opus-5-5` or `opencode <provider>/<model>` |
| Skills used | clean-code-guard (review), test-guard, docs-guard, ... |
| Repository / branch | path, branch |
| Commit | full SHA, short SHA, subject, commit date (`git log -1 --format=...`) |
| Working tree | clean, or the list of uncommitted files reviewed |
| Previous review | path of the archived report and its commit, or "none" |
| Scope | areas covered fully / sampled / not covered |
| Size | files and lines of code in `src/` and `server/src` (one command, state which), number of routes, number of tests |
| Gates | lint, build, server build, tests (pass/fail/skipped, duration), audit (critical/high/moderate/low, root and server) |
| Duration | how long the review took |
```

Then:
1. **Summary**: overall verdict in 3-5 sentences (is it safe to deploy to production as is?), the counts table by severity × area, and the top 5 fixes in priority order.
2. **Changes since the previous review**: fixed / still open / no longer applicable / new, by ID.
3. **Findings**, grouped by area, most severe first. Severity scale: **Critical** (exploitable or data loss now), **High** (likely bug or security gap with real impact), **Medium** (correctness or maintainability risk), **Low** (polish). Each finding:
   - `ID` stable and unique: `CQR-<AREA>-<NNN>` with AREA in `SEC`, `BUG`, `CODE`, `UI`, `PERF`, `TEST`, `OPS`, `DOCS`, `I18N`, `DEP`. Reuse the old ID for a finding carried over from the previous review; never reuse an ID for something else.
   - Title; Severity; Status `Confirmed`/`Plausible`; Location `path:line` (several if needed); Evidence (a short code excerpt or the exact reproduction: request, response, steps, what the screen shows); Impact (who is affected and how); Fix (concrete, smallest safe change); Effort (S/M/L).
4. **Coverage**: what was read fully, what was sampled and how, what was not covered and why.
5. **Questions for the owner**: unclear intent or unverified suspicions.
6. **Suggested fix tasks**: findings grouped into task-sized batches (each batch on disjoint files so they can run in parallel), in the order you recommend.

Finish by printing the report path and the counts by severity.
