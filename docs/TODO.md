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

### 2.2 Security & Authentication
- [x] Email OTP verification for admin login and password reset.
- [x] Action-level granular permissions (`createProject`, `editProject`, `deleteProject`, `publishProject`, `viewProjects`, `manageCms`, `manageClients`, `rollbackCms`).
- [x] Brute-force protection and IP-based rate limiting via `@fastify/rate-limit`.
- [x] AES-256-GCM encrypted storage for SMTP mail credentials.
- [x] Universal confirmation modals for all destructive actions.

---

## 3. Pending Decisions (Owner Input Required)

| # | Question / Proposal | Area | Priority |
|---|---|---|---|
| 1 | **SEO Strategy**: Evaluate Vite Prerender plugin vs SSR for static crawler indexing. | SEO / Marketing | Medium |
| 2 | **2FA (TOTP)**: Approve `@simplewebauthn` or Google Authenticator QR integration for admins. | Security | Low |
| 3 | **Production VPS Launch**: Schedule live execution of `deploy/` scripts on Ubuntu server. | Infrastructure | High |

---

## 4. Next Priorities

1. **Production VPS Deployment**:
   - Provision Ubuntu 22.04 LTS VPS with native PostgreSQL 16.
   - Configure Caddy 2 reverse proxy with Cloudflare Origin CA certificate.
   - Enable systemd service units for API server and setup daily database backup cron.
2. **ContactPage CMS Extension**:
   - Extend `src/pages/ContactPage.tsx` to read header copy and dynamic subject options directly from `cms.contact`.
3. **Comprehensive End-to-End Visual Verification**:
   - Perform cross-browser testing across desktop and mobile devices.
