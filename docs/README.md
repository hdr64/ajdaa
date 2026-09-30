# Ajda Real Estate Platform — Documentation Index

> **Last Updated**: 2026-10-01  
> **Platform Version**: 1.1.0 (Full CMS & Granular Permissions)

Welcome to the comprehensive documentation suite for the **Ajda Real Estate Platform**. This directory contains the complete technical architecture, API specifications, operations guides, roadmap, and historical design records.

---

## 📚 Documentation Catalog

| Document | Purpose | Target Audience |
|----------|---------|-----------------|
| [architecture.md](architecture.md) | High-level system architecture, data models, CMS design, caching, ETags, and security | Developers, Architects |
| [cms-architecture.md](cms-architecture.md) | In-depth v2.1 CMS specification (Kimi-reviewed), covering schemas, versions, and validation | CMS & Backend Engineers |
| [api-reference.md](api-reference.md) | Complete REST endpoint and WebSocket event documentation, schemas, and status codes | Frontend Devs, Integrators |
| [deployment.md](deployment.md) | Production infrastructure setup on Ubuntu 24.04 (Native PostgreSQL 16 + Caddy 2 + systemd, No Docker) | DevOps, System Admins |
| [testing-strategy.md](testing-strategy.md) | Vitest backend test suites, mock strategies, and quality gate workflows | QA, Developers |
| [TODO.md](TODO.md) | Active sprint tasks, remaining backlog, and decision registers | Project Managers, Devs |
| [CHANGELOG.md](CHANGELOG.md) | Detailed version history, chronological releases, and migration notes | All Stakeholders |
| [gap-analysis.md](gap-analysis.md) | Feature audit against modern real estate platforms and prioritized roadmap | Product Owners, Leads |

---

## 📦 Archive Directory (`docs/archive/`)

Historical source documents and review records are preserved in full integrity under [`docs/archive/`](archive/):

- [`archive/original-refactor.md`](archive/original-refactor.md) — The complete, unedited original 45KB refactoring master plan.
- [`archive/original-content-inventory.md`](archive/original-content-inventory.md) — Initial site content inventory and assets baseline.
- [`archive/cms-plan-kimi-review.md`](archive/cms-plan-kimi-review.md) — First external architectural review by Kimi.
- [`archive/cms-plan-kimi-review-v2.md`](archive/cms-plan-kimi-review-v2.md) — Second external architectural review by Kimi approving v2.1.
- [`archive/agy-task.md`](archive/agy-task.md) & [`archive/agy-response.md`](archive/agy-response.md) — Antigravity agent handoff briefs.
- [`archive/RESUME.md`](archive/RESUME.md) — Context preservation record.

---

## 🚀 Quick Navigation by Role

### For Frontend Developers
1. Start with [architecture.md](architecture.md) for data flow and component hierarchy.
2. Review [api-reference.md](api-reference.md) for REST endpoints and Socket.io events.
3. Check `src/context/CmsContext.tsx` and `src/hooks/useCmsSection.ts` for public CMS consumption.
4. Run validation checks: `npm run build` and `npx oxlint`.

### For Backend Developers
1. Review [cms-architecture.md](cms-architecture.md) for the CMS entity model and LWW concurrency strategy.
2. See [api-reference.md](api-reference.md) for route schemas, ETags, and rate limits.
3. Review [testing-strategy.md](testing-strategy.md) and run `npx vitest run` in `server/`.

### For DevOps & Infrastructure
1. Follow the step-by-step instructions in [deployment.md](deployment.md).
2. Note the strict architectural policy: **No Docker** — native PostgreSQL 16 + Caddy 2 reverse proxy + systemd.

### For Product & Project Managers
1. Review [TODO.md](TODO.md) for current sprint items and open questions.
2. Check [gap-analysis.md](gap-analysis.md) for the prioritized future roadmap.
3. Review [CHANGELOG.md](CHANGELOG.md) for recent release notes.

---

## 🏛️ Core Architectural Principles

1. **No Docker**: Production runs bare-metal on Ubuntu with native PostgreSQL and Caddy 2 for simplicity and performance.
2. **Deterministic ETags**: Section-level (`W/"sec-..."`) and aggregated (`W/"cms-agg-..."`) ETags allow instant HTTP 304 responses, eliminating redundant data transfer.
3. **Multi-Tier CMS Caching**: Fastify in-memory `Map` cache delivers near-instant public reads, invalidated precisely by section key on writes.
4. **Real-Time Synchronization**: Backend broadcasts `cms:section:updated` and `cms:clients:updated` via Socket.io to keep all client browser sessions fresh without manual polling.
5. **Audited Versioning**: Up to 10 historical snapshots are automatically maintained per CMS section with instant diff and rollback capabilities.
6. **Action-Level RBAC**: Granular permissions (`manage_cms`, `manage_cms_content`, `manage_cms_clients`) ensure strict administrative security.
