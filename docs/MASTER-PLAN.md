# Master plan (draft v1, 2026-10-21)

Roles: Claude plans, reviews and merges. OpenCode (free model) implements. Max 3 implementers at once, each in its own git worktree and branch under `D:\projects\html\ajda-wt\<lane>`. Lanes in the same wave touch disjoint files. The main repo stays clean: it only receives reviewed merges. Every task is a `task-<id>-prompt.md` with a report file; Claude re-runs all gates before merging.

Worktree setup per lane (Claude runs once): `git worktree add ..\ajda-wt\<lane> -b lane/<lane> feat/backend-admin`, then `npm ci` in root and `server`, copy nothing secret.

Gates for every task: `npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test`, plus tests added by the task.

## Wave 1 (parallel): foundation, security, delivery
| Lane | Task | Files (owner of) |
|---|---|---|
| schema | One Prisma migration for everything new: `Project.model3dUrl`; `OldProject` (title/titleEn, category, image, gallery JSON, description/En, sortOrder, published); `JobApplication` (name, phone, email, message, cvPath, status, createdAt); settings keys for job-form required flags and notification emails. Dev SQLite + prod Postgres paths. Seeds, no UI. | `server/prisma/**` |
| sec0 | Security criticals from the audit: remove default log/dev-notes secrets (required in prod), DB-checked guard for logs and dev-notes, auth on `POST /developer-notes` and ignore body email, socket emit to admin room only, no default passwords (create user, seed), password policy on admin-set passwords, strip query strings from request log, `HOST` env default `127.0.0.1`, `TRUST_PROXY` default false, mail errors thrown to the queue, Helmet. Tests for each. | `server/src/{app,server}.ts`, `config/env.ts`, `routes/{logs,developerNotes,auth}.routes.ts`, `services/{mailService,queueService}.ts`, seed |
| deploy | `task-deploy-prompt.md` (test instance, workflow, remote script, units). Remove its `HOST` item (moved to sec0). | `deploy/**`, `.github/**`, `docs/`, `.gitignore` |

Merge order: schema, sec0, deploy.

## Wave 2 (parallel): your notes 1-5
| Lane | Task | Notes |
|---|---|---|
| projects | Admin edit form gets every missing field (price, priceLabel, priceTypeEn, publishStatus, rooms, bathrooms, unitsCount/En, locationHighlights Ar/En, typeEn). 3D model URL field (admin) and viewer button/embed (public project page). Brochure PDF: public button on project page and card, shown only when `brochureUrl` is set, fix create-time upload path. | 2, 3, 4, PDF bug |
| old-projects | Server CRUD for `OldProject` + permission; admin section (list, create/edit, image + gallery upload); public page replacing the hard-coded works data; nav link. | 1 |
| careers | Public form (footer link + page), validation driven by admin config, CV PDF upload to a **private** directory (not under public `/uploads`), rate limit + honeypot, admin applications page (list, view, status, authenticated CV download), email to configured recipients via queue, admin settings panel for required fields and recipients. | 5, 5.1, 5.2 |

Merge order: projects, old-projects, careers (conflicts only in nav/admin route lists, resolved by Claude).

## Wave 2b: monitoring (right after sec0 merges)
| Lane | Task |
|---|---|
| monitoring | `/api/monitor/*` (status, logs, errors) for test and prod. External bearer-token access auto-expires (`MONITOR_EXTERNAL_UNTIL` = go-live + 30 days) and can be turned off; dashboard access for super admins stays permanent. Log rotation, exception handlers, redaction, admin "Server monitor" page. See `task-w2-monitoring-prompt.md`. |

## Wave 3: remove hard-coded data, tests, review fixes
- remove `src/data/properties.ts` and its imports; everything from the API with loading/empty/error states
- tests for gaps from the audit (logs, dev-notes, CMS, inquiries delete, lockout)
- from the full review (note 6): admin UI and domain gaps, ordered by value; missing features (note 7)

## Wave 4: production readiness (note 8) and SEO
- ErrorBoundary, link-scheme allow-list, server-verified admin session, token revocation, login lockout by email+IP, DB indexes, public project pagination, upload limits and pixel cap, log rotation, backup of uploads, `.env` and secrets hygiene, runbook
- SEO as its own project: prerender or SSG, meta/OG, sitemap, robots, JSON-LD
- Admin English translation (after Arabic is stable)

## Not doing
Rewriting the router, switching UI libraries, moving to cookies for auth before the session work, large refactors that block notes 1-5.
