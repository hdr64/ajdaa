# task-cms-d — CMS content for the Past Works page and the Careers intro

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.
> Run after `task-cms-b` is accepted (both change `cms.ts`, `cms.schema.ts`, `defaultCmsContent.ts`, `cmsService.ts`). Lowest priority of the four.

## 1. Goal
Two public pages have fixed copy: Past Works (`src/pages/PastProjectsPage.tsx` ~80-86: badge and title "أعمالنا السابقة / Past Works", subtitle, empty text) and the Careers application page (`src/pages/CareersPage.tsx` ~159-163: heading "قدّم على وظيفة" and the intro sentence, plus the success message ~140). Unlike works, clients and contact, they have no CMS section and no SEO fields. Make the copy and SEO editable, following exactly how `clientsPage` and `contact` are built.

## 2. Read first
`CLAUDE.md`, `docs/ADMIN-I18N.md`, `docs/architecture.md` (CMS, SEO shell), `src/types/cms.ts` (`CmsClientsPageContent`, `CmsContactPageContent`, `CmsSeoMeta`, `CmsSectionsPayload`), `server/src/schemas/cms.schema.ts` (~335), `server/src/config/defaultCmsContent.ts`, `server/src/services/cmsService.ts` (section keys, defaults merge, ~48, ~114, ~156), `src/services/cmsService.ts` (`CmsSectionKey`, ~6, ~32), `src/components/admin/cms/CmsClientsPanel.tsx` and `CmsContactPanel.tsx` (panel pattern, `sectionKey`, version modal, live preview), the admin CMS page that lists the panels, `src/seo/pageMeta.ts` and `server/src/services/seo/meta.ts` (how clients and contact SEO meta is read), `server/test/` CMS and seo tests.

## 3. Decided design
1. New CMS section keys `pastWorks` and `careers` in the key union, server schema, defaults, payload, client service and `CmsSectionsPayload`. Content:
   - `pastWorks`: `badgeAr/En`, `titleAr/En`, `subtitleAr/En`, `emptyTextAr/En`, `seo?: CmsSeoMeta`.
   - `careers`: `titleAr/En`, `introAr/En`, `successTitleAr/En`, `successTextAr/En`, `seo?: CmsSeoMeta`.
   Defaults equal today's literal strings so the public pages do not change until edited. Length limits in the style of the clients and contact schemas.
2. Public pages read from `useCmsContent()` / `useCmsText()` like `ClientsPage`; form labels, validation messages and buttons stay fixed.
3. Admin: two panels (`CmsPastWorksPanel`, `CmsCareersPanel`) built like `CmsContactPanel` (including SEO fields and versioning), registered wherever the other panels are, with the same permission as the other CMS panels. No new permission.
4. SEO: the server SEO shell and the client head hook use the new `seo` fields for the past-works and careers routes the same way they do for contact and clients (find the real routes in `src/seo/paths.ts`). If those pages are not covered by the shell today, do not add them; wire only what the clients/contact flow already wires, and say so in the report.
5. Old stored data: missing sections fall back to defaults (existing mechanism). No Prisma migration (JSON in `CmsSection`); state that in the report.

## 4. Tests
Extend CMS tests (do not edit existing assertions): both sections served with defaults when no row exists; save and read back; a version is created and rollback works; an invalid payload (over-length title) is rejected with 400. The `/api/cms/content` payload still validates against the client type.

## 5. Docs (same change)
`docs/api-reference.md`, `docs/architecture.md` (CMS section keys), `docs/CHANGELOG.md`.

## 6. Out of scope
The other three CMS prompts, career visibility settings (`CareersVisibilityPanel`), the job application form logic, the past-works data model.

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/`. Do not edit existing tests to fit new code. If Prisma's AI-safety guard blocks `npm --prefix server test`, stop and say so in the report; never pass a consent variable yourself. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`. Admin UI strings must exist in Arabic and English (`docs/ADMIN-I18N.md`; follow how the panel you edit already does it).

## Gates
`npm run lint` (baseline: 14 warnings, none new allowed), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-d-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with test counts, decisions you made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.
