# Ajda Real Estate Platform — Task Status & Roadmap

> **Last Updated**: 2026-10-25  
> **Current Status**: CMS Engine & Admin Suite Completed | Production VPS Deployment Ready

---

## 1. Milestone Status Overview

| Domain | Status | Progress | Key Deliverables |
|---|---|---|---|
| **Core Platform (Backend + Frontend)** | ✅ Complete | 100% | Fastify API, Prisma ORM, React 19 SPA, Tailwind CSS v4 |
| **Content Management System (CMS)** | ✅ Complete | 100% | Full database-driven CMS, versioning, rollback, deterministic ETags, admin suite |
| **Action-Level Granular Permissions** | ✅ Complete | 100% | Action-level grants (`createProject`, `manageCms`, etc.) with backward-compatible role inheritance |
| **Admin Dashboard Management Suite** | ✅ Complete | 95% | Properties, Units, Inquiries CRM, CMS Suite, Settings, Roles, Departments |
| **Production Server Deployment** | 🔄 Ready | 85% | Caddyfile, systemd service units, database backup scripts created |
| **Security Hardening (Phase 8)** | 🔄 In Progress | 75% | Email OTP, AES-256 encrypted SMTP, rate-limiting active |

---

## 2. Completed Milestones

### 2.1 Content Management System (CMS) — Shipped 2026-10-01
- [x] **Prisma Database Architecture**: Added `CmsSection`, `CmsSectionVersion`, and `CmsClient` models.
- [x] **Single Source of Truth**: Zod schemas and inferred TypeScript types in `server/src/schemas/cms.schema.ts` and `src/types/cms.ts`.
- [x] **High-Performance Caching & ETags**: In-memory cache, deterministic `W/"sec-..."` and `W/"cms-agg-..."` ETags returning HTTP 304 (0ms latency).
- [x] **Snapshot Archiving & 1-Click Rollback**: Last 10 point-in-time versions archived for each section.
- [x] **Admin CMS Dashboard Suite**:
  - [x] `CmsNavPanel`: Reorderable navbar links, AR/EN labels, custom URLs, CTA button toggle.
  - [x] `CmsFooterPanel`: Brand summary, contact toggles, dynamic social media accounts CRUD.
  - [x] `CmsWorksPanel`: Header copy, featured project banner dropdown picker from real DB projects, empty state texts.
  - [x] `CmsClientsPanel`: Full relational CRUD for corporate partners, logo upload, search filter, bulk actions.
  - [x] `CmsHomePanel`: Accordion manager for all 9 sections with instant enable/disable toggles.
  - [x] `CmsContactPanel`: Header copy, form titles, paired inquiry subjects dropdown manager.
  - [x] `CmsSection`: Top-level container with tabs, JSON backup export/import, and permission guards.
  - [x] `CmsVersionModal`: Visual history inspector with side-by-side diff preview and 1-click rollback.
- [x] **Public Frontend CMS Wiring**:
  - [x] `CmsProvider` with instant 0ms first-paint from `localStorage` (`ajda_cms_cache_v2`).
  - [x] SWR background revalidation and Socket.io live updates.
  - [x] Wired `Navbar`, `Footer`, `ClientsPage`, `ClientsSection`, `HeroSection`, `Marquee`, `InteractiveProjectsMap`, `AboutSection`, `ServicesSection`, `ProcessSection`, `ProjectsSection`, `CtaSection`, `WorksPage`.

### 2.2 Developer Feedback Isolation & Production Telemetry — Shipped 2026-10-01
- [x] **Developer Notes Model & Isolation**: Added dedicated `DeveloperNote` Prisma table with PostgreSQL/SQLite migrations, isolating technical bug reports from CRM customer inquiries.
- [x] **Instant Developer Email Alerts**: Immediate HTML emails dispatched to `DEVELOPER_EMAIL` (`cloud.data.sa@gmail.com`) upon note submission from `AdminFeedbackPet.tsx`.
- [x] **Developer API & Export**: Programmatic endpoints (`GET /api/developer/notes`, `GET /export?format=markdown`) secured by `DEVELOPER_NOTES_SECRET` or JWT.
- [x] **Production Logs & Live Terminal Monitor**: In-memory 2,000-event ring buffer + streaming `prod.log`, with interactive dark-mode HTML monitor (`/api/logs/view`), level badges, debounced search, and raw tail stream.

