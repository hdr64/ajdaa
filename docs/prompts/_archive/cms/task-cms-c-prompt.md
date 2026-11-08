# task-cms-c — Home map regions from real data, featured-banner hint

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.

## 1. Goal
`src/components/home/InteractiveProjectsMap.tsx` has a region filter hard-coded to two cities with fixed counts: "الرياض (6)" / "Riyadh (6)" and "الأحساء (1)" / "Al-Ahsa (1)" (~783, ~793), and filter logic `p.city !== 'الرياض'` / `'الأحساء'` (~273-274). Counts go stale as soon as a project changes, and a project in any other city has no filter. Also: the works page featured banner silently falls back to a project whose badge contains "رئيسي" (`WorksPage.tsx` ~208-215) and the admin is not told.

## 2. Read first
`CLAUDE.md`, `src/components/home/InteractiveProjectsMap.tsx` (the `RegionFilter` type, `selectedRegion`, any map camera or fly-to code tied to regions), `src/components/works/WorksPage.tsx` (~205-216), `src/components/admin/cms/CmsWorksPanel.tsx` (~250-270, the featured project selector), `docs/ADMIN-I18N.md`.

## 3. Decided design
1. **Regions from data**: build the region list from the distinct `city` values of the loaded projects (key = the Arabic `city` string; label = `cityEn || city` in English, `city` in Arabic), sorted by project count descending, then name. Each chip shows its real count. Keep the "all regions" chip first with the total. Filtering compares `p.city === key`. Remove the `'riyadh' | 'ahsa'` literals and hard-coded counts.
2. **Map camera**: if the code moves the camera per region, keep the two existing presets for those two Arabic city names; for every other city fit the map bounds to that city's projects (or reuse the existing "fit all" helper on the filtered subset). Do not break the existing behaviour for Riyadh and Al-Ahsa. `selectedRegion` becomes a string; a stale key (city no longer present after data reloads) must reset to "all".
3. **Hard-coded text**: "فيديو 4K" / "Video 4K" (~984) loses the "4K" token (nothing in the data says 4K): "فيديو" / "Video". `selectedProject.units || 'متعدد'` (~1084): English fallback "Multiple", and use an English units field if the `Property` type has one.
4. **Featured banner**: do **not** change the selection logic (pinned `featuredProjectId` first, then badge "رئيسي", then the first project). Instead add a one-line hint under the featured-project selector in `CmsWorksPanel`, Arabic and English: when no project is pinned, the page shows the first project whose badge contains "رئيسي", otherwise the first project. Use the panel's existing i18n approach.

## 4. Tests / verification
Extract the region-building logic into a small pure function (same folder or `src/utils/`) and unit test it if the repo has a client test runner; if not, do not add one, and describe in the report how you verified it (inputs and outputs). Cases: two cities, three cities with counts, a project with no `cityEn`, an empty project list, a stale selected region.

## 5. Docs
`docs/CHANGELOG.md`.

## 6. Out of scope
Project page, works-page badges, contact and footer (other prompts), schema, map styles and Google Maps key handling.

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/`. Do not edit existing tests to fit new code. If Prisma's AI-safety guard blocks `npm --prefix server test`, stop and say so in the report; never pass a consent variable yourself. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`. Admin UI strings must exist in Arabic and English (`docs/ADMIN-I18N.md`; follow how the panel you edit already does it).

## Gates
`npm run lint` (baseline: 14 warnings, none new allowed), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-c-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with test counts, decisions you made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.
