# Ajda Real Estate Platform — Task Status & Roadmap

> **Last updated**: 2026-10-26. Source of truth for what is open and in which order. Shipped work is described in [CHANGELOG.md](CHANGELOG.md); owner requests are logged in `../refactor.md`; owner-only actions are in `../salah-tasks.md`.
>
> **Branch**: all work is on `main` (`feat/backend-admin`, `lane/auth` and the lane worktrees are merged and gone). Server suite: 44 files, 428 tests passing.

## 1. Where the platform stands

| Domain | State |
|---|---|
| Public site, projects/floors/units, CMS (versions, ETags, live preview), inquiries, newsletter | Done |
| Past projects, careers (form, CV, applications admin), 3D link and PDF buttons | Done |
| Admin users: wizard, invite/verify by email, roles, departments, avatars | Done |
| Sign-in security: email codes, TOTP + recovery codes, passkeys, rate limits, lockouts | Done (passkey domain decision open, see section 4) |
| Admin AR/EN translation (client side, all areas incl. login) | Done in code; **browser pass of every route still to do** |
| Test instance deploy by CI, production by hand (`reload.sh`, `npm run deploy:prod`) | Ready; the first production deploy of this work is pending (per `salah-tasks.md`) |
| Admin hardening backlog (`admin-audit.md` P0-P3) | Not started |

## 2. Open tasks, in recommended order

Statuses: ⬜ no prompt yet · ⏳ prompt ready in `docs/prompts/` · 🔒 blocked · 🟡 needs owner decision.

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | **Browser verification of everything merged**: admin in AR and EN on every route (no raw keys, no `missing key` console warning), login flows (password, email code, TOTP, passkey, forgot, invite, verify), inquiry detail, careers and past works, 3D and PDF buttons, avatar upload, 390 px layout of the floating Jobs button | ⬜ Claude | Lint and build do not catch raw keys or handler mismatches. Do this before anything else; it decides whether the next items are bug fixes or features. |
| 2 | Align versions: root `package.json` 1.2.2, `server/package.json` 1.2.3, `/api/health` 1.2.2 | ⬜ small | Pick one number at the next release; the health string is hard-coded in `server/src/app.ts`. |
| 3 | **P0 from `admin-audit.md`**: separate write permission for inquiries (`PATCH` currently needs only `viewInquiries`), audit log table + admin "Activity" page, remaining P0 items | ⬜ | Needs a migration, seed and role UI. Split into prompts after item 1. |
| 4 | Admin-audit P1 to P3 (reliability, usefulness, design/a11y) | ⬜ | Split into `w6-*` prompts by file area, run in parallel lanes on disjoint files. |
| 5 | Unresolved findings of the 2026-10-25 whole-project review (`reviews/2026-10-25-whole-project-review.md`) | ⬜ | Fixed by the w5 tasks: C-1, H-7, H-8, H-9, H-10, M-1 (migration), M-2, M-3, M-4, M-8, M-9, M-10, M-14, M-20, M-25, M-26, M-28, M-29. H-1..H-6 and the other M, L and Suspected items are not tracked as fixed; re-run the code-quality review (item 8) to get the exact open list. |
| 6 | `w4-i18n-server` (localised API messages) | ⏳ `prompts/task-w4-i18n-server-prompt.md` | Admin shows English API errors in Arabic mode. Check it is still wanted. |
| 7 | Dynamic SEO, OpenGraph/Twitter cards, Schema.org JSON-LD | ⬜ | Owner note 3 follow-up; after items 1 to 3. |
| 8 | Full code-quality review (`prompts/code-quality-review-prompt.md` → `code-quality-review.md`, previous report to `docs/reviews/`) | ⏳ reusable | Run for a baseline now, again after each batch of merged work and before every production deploy. |
| 9 | Production-readiness check (owner note 8): backups restore test, monitoring, env checklist, rollback rehearsal on the test instance | ⬜ Claude | Uses `deploy/README-deploy.md` sections 6 to 9. |
| 10 | `w2-monitoring` | 🔒 | Needs `MONITOR_ALLOWED_IPS` and `MONITOR_EXTERNAL_UNTIL` (go-live + 30 days) from the owner. |
| 11 | `w4-postgres-dev` (PostgreSQL for dev and tests, one schema, `migrate dev`) | 🟡 dropped for now | Revisit before the first production deploy: it would catch SQLite-vs-PostgreSQL migration drift (finding M-1 was exactly that). |

## 3. Housekeeping the owner may want to do

- Delete merged branches: local `feat/backend-admin`, `feat/opencode-worker`, `t2`; remote `origin/feat/backend-admin`, `feat/opencode-worker`, `t1`, `t2` (check `git log main..<branch>` is empty first).
- Untracked, git-ignored files in the repo root can go once you have looked at them: `a.txt`, `errors.log`, `prod.log`, `web.log`, the `2026-10-25-...caveat...txt` chat export. Keep the two database dumps (`server-10-21-2026.sql`, `server-21-10-26.backup`) until a verified backup exists elsewhere; move them out of the repo folder.
- `known_hosts.txt` in the root is the server host key used by `npm run deploy:prod`; it is public data, but the file belongs under `deploy/`.

## 4. Owner actions before the first production deploy (details in `salah-tasks.md`)

- **Production secrets**: rotate the Gmail app password, `JWT_SECRET`, DB password; `chmod 600 server/.env`; confirm port 4000 is blocked; change the `admin@ajdaa.sa` password if it is still `password`. Set `TRUST_PROXY=1`, `HOST=127.0.0.1`, `SETTINGS_ENCRYPTION_KEY`, `LOGS_SECRET_KEY`, `DEVELOPER_NOTES_SECRET` (the server refuses to boot without the last three).
- **Passkey domain**: decide `WEBAUTHN_RP_ID` (default: the `APP_URL` host). Passkeys stop working if the domain changes later.
- **Test instance**: repoint the `ajda.weghetk.com` Caddy block, create `ajda_test`, the CV folder, GitHub secrets and environments (`deploy/README-deploy.md` sections 3 to 5), then let users test.
- **Production deploy** (backup first, then by hand): migrations `20261022000000_foundation_past_projects_applications`, `20261022100000_email_verification`, `20261024000000_totp`, `20261025000000_defaults_and_indexes`, `20261025120000_passkeys`, `20261026000000_user_avatar`; create `server/private` (CVs); grant `managePastProjects`, `viewApplications`, `manageApplications`, `verifyUsers` to the right users and roles; add "أعمالنا السابقة" to the menu in Admin → CMS → Navigation (untick the CTA flag on "حجز معاينة" there too); choose the job-application email recipients.

## 5. Finished (reference)

All numbered tasks of the earlier plan are done and archived with their reports in `docs/prompts/_archive/`: wave 1 (foundation, security, deploy), wave 2 (projects, users wizard, past projects, careers), auth chain (login eye, A, A2, B, C passkeys), i18n core, l1, l2, l3 and auth strings, public polish, create-dev-user, client fixes, server hardening, production readiness A and B, careers toggle, inquiry detail, plus the skeleton loaders and avatar work. The CMS, telemetry, queue and code-splitting milestones of September/October are in the changelog (1.2.x).

Reference for deployment: Ubuntu 24.04, PostgreSQL 16, Redis 7, Caddy 2 with Cloudflare origin certificates, systemd units `ajda-api` and `ajda-api-test`. CI deploys the test instance only; production and every production database command stay manual.