### 2.3 Security, Authentication & Platform Hardening
- [x] Email OTP verification for admin login and password reset.
- [x] Action-level granular permissions (`createProject`, `editProject`, `deleteProject`, `publishProject`, `viewProjects`, `manageCms`, `manageClients`, `rollbackCms`).
- [x] Brute-force protection and IP-based rate limiting via `@fastify/rate-limit`.
- [x] AES-256-GCM encrypted storage for SMTP mail credentials.
- [x] Universal confirmation modals for all destructive actions.
- [x] Platform SemVer bump to `v1.2.0` across configurations, health endpoints, and documentation.
- [x] **Frontend Route-Level Code Splitting (v1.2.1)**: Dynamically split `AdminDashboardPage`, `AdminLoginPage`, and sub-routes using `React.lazy()` and `<Suspense>`. Reduced public initial bundle by **64.4%** (from 1,083 kB to 385 kB).
- [x] **Dedicated `server/errors.log` & Client Telemetry**: Added isolated error logging, process crash listeners, `GET /api/logs/errors`, and `POST /api/logs/client-error` beacon.
- [x] **Admin CMS Live Preview & Backup Export/Import (v1.2.2)**: Single-click JSON backup export/import with atomic transactions and rollback snapshots.
- [x] **Side-by-Side Live Preview Studio**: Embedded split-view editor allowing simultaneous editing and real-time viewing with WebSocket sync, device viewports, language switcher, and zoom controls.
- [x] **Asynchronous Job Queue Engine (Option C: BullMQ + Redis with Zero-Crash Sync Fallback)**:
  - `QueueService` with Laravel-inspired `QueueableJob<T>` contract.
  - Probes Redis on boot (1.5s timeout) with automatic fallback to `sync` inline execution.
  - Offloaded developer feedback notes and customer inquiry email notifications.
  - All 20 test files and 146 vitest unit/integration tests passing (100%).

---

## 3. Open tasks (updated 2026-10-25)

Every prompt ends with mandatory quality guards (`clean-code-guard`, `test-guard`, `docs-guard`); a report without `## Guard results` goes back.

Statuses: ✅ done · 🟡 reviewed, not committed · ⏳ prompt ready to run · 🔒 blocked · ⬜ no prompt yet.
Wave 1 and Wave 2 are merged into `feat/backend-admin`. Each task is run by OpenCode from its `task-<x>-prompt.md`; Claude reviews the report.

### Phase 1 — Auth chain (worktree `ajda-wt/auth`, branch `lane/auth`; strictly in order)

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | w3-login-eye (password eye button) | ✅ committed | Reviewed. |
| 2 | w3-auth-a (email verification, two-step password change) | ✅ committed on `lane/auth` | Reviewed; bypass fixed in review; owner approved 2026-10-23. |
| 3 | w3-auth-a2 (email code, `verifyUsers` permission, "send password" checkbox) | ✅ committed on `lane/auth` (1473338) | Reviewed 2026-10-24; fixed a broken login code step and a `PUT /users/:id` verifyUsers edit block. |
| 4 | w3-auth-b (authenticator 2FA + recovery codes) | 🟡 reviewed, not committed (uncommitted in `ajda-wt/auth`) | Code review and gates done 2026-10-25 (380 tests pass); fixed H-1..H-6 from `review-ajda-project.md` inline. **Browser pass still open**, then owner approval to commit. |
| 4b | w5-client-fixes (C-1, H-10, M-3, M-4, M-25, M-26, M-28, M-29) | ⏳ `task-w5-client-fixes-prompt.md` | Main repo, independent of the auth lane. |
| 5 | w3-auth-c (passkeys) | ⏳ | After #4. Decide `WEBAUTHN_RP_ID` before the production deploy. |
| 6 | Merge `lane/auth` into `feat/backend-admin` | ⬜ Claude | After #5. Then run the three new migrations by hand on production. |

### Phase 2 — Admin translation AR/EN (one worktree per lane; `i18n-core`, `i18n-l1` and `small` are merged and can be removed)

