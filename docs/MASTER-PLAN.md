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
| monitoring | `/api/monitor/*` (status, logs, errors) for test and prod. External bearer-token access auto-expires (`MONITOR_EXTERNAL_UNTIL` = go-live + 30 days) and can be turned off; dashboard access for super admins stays permanent. Log rotation, exception handlers, redaction, admin "Server monitor" page. See `docs/prompts/task-w2-monitoring-prompt.md`. |

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

## Known open issues (recorded 2026-10-25, do not lose)
Source of detail: `docs/prompts/review-ajda-project.md` (IDs below). Fixed on 2026-10-25 in `lane/auth` (`05e8cd0`): H-1 to H-6. Everything else is open. Remove a line only when it is fixed and verified.

**Prompt written, not yet run** (`docs/prompts/task-w5-client-fixes-prompt.md`): C-1 dead "Register Interest" CTA (critical, live site), H-10 phone dropped on user create/edit, M-3 filtered reorder swaps the wrong pair, M-4 contact subjects lose AR/EN pairing, M-25 client password rule 8 vs server 10, M-26 re-clicking the selected role wipes permissions, M-28 home map loses the project, M-29 sub-2s submit silently drops leads.

**Owner decision needed:** H-7 `manageNotifications` can route every lead (PII) to any address; decide intended or require super admin for explicit `config.emails`.

**Server, no prompt yet (write a w5-server prompt after `lane/auth` merges):**
- High: H-8 log views `readFileSync` the whole file per poll; H-9 public `/logs/client-error` forges log lines and lets `context` override ip/userAgent.
- Medium: M-1 mojibake Arabic defaults in the init migration (needs a new migration + drift gate); M-2 CMS version race; M-5 password re-check on `/me/*` has no rate limit; M-6 `PATCH /me` changes email without re-verification; M-7 lockout and security cache are per process; M-8 case-sensitive search on PostgreSQL (newsletter, developer notes); M-9 `DATABASE_URL` not a production config error; M-10 deploy runbook grep false-positives on `ON DELETE`; M-11 migration folder must be committed with the schema change (now satisfied by `05e8cd0`, keep checking at merge); M-12 unpaginated `/inquiries`; M-13 mail fan-out retries duplicate; M-14 CMS partner `order`/`visible` zod defaults; M-15 no unique floor number; M-16 careers rate limit hard-coded and no per-email cap; M-17 `migrate-developer-notes.ts` non-transactional; M-18 five project permissions unenforced; M-19 no indexes on Project/CustomerInquiry; M-20 unguarded `JSON.parse` on settings rows; M-21 expired OTP/recovery rows never cleaned.
- Low and suspected: L-2 to L-8, L-32 to L-34, S-1 to S-6 (S-4, S-5, S-6 need read-only queries on production before the first deploy).

**Client, no prompt yet:** M-22 Escape bypasses unsaved-changes guard; M-23 CMS default tab ignores permissions; M-24 activate icon on pending users; M-27 `refreshUser` resets the profile form; M-30 no per-route SEO (belongs to the SEO project); M-31 "Fully booked" by string match; L-1, L-9 to L-31 (RTL, a11y, hardcoded Arabic, stale requests); S-7 to S-11.

**Left over from w3-auth-b review:**
- Not clicked in a real browser: the recovery-codes `.txt` download and clipboard copy.
- Server error messages are bilingual in one string and show Arabic text in the English UI (belongs to `w4-i18n-server`).
- No tests for H-4 (suspended account via verify link / accept-invite) and H-5 (socket handshake with an enrollment token); H-6 sends no password-changed notice mail.
- Regenerate-codes with an app code does not advance `totpLastStep` (a code can be replayed once for regenerate/disable).
- w3-auth-c (passkeys) still needs the `WEBAUTHN_RP_ID` decision before production.

**Testing and process gaps:** the client has no test runner; no test runs a committed migration, and there is no drift gate (`task-w4-postgres-dev` covers both); no CMS, inquiries, units, logger or serializer route tests; no concurrency tests.
