# Ajda — project context for Claude (read at every session start)

> **Implementing agents (OpenCode or any agent running a `task-*-prompt.md`): skip the "FIRST ACTION" section below and follow your prompt. The rules under "How we work" about secrets and production still apply to you.**

## FIRST ACTION IN EVERY NEW SESSION (Claude Code, the planner)
Before anything else, read `docs/TODO.md` section 3 ("Open tasks"), check real state (`git status`, `git worktree list`, `ls docs/prompts/`), then give the owner:
1. the open-task list with status and order (update statuses from the real state, not from memory),
2. the single recommended next step.
Do this even if the owner's first message is something else, then continue with their request.

## Project
Real-estate platform "أجدا / Ajda" (ajdaa.sa). Vite + React 19 + Tailwind v4 SPA in `src/`; Fastify + Prisma API in `server/`; PostgreSQL 16 + Redis in production. Admin dashboard is Arabic first; AR/EN translation is in progress (`docs/ADMIN-I18N.md`). 1-5 admin users. Branch `feat/backend-admin` (main branch `main`). Wave 1 and Wave 2 are merged into it.

## How we work (owner rules)
- **Claude plans, reviews, and does "last items" and small tasks (owner rule, 2026-10-25: if a prompt is small, Claude implements it itself, with the same gates, tests and browser pass).** Medium and large tasks still go to OpenCode. All implementation goes to OpenCode: write a self-contained `docs/prompts/task-<x>-prompt.md` (goal, read-first list, decided design with no open choices, out of scope, constraints, gates, "write report to `D:\projects\html\ajda\docs\prompts\task-<x>-report.md`"), print the file name, stop. After review and merge, move the prompt and its report to `docs/prompts/_archive/<wave>/`. No prompt or report files in the repo root or in worktrees (see `docs/prompts/README.md`). The owner runs it in OpenCode and replies with the report name.
- **Review = read the whole diff, re-run every gate yourself, and open the running app for UI work.** Lint/build passing is not proof (the i18n-core raw-key bug passed all gates and was only visible in the browser).
- **Keep worktrees in sync (owner rule, 2026-10-23):** after every finished task and after any commit to `feat/backend-admin`, merge `feat/backend-admin` into every active lane branch (`git merge --ff-only` when the lane has no own commits, otherwise `git merge --no-ff`), resolve conflicts, re-run that lane's gates, commit the merge. Stop a lane's running dev API first: on Windows it locks Prisma's query engine DLL and `prisma generate` / the test suite fail with EPERM.
- Free/Google models only in OpenCode. Keep working between items; run lanes in parallel on disjoint files. Max 3 parallel worktrees.
- No commits without the owner's approval. Commit messages end with the attribution line from the session reminder.
- Every owner request or note is recorded in `refactor.md` TODOs; `README.md` stays clean.
- Consultant tone: objective, no flattery, say when an idea is flawed.
- **Never repeat secret values** from `.env` files (the owner has pasted them in chat before). Use masked commands: `sed -E 's/=.*/=<hidden>/' server/.env`.
- **Deploy policy:** CI deploys the test instance only. Production deploys and every production DB command (migrations, seeds) are run by the owner by hand, after a backup. Prisma has no rollback.

