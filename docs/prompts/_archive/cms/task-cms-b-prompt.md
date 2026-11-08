# task-cms-b — Fixed claims on works and contact pages, footer "made in KSA" control

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.

## 1. Goal
Three public texts are hard-coded or unreachable and the admin has no control: (a) badges "معتمد ومجهز / Certified & Equipped" and "جاهز ومجهز / Ready & Fitted" shown on every project card in `src/components/works/WorksPage.tsx`; (b) three trust bullets on the contact page (`ContactPage.tsx` ~142-144, including a "reply within 24 hours" promise); (c) the footer line `madeInKsa`: the CMS type, server schema and defaults all have `madeInKsaAr/En`, but the line is commented out in `Footer.tsx` (~310) and the footer admin panel has no input for it.

## 2. Read first
`CLAUDE.md`, `docs/ADMIN-I18N.md`, `docs/architecture.md` (CMS), `src/types/cms.ts`, `server/src/schemas/cms.schema.ts`, `server/src/config/defaultCmsContent.ts`, `server/src/services/cmsService.ts` (how stored content is merged with defaults), `src/services/cmsService.ts`, `src/components/admin/cms/CmsContactPanel.tsx`, `CmsFooterPanel.tsx`, `src/components/contact/ContactPage.tsx`, `src/components/common/Footer.tsx`, `src/components/works/WorksPage.tsx`, existing CMS tests in `server/test/`.

## 3. Decided design
1. **Works badges**: delete the unconditional "Certified & Equipped" (featured banner ~508) and "Ready & Fitted" (list cards ~717) chips and the `'سعات تخزين كبرى' / 'High-Capacity Storage'` fallback (~505; render nothing when the project has no units text). No new field.
2. **Contact trust bullets**: add to `CmsContactPageContent`: `trustEnabled: boolean` and `trustItems: { id: string; textAr: string; textEn: string }[]` (max 6 items, each text max 120 chars). Defaults keep today's three bullets and `trustEnabled: true`, so the public page looks the same until edited. Icons are not editable: cycle `[Zap, ShieldCheck, Headphones]` by index. `ContactPage` renders from the CMS and hides the block when disabled or empty. Admin: in `CmsContactPanel` add a card with the on/off switch and a list editor (add, edit AR/EN, remove), styled like the existing list editors in the CMS panels.
3. **Footer made-in-KSA**: add `madeInKsaEnabled: boolean` to the footer type, schema and defaults, default **false** (today it is hidden). Add the switch and the two text inputs (AR/EN, max 100) to `CmsFooterPanel`. Un-comment the line in `Footer.tsx` and render it only when enabled and the text for the language is non-empty.
4. **Old stored rows**: production `CmsSection` rows were saved before these fields existed. Rendering and `GET /api/cms/content` must fall back to the defaults for missing new fields (check how `cmsService` merges; if it does not merge field by field, add a minimal safe merge for these two sections). The zod schema must tolerate older payloads that omit the new fields only if the existing schema already follows that pattern; otherwise require them and make sure the admin panels always send them. No Prisma migration is needed (content is JSON in `CmsSection`); state that in the report.
5. **Copyright year**: replace the literal `© 2026` in `Footer.tsx` with the current year (`new Date().getFullYear()`).

## 4. Tests
Extend the existing CMS server tests (do not edit existing assertions): a contact payload with `trustItems` saves and reads back; more than 6 items or an empty/too-long text is rejected with 400; a stored contact/footer section without the new fields is served with the defaults; footer `madeInKsaEnabled` round-trips. Version history and rollback tests must still pass.

## 5. Docs (same change)
`docs/api-reference.md` (CMS payload fields), `docs/architecture.md` if it lists CMS fields, `docs/CHANGELOG.md`.

## 6. Out of scope
The project page (`task-cms-a`), the home map and featured banner (`task-cms-c`), Past Works and Careers copy (`task-cms-d`), any Prisma schema change.

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/`. Do not edit existing tests to fit new code. If Prisma's AI-safety guard blocks `npm --prefix server test`, stop and say so in the report; never pass a consent variable yourself. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`. Admin UI strings must exist in Arabic and English (`docs/ADMIN-I18N.md`; follow how the panel you edit already does it).

## Gates
`npm run lint` (baseline: 14 warnings, none new allowed), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-b-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with test counts, decisions you made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.
