# Resume note (updated 2026-09-30) — read this first

Branch `feat/backend-admin` (pushed, last code commit `d443ddb`). Not merged to `main` — owner merges when ready.
Plan and every owner request: `refactor.md` (Phases 8–9, "Admin gap review" at the end). `README.md` = setup/API only.

## Owner working rules (also in auto-memory)
- Record every request/note in `refactor.md`; tick `[x]` when shipped. Keep README clean.
- Don't pause between items; delegate in parallel, review every diff, run gates, commit + push.
- Save tokens: prefer delegating implementation.

## Delegation setup
- **Big Pickle**: opencode-delegate skill, `--model opencode/big-pickle`. Two sessions can run at once on disjoint files.
- **agy**: the relay's `agy` on the Git Bash PATH is **1.2.12** and its login keeps expiring (headless OAuth opens Chrome and times out). The owner's terminal has **1.2.13**, signed in. Until fixed (`which -a agy`), write the task to `agy-task.md` in the repo root, the owner runs it in their terminal, and agy writes its report to `agy-response.md`; then review + commit and delete both files.
- **Recommended next**: one **git worktree per agent task** (own folder + own branch, e.g. `../ajda-otp-ui` on `feat/otp-ui`), agents commit there; the orchestrator reviews and merges each branch into `feat/backend-admin` one at a time with the full test suite after each merge.

## Environments
- Local: `npm run dev:all`. After pulling schema changes: `cd server && npx prisma generate && npm run db:push && npm run db:seed` (seed is safe to re-run; it keeps projects). `npm run db:gen:prod` swaps the Prisma client to Postgres — run `npx prisma generate` afterwards for local dev/tests.
- Tests: `cd server && npx vitest run` (temp SQLite, `SEED_TEST_FIXTURES=1` adds the 4 fixture admins). If `prisma generate` fails with EPERM, the owner's dev API holds the DLL — stop it first. Last full run: 13 files / 99 tests green.
- Review copy `D:\projects\html\ajda-review` (git worktree, own node_modules, `.env` DATABASE_URL absolute → `review.db`, API :4100 / Vite :5190) for Playwright checks (`playwright-core` + `channel: 'msedge'`). Verify the resolved DB path before any seed. Can be removed with `git worktree remove ../ajda-review --force` when no longer needed.
- Production (VPS `/srv/ajda/app`, Caddy + Cloudflare, systemd `ajda-api`): deploy = `git pull` → `cd server && npm ci && npm run db:gen:prod && npm run db:migrate && npm run build` → restart `ajda-api` → root `npm ci && npm run build`. `.env` needs `TRUST_PROXY=true`, `APP_URL`, `MAIL_*` (Gmail app password — owner should rotate it, it was shared in chat). WebSockets verified working (101) through Cloudflare.

## Unreviewed-in-browser (gates green, committed)
- Users page (`f99b735`), HR roles/departments pages (`25e9d7e`), Inquiries DataTable (`b91fbe8`): do a Playwright pass.

## Next queue
1. **OTP / password UI** (API done in `d443ddb`): login OTP step (`AdminStorage.startLogin` → `verifyLoginOtp` / `resendLoginOtp`), "forgot password" + reset-by-code screens on the admin login, OTP toggle + change password on a new **profile page** `/admin/profile` (`authService.updateProfile`, `changePassword`, `setLoginOtp`).
2. Small follow-up: `src/services/inquiryService.ts` (`InquiryInput`/`toPayload`) and `newsletterService.subscribe` must forward `website` + `startedAt` so the server-side spam check sees them (the forms already send them to the service).
3. Newsletter subscribers admin page (API `/api/newsletter` done).
4. DataTable + ViewSwitcher on projects and categories; "don't ask again" confirm preferences stored per admin (server-side).
5. Phase 8c: 3D model upload, image editor + format choice, SEO (decide server-side meta injection first), drafts for other forms.
6. Remaining gap-review items (error monitoring, backups visibility, media library, CRM features), Phase 9 CMS + activity log with undo.

Local uncommitted files that belong to the owner (do not commit without asking): `deploy/Caddyfile`, root `package.json`/`package-lock.json` (wrangler bump).
