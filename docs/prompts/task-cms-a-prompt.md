# task-cms-a — Project page: remove the fake amenities block, fix untranslated and false text

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` for `Started:`. Last action: the same for `Finished:`.

## 1. Goal
`src/pages/ProjectDetailPage.tsx` shows a hard-coded six-card block (`PROJECT_AMENITIES`, lines ~33-40 and ~692-712) on **every** project: super deluxe finishing, smart security, shaded parking, central AC, landscaping, structural warranties. The admin cannot edit or hide it, and it is false for most projects (logistics, commercial). The project already has an editable, per-project, bilingual `features` list (admin card "features" in `ProjectEditSection.tsx`) rendered by the block just above it, so the correct fix is to **delete the hard-coded block**, not to add a second field. Fix the other untranslated or unverifiable text on the same page.

## 2. Read first
`CLAUDE.md`, `src/pages/ProjectDetailPage.tsx`, `src/types/property.ts`, `src/i18n/translations.ts` (the `amenities` array near line 285), `src/pages/admin/sections/ProjectEditSection.tsx` (location highlights and features cards), `server/src/services/serializers.ts`, `server/prisma/seed-data/projects.seed.ts`.

## 3. Decided design
1. Delete `PROJECT_AMENITIES`, its `<Reveal>` block, and every import that becomes unused (`Building2`, `ShieldCheck` if unused elsewhere in the file).
2. In `translations.ts` find the `amenities` array (Arabic and, if present, the English twin). Grep for its use (`.amenities`). If nothing reads it, delete it from every language object and from any type that declares it. If something reads it, stop and report instead of guessing.
3. **Location highlights**: the page renders only `locationHighlightsAr`, even in English. Render `locationHighlightsEn` when the language is English and that list is non-empty, else fall back to the Arabic list. Show the section when the list for the active language (after the fallback) is non-empty. Check `Property` has `locationHighlightsEn`; add it to the type if the API already returns it (see serializers).
4. **"4K" claims**: nothing in the data says the video is 4K. Remove the claim: the "4K" chip on the video tab (~line 411), "فيديو تعريفي 4K" / "4K Video", "فيديو 4K" / "Video", "مشاهدة جولة الفيديو 4K" / "Watch 4K Tour", "Official 4K Showcase", "عرض سينمائي 4K" / "Cinema Mode 4K". New wording: drop only the "4K" token (e.g. "فيديو تعريفي", "Video", "Watch Video Tour", "Official Showcase", "Cinema Mode"). Delete the standalone "4K" chip element.
5. **Floors and units text** (~line 573): the floors count text and the fallback `'متعدد الوحدات'` are Arabic-only. English: `N floor(s)` (singular for 1) and `Multiple units`. Arabic: 1 → "دور واحد", 2 → "دوران", 3-10 → "N أدوار", else "N دورًا". If `Property` has an English units field (`unitsEn` / `unitsCountEn`) use it in English before the fallback.
6. **Unit cards**: unit `features` are shown Arabic-only. Where the type has an English counterpart (`featuresEn`, `typeEn`, `sectionEn`, `descriptionEn`), use it when the language is English and it is non-empty, else the Arabic value. Only use fields that already exist in the type and API; add nothing to the schema.

## 4. Tests / verification
No new server tests are needed. Add a client-side test only if the repo already has a test setup for pages (check; do not add a test framework). Describe in the report how you checked each point and which project fields drive each text. If you can run the dev server, open a project in Arabic and English and say what you saw; if you cannot, say so.

## 5. Docs
`docs/CHANGELOG.md` entry. Nothing else.

## 6. Out of scope
Schema, migrations, new admin fields, the works and contact pages, the home map (separate prompts `task-cms-b`, `task-cms-c`).

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/`. Do not edit existing tests to fit new code. If Prisma's AI-safety guard blocks `npm --prefix server test`, stop and say so in the report; never pass a consent variable yourself. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`. Admin UI strings must exist in Arabic and English (`docs/ADMIN-I18N.md`; follow how the panel you edit already does it).

## Gates
`npm run lint` (baseline: 14 warnings, none new allowed), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-a-report.md`, top lines `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, gate results with test counts, decisions you made, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.
