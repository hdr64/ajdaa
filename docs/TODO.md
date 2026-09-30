# Ajda Real Estate Platform — Task Status & Roadmap

> **Last Updated**: 2026-10-01  
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

---

## 3. Pending Decisions (Owner Input Required)

| # | Question / Proposal | Area | Priority |
|---|---|---|---|
| 1 | **SEO & Code-Splitting**: Split admin bundle (`React.lazy`) and evaluate pre-rendering for SEO. | Frontend / CWV | Medium |
| 2 | **2FA (TOTP)**: Approve `@simplewebauthn` or Google Authenticator QR integration for admins. | Security | Low |
| 3 | **Production VPS Launch**: Schedule live execution of `deploy/` scripts on Ubuntu server. | Infrastructure | High |

---

## 4. Next Priorities

1. **Route-Level Code Splitting (Frontend Performance)**:
   - Split `/admin/*` dashboard and CMS components from public customer-facing routes using `React.lazy()` and `Suspense`.
   - Reduce the initial bundle from ~1,080 kB to under 300 kB for first-time visitors.
2. **Production VPS Deployment**:
   - Provision Ubuntu 24.04 LTS VPS with native PostgreSQL 16.
   - Configure Caddy 2 reverse proxy with automatic Let's Encrypt TLS.
   - Enable systemd service unit (`ajda-api.service`) and daily backup cron (`backup.sh`).
3. **End-to-End Visual Verification**:
   - Verify public CMS rendering and admin editing flows in browser.

