# Ajda Real Estate Platform — Documentation Index

> **Last updated**: 2026-10-26. Setup and commands are in the root [README.md](../README.md).

## Where things live

| Document | Purpose |
|---|---|
| [TODO.md](TODO.md) | **Open tasks and the order to do them in** (source of truth). Start here. |
| [architecture.md](architecture.md) | System design, data models, caching, permissions, queue, auth factors, admin i18n |
| [cms-architecture.md](cms-architecture.md) | Approved CMS v2.1 design (schemas, versions, validation); the shipped behaviour is in `architecture.md` |
| [api-reference.md](api-reference.md) | Route index with guards for every endpoint, plus detail for the older ones |
| [../deploy/README-deploy.md](../deploy/README-deploy.md) | Deployment playbook: instances, test instance, CI, backups, production runbook, Caddy, passkeys |
| [github-actions-deploy.md](github-actions-deploy.md) | How the GitHub Actions workflow deploys the test instance and how it is locked to test |
| [testing-strategy.md](testing-strategy.md) | Server test suites, gates, manual checklist |
| [ADMIN-I18N.md](ADMIN-I18N.md) | Rules for the admin AR/EN translation (read before touching admin strings) |
| [admin-audit.md](admin-audit.md) | Admin dashboard audit with the P0-P3 improvement backlog |
| [gap-analysis.md](gap-analysis.md) | Feature status against modern real-estate admin platforms |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [reviews/](reviews/) | Dated review reports (whole-project review, bug hunts) |
| [prompts/](prompts/README.md) | Task prompts and reports for implementing agents; archive of finished ones |
| [archive/](archive/) | Superseded plans kept for history (original refactor plan, waves 1-2 plan, CMS plan reviews, content inventory, resume note) |

Outside `docs/`: `CLAUDE.md` (planner context), `refactor.md` (owner requests log, every request is recorded there), `salah-tasks.md` (owner's own actions: secrets, servers, first production deploy).

## Documentation rules

- One home per fact. Route lists live in `api-reference.md`, environment variables in `server/.env.example` and `deploy/README-deploy.md`, task status in `TODO.md`; other files link instead of copying.
- Never write real secrets or default secret values into docs. Show variable names only.
- Finished task prompts and reports move to `docs/prompts/_archive/<wave>/`; review outputs go to `docs/reviews/<date>-<topic>.md`.
- When a task changes routes, permissions, env variables or the schema, update `api-reference.md`, `architecture.md` and the changelog in the same change.

## Core principles

1. **No Docker**: bare-metal Ubuntu with native PostgreSQL, Redis and Caddy 2.
2. **Database is the source of truth**: nothing the site shows is hard-coded in `src/data`.
3. **Deterministic ETags** on CMS reads give instant HTTP 304 responses; writes evict the cache and push a Socket.io update.
4. **Audited versioning**: the last 10 snapshots of every CMS section can be diffed and rolled back.
5. **Action-level RBAC** with role inheritance; mail, security, logs and developer tools are super admin only.
6. **CI deploys the test instance only**; production deploys and production database commands are manual.
