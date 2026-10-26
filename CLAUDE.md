# Ajda — project context for Claude (read at every session start)

> **Implementing agents (OpenCode or any agent running a `task-*-prompt.md`): skip the "FIRST ACTION" section below and follow your prompt. The rules under "How we work" about secrets and production still apply to you.**

## FIRST ACTION IN EVERY NEW SESSION (Claude Code, the planner)
Before anything else, read `docs/TODO.md` section 2 ("Open tasks"), check real state (`git status`, `git branch -vv`, `git worktree list`, `ls docs/prompts/`), then give the owner:
1. the open-task list with status and order (update statuses from the real state, not from memory),
2. the single recommended next step.
Do this even if the owner's first message is something else, then continue with their request.

## Project
Real-estate platform "أجدا / Ajda" (ajdaa.sa). Vite + React 19 + Tailwind v4 SPA in `src/`; Fastify + Prisma API in `server/`; PostgreSQL 16 + Redis in production. Admin dashboard is Arabic first with an English translation (`docs/ADMIN-I18N.md`). 1-5 admin users. **All work is on `main`** (the old `feat/backend-admin` branch and the `lane/*` worktrees are merged; no worktree is active unless TODO.md says so). The owner sometimes commits directly with short messages; check `git log` before assuming something is not done.

## How we work (owner rules)
- **Claude plans, reviews, and does "last items" and small tasks (owner rule, 2026-10-25: if a prompt is small, Claude implements it itself, with the same gates, tests and browser pass).** Medium and large tasks go to OpenCode: write a self-contained `docs/prompts/task-<x>-prompt.md` (goal, read-first list, decided design with no open choices, out of scope, constraints, gates, "write report to `D:\projects\html\ajda\docs\prompts\task-<x>-report.md`"), print the file name, stop. After review and merge, move the prompt and its report to `docs/prompts/_archive/<wave>/` (`w<N>`). No prompt or report files in the repo root or in worktrees (see `docs/prompts/README.md`). The owner runs it in OpenCode and replies with the report name.
- **Review = read the whole diff, re-run every gate yourself, and open the running app for UI work.** Lint/build passing is not proof (the i18n-core raw-key bug passed all gates and was only visible in the browser). Check both languages and one wrong-input path per new form.
- **Gates**: `npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test` (44 files, 428 tests on 2026-10-26).
- **Worktrees (when lanes are used):** at most 3 parallel, under `D:\projects\html\ajda-wt\`, lanes on disjoint files. After every finished task and every commit to the main branch, merge it into every active lane (`--ff-only` when the lane has no own commits, else `--no-ff`), resolve conflicts, re-run that lane's gates. Stop a lane's running dev API first: on Windows it locks Prisma's query engine DLL and `prisma generate` / the test suite fail with EPERM. A new worktree needs its own `npm ci`, a `server/.env` from `server/.env.example` with its own PORT/APP_URL/CLIENT_ORIGIN, empty `MAIL_*`, `QUEUE_DRIVER=sync` (all local APIs share one Redis), a `.env.local` with only `VITE_*` lines and a seeded SQLite `dev.db`.
- Free/Google models only in OpenCode. Keep working between items.
- No commits without the owner's approval. Commit messages end with the attribution line from the session reminder.
- Every owner request or note is recorded in `refactor.md`; `README.md` stays clean (setup and commands only).
- **Docs rules** (`docs/README.md`): one home per fact, link instead of copying; update `api-reference.md`, `architecture.md` and the changelog in the same change as routes, permissions, env variables or schema; never write secret values or default secrets into docs.
- Consultant tone: objective, no flattery, say when an idea is flawed.
- **Never repeat secret values** from `.env` files (the owner has pasted them in chat before). Use masked commands: `sed -E 's/=.*/=<hidden>/' server/.env`.
- **Deploy policy:** CI deploys the test instance only (push to `deploy-test`, `npm run deploy:test`). Production deploys (`reload.sh` on the server, `npm run deploy:prod` from the owner's PC) and every production DB command (migrations, seeds) are run by the owner by hand, after a backup. Prisma has no rollback.

## Database facts
- Dev and tests use SQLite (`server/prisma/schema.prisma`), production uses PostgreSQL via a generated gitignored copy (`npm run db:gen:prod`, `db:migrate` = `prisma migrate deploy`). Committed migrations are PostgreSQL SQL, written by hand; `db:push` never creates a migration, so every schema change needs one.
- Moving dev and tests to PostgreSQL (`task-w4-postgres-dev-prompt.md`) is parked; revisit before the first production deploy.
- Local PostgreSQL 18 is installed natively; `docker-compose.dev.yml` has a PostgreSQL 16 dev service (Docker Desktop is often off).
- Seeded dev logins: `admin@ajdaa.sa` (super admin) and `dev@ajdaa.sa`, password `password`.

## Key docs
`docs/TODO.md` (open tasks, order), `docs/README.md` (index and docs rules), `docs/architecture.md`, `docs/api-reference.md` (route index), `docs/ADMIN-I18N.md`, `docs/admin-audit.md` (admin backlog), `docs/reviews/` (review reports), `deploy/README-deploy.md`, `docs/github-actions-deploy.md`, `refactor.md` (owner requests 1-8 and later), `salah-tasks.md` (owner's own actions: production secrets, test instance, first production deploy).

## Production facts
Production `/srv/ajda/app` (ajdaa.sa, systemd unit `ajda-api`, port 4000, Caddy in front). Test instance `ajda.weghetk.com` (`/srv/ajda/test`, unit `ajda-api-test`, port 4001, DB `ajda_test`). Deploys at midnight, a few seconds of downtime is fine. Per `salah-tasks.md` the first production deploy of the October 2026 work is still pending (six migrations, listed in `docs/TODO.md` section 4); confirm with the owner before assuming either way. A production backup from 2026-10-21 is in `D:\backups\ajda-2026-10-21`.
