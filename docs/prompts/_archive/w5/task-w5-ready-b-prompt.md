# Task w5-ready-b — production config, error boundary, migration cleanup

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). Run **after** `task-w5-ready-a-prompt.md` is reviewed and committed.

## Goal

Four production-readiness gaps found by Claude's readiness check (2026-10-25).

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply), `docs/prompts/review-ajda-project.md` entries M-1, M-19, L-6
- `server/src/config/env.ts`, `server/src/services/secretBox.ts`, `server/.env.example`, `deploy/README-deploy.md` (env section and the migration-safety section), `deploy/test.env.example`
- `server/prisma/schema.prisma`, `server/prisma/migrations/` (list the folders; read `20260923190412_init/migration.sql` and `20261024000000_totp/migration.sql` for style), `server/scripts/generate-prod-schema.mjs`
- `src/App.tsx`, `src/main.tsx`, `src/context/LanguageContext.tsx`

## Decided design

1. **Dedicated encryption key.** `secretBox` derives its key from `JWT_SECRET` when `SETTINGS_ENCRYPTION_KEY` is blank, so rotating `JWT_SECRET` later would make every stored authenticator secret and saved mail password unreadable. Fix: in `productionConfigErrors`, require `SETTINGS_ENCRYPTION_KEY` in production (set, at least `MIN_SECRET_LENGTH` characters, not a placeholder, and different from `JWT_SECRET`), with the same error style as the neighbouring secrets. Add it to `server/.env.example` (with the `openssl rand -base64 32` hint and a warning to never change it once TOTP users exist) and to `deploy/test.env.example` and the deploy README's env checklist. Tests next to the existing production-config tests. Do not change `secretBox` itself: existing data sealed with the JWT-derived key keeps working only if the new key is not set, so write one README paragraph for the owner: set the key **before** anyone enrols TOTP in production; on the test instance, existing sealed values will be unreadable after setting it, and users re-enrol.
2. **Proxy trust.** In production, if `TRUST_PROXY` is false, log one `loggerService.warn` at boot saying per-IP rate limits and lockouts will see only the proxy address behind Caddy. Do not make it an error. Test the helper that decides this.
3. **Error boundary.** No React error boundary exists, so one render error blanks the whole site. Add `src/components/common/ErrorBoundary.tsx` (class component, no new dependency) wrapping the routed content in `App.tsx` and wrapped again inside the admin shell so an admin section crash keeps the sidebar. Fallback: a short bilingual (AR/EN via the existing language context; admin screens use the admin i18n keys) message with a "Reload" button that reloads the page, plus a call to the existing client error reporter (`reportClientError`, the one used by `api.ts`; read how it is invoked and reuse it, sending only the message and component stack, never user data). Reset the boundary when the route changes.
4. **Migration cleanup (PostgreSQL, hand-written, one new folder).** `server/prisma/migrations/<next timestamp after 20261024000000>_defaults_and_indexes/migration.sql`: (a) `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT` for `AdminUser.roleAr`, `PropertyUnit.statusAr`, `CustomerInquiry.statusAr` with the **correct** Arabic strings taken byte for byte from `schema.prisma` (copy them with a script, never retype); (b) indexes `Project(publishStatus)`, `Project(city)`, `CustomerInquiry(createdAt)` named exactly as Prisma would name them, with the matching `@@index` lines added to `schema.prisma`. Do **not** edit any applied migration. Do **not** add the floor-number unique constraint (existing production rows may violate it).
   Verify on a **scratch local PostgreSQL** database you create and drop (never the owner's databases: use a unique name like `ajda_ready_b_scratch` and confirm it is gone at the end with `psql -l`): apply every migration in order, then `prisma migrate diff --from-url <scratch> --to-schema-datamodel prisma/schema.postgresql.prisma --script` (after `npm --prefix server run db:gen:prod`). Report the diff output; the only acceptable remaining differences are ones you explain. Also hex-dump the three defaults to prove they match `schema.prisma`. Add the mojibake rune-class grep (`U+2500–U+25FF` and `Ã`, `Ø`) over `server/prisma/migrations/*` as a documented check in `deploy/README-deploy.md` next to the migration-safety grep, and report that it matches only the one known applied `init` file.

## Out of scope

Everything else; no new dependencies; no changes to `secretBox` logic; no floor unique constraint; no CSP; no changes to applied migrations.

## Constraints

- No commits, no `.env*` reads or writes, no production commands, no touching the owner's databases. Match neighbouring code and preserve line endings. Do not edit files under `docs/prompts/` except your report.
- Report honestly; anything not run is "not verified".

## Gates (paste real output)

- `npm --prefix server run build`, `npm --prefix server test` (all green, report the count), `npm run lint`, `npm run build`
- Browser pass for the error boundary: temporarily throw in a public page and in one admin section, confirm the fallback appears in Arabic and English with the admin sidebar still visible, then remove the throw (confirm with `git diff`).
- The PostgreSQL verification above.

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-ready-b-report.md`: files changed, per-item result, gate output, the PostgreSQL verification output, decisions, and `## Guard results` as required by `docs/TODO.md` section 3.
