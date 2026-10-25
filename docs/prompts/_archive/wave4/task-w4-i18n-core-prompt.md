# Task w4-i18n-core — admin i18n infrastructure, admin shell, shared feedback, UI-review fixes

Run first. The three translation lanes (`task-w4-i18n-l1/l2/l3-prompt.md`) start only after this is reviewed and merged.

## Goal
1. Build the admin translation mechanism exactly as specified in `docs/ADMIN-I18N.md`.
2. Translate (AR+EN) the admin shell and shared pieces: layout, common components, dashboard page, overview, charts, formatting helpers.
3. Add an admin language toggle.
4. Add typed toasts (success / error / info) and fix the UI-review findings listed below.

## Read first
`docs/ADMIN-I18N.md` (whole, it is the design), `docs/MASTER-PLAN.md`, `src/context/LanguageContext.tsx`, `src/context/languageContextDef.ts`, `src/pages/admin/AdminDashboardPage.tsx`, `src/pages/admin/adminContextDef.ts`, `src/pages/admin/adminRoutes.ts`, `src/pages/admin/adminFormat.ts`, `src/pages/admin/projectLabels.ts`, `src/pages/admin/sections/OverviewSection.tsx`, `src/components/admin/layout/*`, `src/components/admin/common/*`, `src/components/admin/charts/*`, `src/App.tsx` (toast, `parsePath`).

## Decided design
### A. Infrastructure (`src/i18n/admin/`)
- `core.ts`: `defineStrings`, types, `translateAdmin`, interpolation, dev warning for a missing key.
- One file per area listed in the spec, created now. Areas owned by the later lanes are created as empty pairs (`defineStrings('users', {}, {})`) so the lanes only fill them. `index.ts` aggregates; `useAdminT.ts` is the hook.
- Language comes from `useLanguage()`. The admin root sets `dir` and `lang` from it (the `LanguageProvider` already sets `<html dir lang>`; verify the admin shell follows it and do not duplicate).

### B. Language toggle
- A small `AdminLanguageToggle` (pill "العربية | EN", same visual weight as the dark-mode button) in the sidebar footer button row (`AdminSidebar.tsx`), and on the login page header corner only through the existing `LanguageToggle` if it already renders there (do not touch login in this task). It calls the existing `setLanguage`.

### C. Translate these files completely (both languages, all strings incl. aria-labels, titles, placeholders, empty states, tooltips)
`src/components/admin/layout/*`, `src/components/admin/common/*` (ConfirmDialog default labels, DataTable, EmptyState, SectionState, ViewSwitcher), `src/components/admin/charts/*`, `src/pages/admin/AdminDashboardPage.tsx` (SECTION_META titles/subtitles become keys; `document.title` too), `src/pages/admin/sections/OverviewSection.tsx`, `src/pages/admin/projectLabels.ts` (functions taking `t`), `src/pages/admin/adminFormat.ts` (locale from language). Areas: `common`, `layout`, `dashboard`, `charts`.
- Sidebar group titles and item labels from the glossary.
- Dashboard weekly interest chart: when all values are 0 show an explicit empty state ("No inquiries in the last 12 weeks") instead of an empty plot.

### D. Typed toasts
- `showToast(message: string, kind: 'success' | 'error' | 'info' = 'success')` in `adminContextDef.ts`, `AdminDashboardPage.tsx` (its `onShowToast` prop and wrapper) and `App.tsx` (state becomes `{ message, kind }`). Render per kind as in the spec (icon `CheckCircle2` / `AlertCircle` / `Info`, border colour from existing tokens `success`, `danger`/red, `accent`; check the CSS variables that exist). Error toast duration 6 s, others 3.5 s; a new toast replaces the previous one and clears the old timer. `role="status"` (error: `role="alert"`), `aria-live`.
- Update the existing callers in `AdminDashboardPage.tsx` that report failures (for example "could not refresh") to pass `'error'`. Other callers keep working unchanged (default success); the lanes will classify theirs.

### E. UI-review fixes in files owned by this task
1. `src/App.tsx:59`: `parsePath` lowercases the path, so `/admin/pastProjects` never matches the section key and falls back to overview (reload/bookmark of that page is broken). Fix by lowercasing only for the page matching, not for `adminPath` (extract `adminPath` from the original-case path), AND make `parseAdminPath` compare case-insensitively against `SIMPLE_SECTIONS`. Check every other admin route still parses (`projects/:id`, `projects/:id/edit`, `projects/:id/units`, `login`).
2. Focus: dialogs rendered by `ConfirmDialog` must trap focus, focus the safe (cancel) button first for `danger`, restore focus on close, and close on Esc and backdrop (verify what exists, add only what is missing).

## Out of scope
Everything under `src/components/admin/{cms,users,settings,hr,projects,floorplan,profile,feedback,pastProjects,applications,auth}`, `src/components/admin/*.tsx` in the folder root, `src/pages/admin/sections/*` except `OverviewSection.tsx`, `AdminLoginPage.tsx`, any server file, public site pages. The lanes translate those. Do not touch `src/i18n/translations.ts` (public site).

## Constraints
No commits, no installs, no new dependencies, do not touch `.env*`. Keep LF line endings. Match surrounding style and comment density.

## Gates
`npm run lint` (no new warnings), `npm run build`. In the browser (`npx vite --port 5185`, API on 4000 is already running; log in with the local seed admin from `server/prisma/seed.ts`): sidebar, header, dashboard and overview in Arabic and English; toggle switches language and direction instantly and persists after reload; `/admin/pastProjects` opens directly and after reload; trigger a delete confirm and an error toast (for example refresh with the API stopped, or an invalid 3D URL in the project editor) and check icon/colour/duration; check LTR layout has no broken alignment on sidebar, header, dashboard cards and the data table. Stop the dev server afterwards.

## Report
Write `task-w4-i18n-core-report.md`: files changed, key counts per area file, gate results, what you verified in the browser, decisions made, anything the lanes must know (naming patterns you chose for keys, helpers you added).