## Worktrees (`D:\projects\html\ajda-wt\`)
- `auth` — branch `lane/auth`, **merged into `feat/backend-admin` on 2026-10-25** (`1f2ace9`: A, A2, B and the review fixes). The worktree and branch can be removed. Passkeys (task C) were deferred and need a new lane. Production needs the three new migrations run by hand after a backup (see `docs/TODO.md` row 6). `w4-postgres-dev` is dropped for now.
- `i18n-core` was merged (`4f33941`) and deleted with its branch on 2026-10-23.
- `i18n-l1` — merged into `feat/backend-admin` (`92cc42e`); worktree and branch can be removed. `small` — merged (`f6e9692`); same. Next lanes after the auth chain: i18n-l2, i18n-l3, i18n-server.
- New worktrees get their own `npm ci` (no junctions to the main repo's `node_modules`), a `server/.env` from `server/.env.example` with their own PORT/APP_URL/CLIENT_ORIGIN, empty `MAIL_*` and `QUEUE_DRIVER=sync` (all local APIs share one Redis; with the default `auto` one lane's worker could run another lane's mail jobs), a `.env.local` with only the `VITE_*` lines, and a seeded SQLite `dev.db`. If Prisma's engine download fails (ECONNRESET), copy `server/node_modules` from a worktree at the same commit with robocopy.
- Dev servers last started 2026-10-23 (they die with the session): auth web :5191 / API :4011, i18n-core web :5192 / API :4012, both on SQLite with seeded data. Start: `npm run dev` (API, in `server/`) and `VITE_API_PROXY_TARGET=http://localhost:<api> npx vite --port <web> --strictPort`. Seeded logins: `admin@ajdaa.sa` (super admin) and `dev@ajdaa.sa`, password `password`.
- `i18n-core/node_modules` points into the main repo's `node_modules`: running `prisma generate` there regenerates the main repo's client.
- `auth/server/.env` holds the owner's real SMTP settings, so emails sent by that dev server are real.

## State at the end of session 2026-10-24
- Reviewed and committed: `w4-public-polish` + `w4-create-dev-user` (`f6e9692`, fixed an RTL layout bug, a typo, a `--reset-password` without `--name` bug and a bogus lockout-clear claim), i18n-core interpolation fix (`d663571`: placeholders were looked up by `{name}` instead of `name`, so every parameterised string showed raw braces), `w3-auth-a2` (`1473338`: fixed the broken login code step, whose props did not match the page handler, and a `PUT /users/:id` block on users who already hold `verifyUsers`), `w4-i18n-l1` (`92cc42e`: fixed module-scope `translateAdmin` calls that returned raw keys and could have stored them as data).
- Review lessons: lint/build/key-existence checks miss runtime registry order and handler-signature mismatches; always run the browser pass (both languages, a wrong-input path per new form). Rule added to `docs/ADMIN-I18N.md`; B and C prompts got the Smoke-environment pitfalls and the A2 lessons.
- Nav: "حجز معاينة" default changed to a normal link (`isCta: false`, committed; the saved CMS data still has the flag until the owner unticks it in Admin → CMS → Navigation).
- Open prompts (all in `docs/prompts/`): `task-w3-auth-b-prompt.md` (next, in `ajda-wt/auth`), `-c-`, `task-w4-i18n-l2/l3/server`, `task-w4-postgres-dev`, `task-w2-monitoring` (blocked on the owner's `MONITOR_ALLOWED_IPS` and `MONITOR_EXTERNAL_UNTIL`), `code-quality-review-prompt.md` (baseline can run any time). The A2 prompt and report stay in `docs/prompts/` until `lane/auth` is merged.
- Still open and unwritten: owner notes 6/7 (full admin review, missing features), SEO, note 8 (production readiness), the w4-i18n-auth prompt (login/verify/accept-invite pages and the new verify-code step).

## Database facts
- Dev and tests currently use SQLite (`server/prisma/schema.prisma`), production uses PostgreSQL via a generated gitignored copy (`npm run db:gen:prod`, `db:migrate` = `prisma migrate deploy`). Committed migrations are PostgreSQL SQL, written by hand; `db:push` never creates a migration.
- Decision made: move dev and tests to PostgreSQL with one schema, `prisma migrate dev`, tests in a throwaway schema per run (`task-w4-postgres-dev-prompt.md`). Run it after the auth chain is merged so its drift check covers the auth migrations.
- Local PostgreSQL 18 is installed natively; `docker-compose.dev.yml` has a PostgreSQL 16 dev service (Docker Desktop daemon is often off).

## Key docs
`docs/TODO.md` (task list, source of truth for order), `docs/MASTER-PLAN.md`, `refactor.md` (owner notes 1-8 and later requests), `salah-tasks.md` (owner's own actions: production secrets, test instance, first production deploy), `docs/ADMIN-I18N.md`, `deploy/README-deploy.md`, `docs/github-actions-deploy.md`.

## Production facts
Production `/srv/ajda/app` (ajdaa.sa, systemd unit `ajda-api`, port 4000, Caddy in front). Test instance `ajda.weghetk.com`. Deploys at midnight, a few seconds of downtime is fine. A production backup from 2026-10-21 is in `D:\backups\ajda-2026-10-21`.
