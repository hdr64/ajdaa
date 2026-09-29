# Resume note for the next agent (written 2026-09-29, session ran out of budget)

Branch: `feat/backend-admin` (pushed). Plan + every owner request: `refactor.md` (Phase 8 → 9, "Admin gap review" at the end). `README.md` = setup/API only — keep it clean.

## Owner working rules (also in auto-memory)
- Record every request/note in `refactor.md`; tick `[x]` when shipped.
- Don't pause between items; delegate in parallel to **agy** (agy-delegate skill, `--dangerously-skip-permissions` approved) and **Big Pickle** (opencode-delegate, `--model opencode/big-pickle`), file-disjoint briefs; review every diff, re-run gates, verify in a browser, then commit.
- Consultant tone, no filler.

## State at handoff
Last commit: `d028a9e` (sidebar). All committed work is verified (tsc, oxlint, server vitest, Playwright screenshots).

### UNCOMMITTED — finish these first
> Status at handoff: agy and Big Pickle both **finished**. Gates on the combined working tree are green (server tsc 0, vitest 11 files / 77 tests, root tsc 0). Remaining job: **review the diffs** (agy report: task output of the roles relay; `git diff` + new files) and **browser-check** the inquiries page, then commit in two commits.
1. **agy: roles / departments / permissions backend (Phase 8b)** — brief: see "brief-roles" design in refactor.md Phase 8b. Files: `server/prisma/schema.prisma`, `seed.ts`, `server/src/app.ts`, `routes/auth.routes.ts`, new `routes/{roles,departments,permissions}.routes.ts`, `config/permissions.ts`, migration `20260929210000_roles_departments`, `test/roles.test.ts`, `src/types/admin.ts`, `src/services/authService.ts` (+ probably `rolesService.ts`, `adminStorage.ts`).
   - May be half-done. Check `git status`, then run: `cd server && npx tsc --noEmit && npx vitest run` and root `npx tsc -b --noEmit`.
   - Review hard: escalation guards must still key off `role === 'super_admin'`; migration must NOT change any user's `permissions`; system role ids `role_super_admin` etc.; `applyToUsers` in one transaction. Existing authz/escalation tests must pass unchanged.
2. **Big Pickle: Inquiries page on DataTable** — `src/pages/admin/sections/InquiriesSection.tsx` only (table view via `DataTable`, list view = cards, ViewSwitcher in header, bulk status/delete/export-selected). Review + gates + browser check before committing.
3. **Known bug to fix right after agy is done** (same file agy may edit): `src/services/adminStorage.ts` admin helpers `addFloorToProject`, `deleteFloorFromProject`, `addUnitToProject`, `updateUnitInProject`, `deleteUnitFromProject` reload with public `propertyService.getById(projectId)`, which returns **404 for draft/hidden projects** → floor/unit edits on drafts will look like failures. Change those calls to `propertyService.getById(projectId, undefined, { scope: 'admin' })`.

### Owner's local environment
- Dev DB needs the new tables/columns: `cd server && npm run db:push` (newsletter, publishStatus, roles once merged). Start both servers: `npm run dev:all`.
- **Never** point destructive seeds at `server/prisma/dev.db` by accident. The review copy `D:\projects\html\ajda-review` (git worktree, own `node_modules`, `.env` DATABASE_URL absolute `review.db`) runs API :4100 / Vite :5190 for Playwright checks. Verify the resolved DB path before any seed/reset. (An earlier session wiped dev.db this way; it was restored.)
- Playwright: `playwright-core` in the session scratchpad, `chromium.launch({ channel: 'msedge' })`.

## Next queue (in order, owner-approved)
1. Finish/commit items 1–3 above.
2. Phase 8b UI: users page layouts (table/grid/stack via DataTable + ViewSwitcher), user create/edit forms, roles/permissions/departments HR pages (on agy's API), confirm dialogs with "don't ask again" (per admin, server-side prefs).
3. Wire DataTable + ViewSwitcher into projects, categories, users, newsletter (new admin page for `/api/newsletter`).
4. Phase 8e: profile page, change password, user settings, system settings, 2FA TOTP, passkeys (new deps need approval), sessions.
5. Phase 8c remainder: 3D model upload, image editor + format choice, SEO (decide server-side meta injection first), drafts for other forms.
6. Gap review items: rate limiting + spam protection + password reset/email are the highest-risk gaps.
7. Phase 7 deploy (needs owner/VPS) and Phase 9 CMS + activity log with undo.
