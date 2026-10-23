# Task review0 — Phase 0 Discovery (read-only, documents only)

## Goal
Execute **PHASE 0: DISCOVERY** of the master review brief in `r.txt` and produce `review/00-project-map.md`. Then STOP. Do not start Phase 1.

## Read first
- `r.txt` (the full brief; follow GROUND RULES 1-7 and the Phase 0 section exactly)
- `README.md`, `docs/*.md` (architecture, api-reference, cms-architecture, deployment, testing-strategy, gap-analysis, TODO, CHANGELOG), `md/*.md`
- `package.json`, `server/package.json`, `vite.config.ts`, `docker-compose.dev.yml`, `server/prisma/` (schema + migrations + seed), `server/src/` (app.ts, server.ts, routes, services, jobs, middleware, sockets, config), `src/` (routes, pages, components), `server/test`, `test`, `deploy/`

## Required content of review/00-project-map.md
1. Stack and versions (frontend, backend, DB, tooling)
2. Architecture overview and folder structure; entry points
3. Module list (server routes/services/jobs/sockets; frontend features)
4. Screen/route list: public site AND admin dashboard (every route, with file path)
5. Data model summary: every Prisma model, key fields, relations
6. Roles and permissions as found in code (permission catalogue)
7. Integrations, env/config variables (names only, never values), build, deploy, backup
8. How to run / build / test (exact commands). Actually run lint, typecheck, build, and test commands; paste the real result summary (pass/fail counts, errors). Label each "verified by running" or "verified by reading code only".
9. Coverage checklist (tables of routes, endpoints, models, jobs, screens) with all items ticked as discovered
10. "Could not determine" list (questions for the owner; mark all unconfirmed items as ASSUMPTION)

## Decided design
- Output only into `review/` (create it). One file: `review/00-project-map.md`.
- Evidence rule: every statement about behavior cites file path (and function/line).
- Be concise: tables and bullet lists, no prose padding.

## Out of scope
Phases 1-7, any fixing or refactoring, any code change.

## Constraints
- Do NOT modify any file outside `review/`. No commits, no installs (`npm ci`/`npm install` forbidden; if node_modules are missing, say so and use static analysis).
- Do not read or print `.env*`, `*.sql`, `*.backup` files (they contain secrets/data).
- Do not touch `deploy/`, `r.txt`, `task-*.md`.
- Use a free model only.

## Gates
- `review/00-project-map.md` exists and covers all 10 sections above.
- `git status` shows changes only under `review/` plus the pre-existing ones.

## Report
Write `task-review0-report.md`: files created, commands run with results, decisions made, open questions.
