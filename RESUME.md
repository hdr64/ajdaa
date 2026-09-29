# Resume note (updated 2026-09-30, late) — read this first

Branch `feat/backend-admin` (pushed, last code commit `0e69c06`). Not merged to `main` — owner merges when ready.
Plan and every owner request: `refactor.md` (Phases 8–9, "Admin gap review" at the end). `README.md` = setup/API only.

## Owner working rules (also in auto-memory)
- Record every request/note in `refactor.md`; tick `[x]` when shipped. Keep README clean.
- Don't pause between items; delegate in parallel, review every diff, run gates, commit + push.
- Save tokens: prefer delegating implementation.

## Delegation setup
- **Big Pickle**: opencode-delegate skill, `--model opencode/big-pickle`. Two sessions can run at once on disjoint files.
- **agy**: write the task to `agy-task.md` in the repo root; the owner runs it in their terminal and agy writes `agy-response.md`; review, commit, delete both.
- **Big Pickle / OpenCode free models** hit `FreeUsageLimitError` (429) repeatedly on 2026-09-30; nemotron stalled mid-file. Check quota before relying on them.
- **Recommended next**: one **git worktree per agent task** (own folder + own branch, e.g. `../ajda-otp-ui` on `feat/otp-ui`), agents commit there; the orchestrator reviews and merges each branch into `feat/backend-admin` one at a time with the full test suite after each merge.

## Environments
- Local: `npm run dev:all`. After pulling schema changes: `cd server && npx prisma generate && npm run db:push && npm run db:seed` (seed is safe to re-run; it keeps projects). `npm run db:gen:prod` swaps the Prisma client to Postgres — run `npx prisma generate` afterwards for local dev/tests.
- Tests: `cd server && npx vitest run` (temp SQLite, `SEED_TEST_FIXTURES=1` adds the 4 fixture admins). If `prisma generate` fails with EPERM, the owner's dev API holds the DLL — stop it first. Last full run: 13 files / 99 tests green.
- Review copy `D:\projects\html\ajda-review` (git worktree, own node_modules, `.env` DATABASE_URL absolute → `review.db`, API :4100 / Vite :5190) for Playwright checks (`playwright-core` + `channel: 'msedge'`). Verify the resolved DB path before any seed. Can be removed with `git worktree remove ../ajda-review --force` when no longer needed.
- Production (VPS `/srv/ajda/app`, Caddy + Cloudflare, systemd `ajda-api`): deploy = `git pull` → `cd server && npm ci && npm run db:gen:prod && npm run db:migrate && npm run build` → restart `ajda-api` → root `npm ci && npm run build`. `.env` needs `TRUST_PROXY=true`, `APP_URL`, `MAIL_*` (Gmail app password — owner should rotate it, it was shared in chat). WebSockets verified working (101) through Cloudflare.

## Shipped 2026-09-30 (gates green; browser pass still pending)
- Spam fields forwarded (elapsedMs), OTP login + forgot/reset + /admin/profile (agy), newsletter page,
  /admin/settings with tabs: contact info (public GET /api/settings/site), notifications (listeners on
  inquiry.created, permission manageNotifications), mail SMTP (encrypted password, test email).
- New-inquiry toast + header bell + desktop notification. Public site reads contact details from settings.
- Projects table/list/grid, categories on shared ViewSwitcher + DataTable (agy).
- Deploy needs `npm run db:migrate` (AppSetting, NotificationListener). Local: stop dev, `cd server && npx prisma generate && npm run db:push`.
- Still to do in the browser: Users, HR, Inquiries, Settings tabs, Projects/Categories views, OTP login.

## Next queue
1. Browser pass over everything shipped 2026-09-30.
2. Settings tabs still planned: SEO defaults, maintenance mode / announcement banner, OTP policy.
3. Phase 8c: 3D model upload, image editor + format choice, SEO (decide server-side meta injection first), drafts for other forms.
4. Remaining gap-review items (error monitoring, backups visibility, media library, CRM features), Phase 9 CMS + activity log with undo.

Local uncommitted files that belong to the owner (do not commit without asking): `deploy/Caddyfile`, root `package.json`/`package-lock.json` (wrangler bump).
