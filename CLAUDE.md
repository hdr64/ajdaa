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
- **Claude plans, reviews, and does only "last items"**. All implementation goes to OpenCode: write a self-contained `docs/prompts/task-<x>-prompt.md` (goal, read-first list, decided design with no open choices, out of scope, constraints, gates, "write report to `D:\projects\html\ajda\docs\prompts\task-<x>-report.md`"), print the file name, stop. After review and merge, move the prompt and its report to `docs/prompts/_archive/<wave>/`. No prompt or report files in the repo root or in worktrees (see `docs/prompts/README.md`). The owner runs it in OpenCode and replies with the report name.
- **Review = read the whole diff, re-run every gate yourself, and open the running app for UI work.** Lint/build passing is not proof (the i18n-core raw-key bug passed all gates and was only visible in the browser).
- Free/Google models only in OpenCode. Keep working between items; run lanes in parallel on disjoint files. Max 3 parallel worktrees.
- No commits without the owner's approval. Commit messages end with the attribution line from the session reminder.
- Every owner request or note is recorded in `refactor.md` TODOs; `README.md` stays clean.
- Consultant tone: objective, no flattery, say when an idea is flawed.
- **Never repeat secret values** from `.env` files (the owner has pasted them in chat before). Use masked commands: `sed -E 's/=.*/=<hidden>/' server/.env`.
- **Deploy policy:** CI deploys the test instance only. Production deploys and every production DB command (migrations, seeds) are run by the owner by hand, after a backup. Prisma has no rollback.

## Worktrees (`D:\projects\html\ajda-wt\`)
- `auth` — branch `lane/auth`. Task A (email verification) is done and uncommitted; the A2, B, C prompts are in `docs/prompts/` of the main repo.
- `i18n-core` — branch `lane/i18n-core`. Core of the admin translation system, done and uncommitted. Other lanes (l1/l2/l3/server) start only after it is merged.
- Dev servers last started 2026-10-23 (they die with the session): auth web :5191 / API :4011, i18n-core web :5192 / API :4012, both on SQLite with seeded data. Start: `npm run dev` (API, in `server/`) and `VITE_API_PROXY_TARGET=http://localhost:<api> npx vite --port <web> --strictPort`. Seeded logins: `admin@ajdaa.sa` (super admin) and `dev@ajdaa.sa`, password `password`.
- `i18n-core/node_modules` points into the main repo's `node_modules`: running `prisma generate` there regenerates the main repo's client.
- `auth/server/.env` holds the owner's real SMTP settings, so emails sent by that dev server are real.

## State at the end of session 2026-10-23
- Reviewed `w3-login-eye` (committed), `w3-auth-a` (I fixed a bypass: `PUT /users/:id` now refuses `status: active` for any account with `emailVerifiedAt === null`; 287 server tests pass), `w4-i18n-core`.
- i18n-core bug found by the owner in the browser: keys showed raw (`layout.nav.users`) because `./index` was only imported as a type. Fixed with a side-effect `import './index'` in `src/i18n/admin/useAdminT.ts`. **Not yet re-verified in the browser**: first thing to ask the owner.
- Nav: "حجز معاينة" default changed to a normal link (`isCta: false` in `src/types/cms.ts` and `server/src/config/defaultCmsContent.ts`, uncommitted). The saved CMS data still has the flag on until the owner unticks it in Admin → CMS → Navigation.
- Uncommitted in the main repo: `deploy/README-deploy.md`, `salah-tasks.md`, `deploy/mkuser.sh`, `docs/ADMIN-I18N.md`, `docs/github-actions-deploy.md`, all `task-w4-*-prompt.md`, `docs/TODO.md`, `refactor.md`, `CLAUDE.md`, the nav default change.
- Prompts written but not run (all in `docs/prompts/`): `task-w3-auth-a2-prompt.md` (email verification code, new permission `verifyUsers`, "send password in email" checkbox; in `ajda-wt/auth`), `task-w3-auth-b-prompt.md`, `task-w3-auth-c-prompt.md` (re-checked against A on 2026-10-23), the `task-w4-*` prompts, `task-w4-postgres-dev-prompt.md`, `task-w2-monitoring-prompt.md` (blocked on the owner's `MONITOR_ALLOWED_IPS` and `MONITOR_EXTERNAL_UNTIL`).
- 2026-10-23 prompt review: every unrun prompt now ends with a mandatory "Quality guards" section (`clean-code-guard`, `test-guard`, `docs-guard`, files under `C:/Users/salah/.claude/skills/`) and requires a `## Guard results` report section; send back any report without it. Auth A2/B/C prompts got a "Smoke environment" section (scratch `.env` + DB in `%TEMP%`, ports 4015/5185) because the old B/C text told the agent to delete `server/.env` and `dev.db`.
- Still open and unwritten: owner notes 6/7 (full admin review, missing features), SEO, note 8 (production readiness), the w4-i18n-auth prompt (login/verify/accept-invite pages).

## Database facts
- Dev and tests currently use SQLite (`server/prisma/schema.prisma`), production uses PostgreSQL via a generated gitignored copy (`npm run db:gen:prod`, `db:migrate` = `prisma migrate deploy`). Committed migrations are PostgreSQL SQL, written by hand; `db:push` never creates a migration.
- Decision made: move dev and tests to PostgreSQL with one schema, `prisma migrate dev`, tests in a throwaway schema per run (`task-w4-postgres-dev-prompt.md`). Run it after the auth chain is merged so its drift check covers the auth migrations.
- Local PostgreSQL 18 is installed natively; `docker-compose.dev.yml` has a PostgreSQL 16 dev service (Docker Desktop daemon is often off).

## Key docs
`docs/TODO.md` (task list, source of truth for order), `docs/MASTER-PLAN.md`, `refactor.md` (owner notes 1-8 and later requests), `salah-tasks.md` (owner's own actions: production secrets, test instance, first production deploy), `docs/ADMIN-I18N.md`, `deploy/README-deploy.md`, `docs/github-actions-deploy.md`.

## Production facts
Production `/srv/ajda/app` (ajdaa.sa, systemd unit `ajda-api`, port 4000, Caddy in front). Test instance `ajda.weghetk.com`. Deploys at midnight, a few seconds of downtime is fine. A production backup from 2026-10-21 is in `D:\backups\ajda-2026-10-21`.