| # | Task | Status | Notes |
|---|---|---|---|
| 7 | w4-i18n-core | ✅ merged into `feat/backend-admin` | Raw-key bug fixed in review; owner approved 2026-10-23. |
| 8 | w4-i18n-l1 (section pages, applications, past projects) | ✅ merged into `feat/backend-admin` (92cc42e) | Reviewed 2026-10-24; fixed module-scope `translateAdmin` raw keys; browser-scanned 14 routes AR/EN. |
| 9 | w4-i18n-l3 (users, roles, projects, floor plan) | ⏳ | After #7 and #6 (A2, B and C all change the users files it owns). |
| 10 | w4-i18n-l2 (CMS, settings, profile, feedback) | ⏳ | After #7 and #6 (B and C change the profile page and the security settings panel). |
| 11 | w4-i18n-server (localised API messages) | ⏳ | After #6 (rewrites messages in `auth.routes.ts`). |
| 11b | w4-i18n-auth (login, verify, accept-invite pages and `src/components/admin/auth/*`) | ⬜ no prompt | After #6 and #7; excluded from every other lane by `docs/ADMIN-I18N.md`. |

`docs/ADMIN-I18N.md` (both copies) now requires a browser check that no raw keys appear and no `missing key` console warning (added 2026-10-23).

### Phase 3 — Independent (any time, in parallel)
- ✅ w4-public-polish (merged f6e9692) (careers form, past-works page)
- ✅ w4-create-dev-user (merged f6e9692) (CLI script to create developer admin users). After #6 merges, the script must also set `emailVerifiedAt` (Claude does this at merge time).

### Phase 4 — Infrastructure

| # | Task | Status | Notes |
|---|---|---|---|
| 12 | w4-postgres-dev (PostgreSQL for dev and tests, one schema, `migrate dev`) | ⏳ | After #6 so the drift check covers the auth migrations. Ends SQLite use. |
| 13 | w2-monitoring | 🔒 | Needs owner decisions: `MONITOR_ALLOWED_IPS`, `MONITOR_EXTERNAL_UNTIL` (go-live + 30 days). Run after #6, #7 and #12 (uses the admin i18n system). |

### Phase 5 — Claude only (no prompt)
- ⬜ 14. Browser verification of all merged lanes (AR/EN, auth flows, careers, past works, 3D and PDF buttons)
- ⬜ 15. Commit the uncommitted deploy work in the main repo (`deploy/README-deploy.md`, `deploy/mkuser.sh`, `docs/ADMIN-I18N.md`, `docs/github-actions-deploy.md`) — needs owner approval
- ⬜ 16. Owner notes 6 and 7: full admin UI review, then finish missing features
- ⬜ 17. Dynamic SEO, OpenGraph/Twitter cards, Schema.org JSON-LD (after notes 1-5)
- ⬜ 18. Note 8: production-readiness checkup
- ⏳ 19. Full code-quality review: `docs/prompts/code-quality-review-prompt.md` → `code-quality-review.md`. Reusable: run now for a baseline, again after each merged lane and before every production deploy.

### Phase 6 — Owner actions (details in `salah-tasks.md`; do before go-live)
- **Production secrets (C):** rotate Gmail app password, `JWT_SECRET`, DB password; `chmod 600 server/.env`; confirm port 4000 is blocked; change the `admin@ajdaa.sa` password if still `password`.
- **Test instance (D):** repoint the `ajda.weghetk.com` Caddy block; create `ajda_test`, the CV folder, GitHub secrets and environments.
- **First production deploy (E):** backup, then run migrations by hand; create the CV folder; grant `managePastProjects`, `viewApplications`, `manageApplications` (later `verifyUsers`); add "أعمالنا السابقة" to the menu; choose the job-application email recipients.

### Production VPS deployment (reference)
- Ubuntu 24.04 LTS with native PostgreSQL 16 and Redis 7; Caddy 2 with Cloudflare Origin SSL; systemd units (`ajda-api.service`, `ajda-backup.timer`).
- Deploy with `deploy/remote-deploy.sh <test|prod> <commit-sha>` (called by `.github/workflows/deploy.yml`). CI deploys test only; production and production DB commands stay manual.
