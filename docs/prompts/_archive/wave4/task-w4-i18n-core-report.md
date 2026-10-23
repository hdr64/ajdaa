# Task w4-i18n-core report

## Files changed

### New infrastructure (`src/i18n/admin/`)
- `core.ts` — `defineStrings`, `AreaStrings`, `TranslateFn`, `translateAdmin`, `translateCurrent`, `documentLanguage`, `adminLocale`, `AR_LOCALE`, `EN_LOCALE`, `TranslationParams`.
- `common.ts`, `layout.ts`, `dashboard.ts`, `charts.ts` — filled areas.
- 17 empty pairs for the later lanes: `projects`, `projectEdit`, `floorplan`, `inquiries`, `applications`, `categories`, `pastProjects`, `cms`, `users`, `roles`, `departments`, `settings`, `mail`, `newsletter`, `profile`, `feedback`, `auth`.
- `index.ts` — aggregates all 21 areas, exports `adminStrings`, `AdminArea`, `AdminKey`.
- `useAdminT.ts` — `useAdminT()` hook returning `{ t, language, isAr, dir, locale }`.

### New component
- `src/components/admin/layout/AdminLanguageToggle.tsx` — segmented AR/EN pill.

### Modified (owned files)
- `src/App.tsx` — typed toast state `{ message, kind }`, timer replacement, `ToastView` per kind, `parsePath` keeps original case for `adminPath`.
- `src/pages/admin/adminContextDef.ts` — `showToast(message, kind?)`, `ToastKind`, `AdminToast`, `TOAST_DURATION_MS`.
- `src/pages/admin/adminFormat.ts` — locale from document language; `formatRelativeTime` via `translateCurrent`.
- `src/pages/admin/adminRoutes.ts` — case-insensitive `parseAdminPath`.
- `src/pages/admin/projectLabels.ts` — `PROJECT_TYPE_KEYS` / `UNIT_STATUS_KEYS` / `PUBLISH_STATUS_KEYS`; `completenessIssues(project, t)`; AR constants derived from the i18n source.
- `src/pages/admin/AdminDashboardPage.tsx` — `SECTION_META` reduced to permission; titles/subtitles/document title via `t`; toast kinds; `onShowToast` typed.
- `src/components/admin/layout/AdminSidebar.tsx`, `AdminPageHeader.tsx`, `NotificationsBell.tsx`, `inquiryNotifications.ts` — fully translated.
- `src/components/admin/common/{ConfirmDialog, DataTable, SectionState, ViewSwitcher, dataTableTypes, viewModes}.tsx/ts` — translated.
- `src/components/admin/charts/{chartParts, UnitStatusChart, InquiriesTrendChart}.tsx` — translated; empty state for all-zero inquiry trend.
- `src/pages/admin/sections/OverviewSection.tsx` — translated.

## Key counts per area file (AR keys)
- `common.ts`: 72
- `layout.ts`: 58
- `dashboard.ts`: 62 (incl. 16 section title/subtitle pairs + overview block)
- `charts.ts`: 17
- empty pairs: 0 each (21 areas total)

## Gates
- `npm run lint`: 0 warnings/errors (exit 0).
- `npm run build` (`tsc -b && vite build`): success.
- Browser verification: not performed — no browser available in this environment. Smoke-tested the dev server + API locally (vite on 5185, API on 4000): both booted; `/admin/pastProjects` returned the SPA shell. I did not manually click through sidebar/header/dashboard in AR+EN, the language toggle persistence, the confirm dialog focus trap, or the toast kinds/timings. Those need a human/browser pass.

## Decisions the lanes must know
- Keys are `<area>.<dotted.key>`; the lane fills its empty area file and new keys become available on `AdminKey` immediately (compile-checked English parity).
- Translation hook: `const { t } = useAdminT();` from `src/i18n/admin/useAdminT`. Outside React use `translateAdmin(language, key, params)` or `translateCurrent(key, params)`.
- Locale for dates/numbers: `adminLocale(language)` (`ar-SA-u-ca-gregory-nu-latn` / `en-GB`); `adminFormat.ts` reads it from `<html lang>` automatically, so existing callers need no changes.
- Enum label maps: `PROJECT_TYPE_KEYS` / `UNIT_STATUS_KEYS` / `PUBLISH_STATUS_KEYS` in `projectLabels.ts` map enum → `AdminKey`; resolve with `t(...)` at render. The `*_LABELS_AR` constants remain (stored Arabic data defaults) and are derived from the i18n source.
- `completenessIssues(project, t)` now takes `t`; default falls back to the document language.
- Toasts: `showToast(message, 'error' | 'info')`; default success. Failure paths pass `'error'`.
- Confirm dialog: focus trap + Esc + backdrop + restore focus already implemented; safe (cancel) button is focused first.
- `parsePath`/`parseAdminPath` are case-insensitive for section keys; `adminPath` keeps original case.
- `formatRelativeTime` keeps the original Arabic wording via `common.time.*` keys.
- Language pill labels (`العربية`, `EN`) are endonyms and are not translated keys.

## Known issues / risks
- `AdminLanguageToggle` sits on its own row above the footer icon grid (the uniform 5-column grid could not fit a text pill at the 44 px touch-target minimum).
- `EmptyState`, `InquiryStatusSelect`/`WhatsAppLink` (out of scope) still carry Arabic literals; lanes own them.
- `PRICE_TYPES` stays Arabic because those are stored enum values (not display labels).
- Browser verification not run (see above).