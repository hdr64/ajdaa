# Task w2-pastprojects — "أعمالنا السابقة" (past works): server CRUD, admin section, public page

Worktree lane `oldprojects` (branch `lane/oldprojects`, based on `integration/wave1`). Owner note 1. Other lanes (`projects`, `careers`) run in parallel on other files: stay inside your file list. Where you must touch a shared registry file (listed below), make the smallest possible change in one contiguous block so Claude can merge it with the other lane's edit.

## Read first
`docs/MASTER-PLAN.md`, `refactor.md`, `server/prisma/schema.prisma` (model `PastProject`, already migrated by the foundation lane: do NOT change the schema or migrations), `server/src/config/permissions.ts` (`managePastProjects` already exists), `server/src/routes/categories.routes.ts` and `server/src/routes/cms.routes.ts` (CRUD + permission guard style), `server/src/services/serializers.ts`, `server/src/routes/media.routes.ts` and `server/src/services/mediaService.ts` (uploads), `src/pages/admin/sections/CategoriesSection.tsx` and `src/components/admin/cms/CmsClientsPanel.tsx` (admin list + dialog style), `src/pages/admin/adminRoutes.ts`, `src/components/admin/layout/AdminSidebar.tsx`, `src/pages/admin/AdminDashboardPage.tsx`, `src/App.tsx` (`parsePath`, `getPathForRoute`, page rendering), `src/components/common/Navbar.tsx`, `src/types/cms.ts` (`CmsNavPage`, `DEFAULT_NAV_ITEMS`), `server/src/config/defaultCmsContent.ts`, `src/pages/ClientsPage.tsx` (a simple public page to copy structure from), `src/services/mediaService.ts`, a CRUD test in `server/test/`.

## Verified facts
- Model `PastProject` fields: `id Int`, `title`, `titleEn?`, `category?`, `categoryEn?`, `image` (required), `gallery?` (JSON array of urls, same convention as `Project.gallery`), `pdfUrl?`, `description?`, `descriptionEn?`, `sortOrder Int @default(0)`, `published Boolean @default(true)`, `createdAt`, `updatedAt`, index on `(published, sortOrder)`.
- Permission `managePastProjects` exists in the catalogue, the role seed and the frontend `AdminPermissions`.
- The existing "مشاريعنا" page (`works`) lists CURRENT offerings: leave it untouched.

## Decided design
**Server** (new `server/src/routes/pastProjects.routes.ts`, registered in `server/src/app.ts` with prefix `/api/past-projects` — one added import and one added `register` line):
1. `GET /api/past-projects` public: published only, ordered `sortOrder` asc then `id` desc, returns the serialized list (gallery parsed to an array). No pagination (max 200 rows, `take: 200`).
2. Admin (guard `onRequest: [authenticate, requirePermission('managePastProjects')]`, same pattern as other routes): `GET /api/past-projects/admin` (all rows incl. unpublished), `POST /api/past-projects`, `PUT /api/past-projects/:id`, `DELETE /api/past-projects/:id` (hard delete of the row only; do not delete files), `PATCH /api/past-projects/:id/published` body `{published: boolean}`.
3. Validation with zod: `title` 1-200, `titleEn` ≤ 200, `category`/`categoryEn` ≤ 100, `description`/`descriptionEn` ≤ 5000, `sortOrder` int −100000..100000, `image` required, `gallery` array of ≤ 30 urls, `pdfUrl` optional. Every URL (`image`, gallery items, `pdfUrl`) must match `^(https://|/uploads/)[^\s"'<>\\]+$` and be ≤ 500 chars. Invalid id → 400, unknown id → 404. Responses and error shape follow the neighbouring routes.
4. Reuse the existing upload endpoint for files; do not add upload code.
5. Tests in `server/test/pastProjects.test.ts`: public list hides unpublished and orders by sortOrder; 401 anonymous and 403 without `managePastProjects` on every admin endpoint, 200/201 with it (and for super admin); create/update validation (bad URL schemes, over-long title, > 30 gallery items); publish toggle; delete; gallery round-trips as an array.

**Admin UI**:
6. New admin section `pastProjects` (route `/admin/past-projects`): register in `adminRoutes.ts` (type union, `SIMPLE_SECTIONS`, doc comment), `AdminSidebar.tsx` (label "أعمالنا السابقة", shown only with `managePastProjects` or super admin, same gating helper as the other items) and `AdminDashboardPage.tsx` (render the section). New files under `src/pages/admin/sections/PastProjectsSection.tsx` and `src/components/admin/pastProjects/*` (service `src/services/pastProjectService.ts`). UI: table/list with thumbnail, title, category, sortOrder, published toggle, edit, delete (confirm, using the project's existing confirm pattern); create/edit dialog with title/titleEn, category/categoryEn, description/descriptionEn, sortOrder, published, main image upload (preview, replace, remove), gallery upload (multi, remove each, drag-free simple list is fine), PDF upload (name shown, remove). Arabic labels, loading/empty/error states, server validation messages shown under fields.

**Public UI**:
7. New page `PastProjectsPage` at path `/past-works` (page key `pastWorks`): add to `App.tsx` `parsePath`/`getPathForRoute`/render (lazy like `ClientsPage`), `Navbar.tsx` `ROUTER_PAGES` and icon map, `CmsNavPage` union in `src/types/cms.ts`, a default nav item `{ id: 'nav-past-works', labelAr: 'أعمالنا السابقة', labelEn: 'Past Works', page: 'pastWorks', order: 3, enabled: true }` in `DEFAULT_NAV_ITEMS` (shift later `order` values up by one) and the same in `server/src/config/defaultCmsContent.ts`. Also make the admin CMS nav panel's page dropdown offer `pastWorks` (find where it lists pages). Note for the report: existing databases keep their stored nav, so the owner must add the link in the admin CMS nav panel on already-deployed instances.
8. Page content: heading + responsive card grid (image, title, category chip, short description), click opens a detail modal with the gallery (keyboard arrows/Escape), full description and a "تحميل ملف المشروع (PDF)" link when `pdfUrl` exists. English fields shown when the site language is English (fall back to Arabic when empty). Loading skeleton, empty state ("لا توجد أعمال سابقة حالياً"), error state with retry. Links to files only for allowed URL patterns. Images `loading="lazy"` with `alt` from the title.

## Out of scope
`schema.prisma`, migrations, other permissions, the `works` page, `src/data/properties.ts`, projects admin form, careers, deploy files, Footer, any change to `PERMISSION_*` lists.

## Constraints
No commits, no installs (node_modules exist), never read or write `.env*` except: for a manual smoke test you may `cp server/.env.example server/.env` in this worktree (never commit, delete at the end) then `npm --prefix server run db:push` and `db:seed`. Smoke-test ports: API `PORT=4012`, Vite `--port 5182` with `VITE_API_PROXY_TARGET=http://localhost:4012`. Free model only.

## Gates
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test` (all green; final counts). Manual smoke test in the browser: create two past projects (one with gallery + PDF, one minimal, one unpublished), see them in the admin list, reorder via sortOrder, see only the published ones on `/past-works`, open the modal, download the PDF, switch language; log in as a user WITHOUT the permission and confirm the admin section is hidden and the API answers 403. Describe what you saw.

## Report
Write `task-w2-pastprojects-report.md`: files changed, gate output (counts), smoke test observations, decisions, what you could not verify.
