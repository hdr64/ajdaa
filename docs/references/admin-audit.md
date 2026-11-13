# Admin dashboard audit (2026-10-25, owner note 6)

Read-only code audit by three subagents, findings spot-checked by Claude where marked **verified**. Not yet done: browser pass (AR/EN, mobile) and server-side permission tests. Paths are relative to the repo root. Size: S < 1 h, M < half day, L > half day.

Goal set by the owner: production-grade. Order below is by risk, not by looks.

## P0 — Security and data safety (do first)

| # | Finding | Evidence | Size |
|---|---|---|---|
| 1 | **Read-only role can edit and close inquiries.** PATCH `/:id` and `/:id/status` only require `viewInquiries`. Add `manageInquiries` (migration + seed + role UI), use `requireSuperAdmin` for DELETE. **verified** | `server/src/routes/inquiries.routes.ts` | S |
| 2 | **No audit log.** No model, no hook; user, role, delete, publish, CMS rollback, settings changes leave no trace. Add `AuditLog` table, `onResponse` hook for non-GET admin routes, "Activity log" page (super admin). | `server/src`, Prisma schema | L |
| 3 | **"Don't ask again" shared between publish and hide.** Ticking it on a harmless publish silently auto-confirms hiding a live project (a danger dialog). Separate key, and forbid remember on danger dialogs (also user suspend). **verified** | `src/pages/admin/sections/usePublishProject.ts:40,51`, `useUsersDirectory.ts:114` | S |
| 4 | **Newsletter delete rides on `exportData`.** Anyone who can export can delete subscribers; sidebar gating also mismatches the server (Settings link shown to non-super admins who get 403). One `{section, permission}` table shared by sidebar, guard and server. | `NewsletterSection.tsx:122`, `AdminSidebar.tsx:70,79`, `newsletter.routes.ts:94-117` | S-M |
| 5 | **CMS tabs: active tab not filtered by permission** (user with only `manageClients` lands on the Home editor). | `CmsSection.tsx:45,315-320` | S |
| 6 | **CMS import trusts the file** (no size cap, schema or version check, no pre-import backup). | `CmsSection.tsx:119-163` | M |
| 7 | **ProjectCreateModal writes fake data**: up to 10 floors x 12 units with placeholder features, then publishes. Default to 0 units; also accepts a PDF as project image. | `components/admin/ProjectCreateModal.tsx:25-105,138,453` | S |
| 8 | **Optimistic rollback restores a whole snapshot** and can wipe unrelated changes (units, categories). | `ProjectUnitsPanel.tsx:126,148`, `CategoriesSection.tsx:507,519` | S |
| 9 | SMTP password field uses `autoComplete="current-password"` (browser offers the admin's login password). | `MailSettingsSection.tsx:127` | S |

## P1 — Reliability and scale

| # | Finding | Size |
|---|---|---|
| 10 | **No unsaved-changes guard** on role dialog (permission matrix), department dialog, every CMS panel (tab switch discards edits), site settings, project edit (sidebar/back drops edits). Shared `useDirtyGuard` + router blocker. | M |
| 11 | **Server lists are unbounded** (inquiries, projects, users, newsletter, past projects, roles). Add `page/limit/q` and a server mode in `DataTable`; overview counts must come from a stats endpoint (they under-report once paginated). | L |
| 12 | **No shared Modal.** 16 hand-rolled overlays; only `ConfirmDialog` has focus trap, focus restore, Esc. Extract `AdminModal`, migrate all. Native `window.confirm` remains in `ProjectCreateModal:120`, `UserCreateWizard:299`, `UserFormDialog:404`. | L (+S) |
| 13 | Error states replace the whole page after a successful action (Newsletter, PastProjects, Applications); search inputs without debounce/abort/page reset (Applications). | S |
| 14 | Applications: status filter shows rows that no longer match after update; "new" count is per page; settings emails unvalidated. | S |
| 15 | Notifications: bell uses per-browser `lastSeen`, sidebar badge counts differently, no badge for applications/newsletter, bell rows do not deep-link to the inquiry. Server `readAt`/unread-count. | M |
| 16 | Toast: single slot, no queue, no close button, same z-index as drawer. | M |
| 17 | Bulk actions: `DataTable` supports them, no list uses them (projects publish/hide, inquiries status). Needs bulk endpoints. | M |
| 18 | Bulk user suspend runs sequentially and swallows errors. | S |

## P2 — Product usefulness

| # | Finding | Size |
|---|---|---|
| 19 | **Overview is a stats wall.** Add an "Attention" queue (new inquiries, drafts, incomplete projects, projects without units, reserved units), quick actions, latest inquiries filtered to `new`. KPIs currently count drafts/hidden projects and treat reserved as occupied. | M |
| 20 | Breadcrumbs / back link on nested pages (project, edit, units, inquiry). | S |
| 21 | Global search (Ctrl+K) over projects and inquiries. | M |
| 22 | Two unit-management UIs (BuildingVisualizer vs ProjectUnitsPanel) behave differently; converge. Unit defaults wrong ("متاح للإيجار" for sale projects, area 0 accepted, no duplicate unit-number check). | L |
| 23 | Project edit: duplicate map cards, gallery reorder arrows hard-coded for RTL and hidden for keyboard users, no "save and stay". | S-M |
| 24 | Projects: no sort/filter/pagination in grid and list views; "Clear filters" leaves the status filter; "sold" column includes reserved/rented. | M |
| 25 | Exports: Inquiries has the service but no button; Applications and Past projects have none. | M |
| 26 | Field-level validation instead of single toasts (site settings, mail settings); SMTP host not required. | M |
| 27 | Past projects, Roles, Departments: no search/sort; raw tables instead of `DataTable`. | M |
| 28 | `ProjectShowSection`: unvalidated `videoUrl` in iframe and `brochureUrl` link. | S |

## P3 — Design system and accessibility

- 437 raw palette colour classes bypass tokens; add success/warn/danger/info tokens, text-muted and radius scale. Shared `Button`/`IconButton`. (M)
- Sidebar: Inquiries and Applications share an icon; footer 5-icon grid, role label always Arabic; drawer lacks Esc/focus trap; collapse icon direction unverified; no user menu. (M)
- Tabs lack `aria-controls`/arrow keys (Settings, Project show, Applications, CMS); active tab not in URL. Applications drawer lacks `role=dialog`, Esc, labels. `SectionLoading/Error` lack `aria-live`. (M)
- Mobile: Newsletter view switcher hidden below `md`; CMS preview hidden with the toggle still shown; header actions have no overflow menu. (M)

## i18n debt (feeds the existing i18n lanes, not a new task)

Hard-coded Arabic remains in: `ProjectCreateModal`, `floorplan/useFloorPlanEditor`, `BuildingVisualizer`, `projects/ProjectsTable`, all of `components/admin/users`, `UsersPermissionsManager`, all CMS panels, settings panels, HR dialogs and tables, `auth/*`, `AdminFeedbackPet`, `AdminDashboardPage.tsx:247`. Three translation mechanisms coexist (`useAdminT`, per-section `COPY`, inline `isAr`); Newsletter and Mail should fold into `useAdminT`. Several `t(x as any)` casts defeat `AdminKey`. Categories type labels are frozen in Arabic at module load (`CategoriesSection.tsx:37`). Role/department names always show `nameAr`.

## Proposed task split

1. **w6-permissions-audit-log (server + UI, OpenCode):** P0 #1, #2, #4, tests. Needs Prisma migrations, so run after the auth chain is settled; owner runs the migrations by hand.
2. **w6-safety-small (Claude, small):** P0 #3, #5, #7, #8, #9, #28, P1 #13, #14, #18 plus the `window.confirm` swaps.
3. **w6-modal-dirty-guard (OpenCode):** P1 #10, #12, #16 (`AdminModal`, `useDirtyGuard`, toast queue).
4. **w6-lists-server-paging (OpenCode):** P1 #11, #17, P2 #24, #25, #27.
5. **w6-overview-attention (OpenCode):** P2 #19, #20, #21, P1 #15.
6. **w6-design-tokens-a11y (OpenCode):** P3.
7. **w6-units-unify (OpenCode, last):** P2 #22, #23.

Sequencing: the running OpenCode tasks (`w5-inquiry-detail`, `w5-ready-b`) and the i18n lanes (l3, l2, server) own `adminRoutes.ts`, users, CMS and settings files. Tasks 3-7 must wait for those lanes to merge or they will conflict. Tasks 1 and 2 touch mostly server files and can start sooner.
