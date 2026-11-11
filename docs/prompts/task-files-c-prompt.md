# task-files-c: merge the Drive and Media library pages into one "Files" page

Report: `D:\projects\html\ajda\docs\prompts\task-files-c-report.md`. At the top write `Model:` (the model you run as, `unknown` if unknown), `Started:` and `Finished:` from a real clock command (`Get-Date -Format "yyyy-MM-dd HH:mm:ss"`) run as your first and last action.

Prerequisite: task-files-b is merged (Drive uploads use `useUploadManager().uploadFiles(files, { target, relPaths })`). Check with `grep`; if it is not merged, stop and say so in the report.

Read first: `CLAUDE.md` (secrets, i18n), `docs/ADMIN-I18N.md`, `src/pages/admin/adminRoutes.ts`, `src/pages/admin/AdminDashboardPage.tsx` (section switch near line 385, `pageTitle`), `src/components/admin/layout/AdminSidebar.tsx`, `src/i18n/admin/layout.ts`, `src/i18n/admin/dashboard.ts` (`dashboard.section.<name>.subtitle` keys), `src/pages/admin/sections/MediaSection.tsx` (about 1000 lines), `src/pages/admin/sections/DriveSection.tsx` (about 770 lines), `src/components/admin/drive/*`, `src/i18n/admin/media.ts`, `src/i18n/admin/drive.ts`, `src/i18n/admin/files.ts` (created by files-b).

## Goal
One admin page, "Files" / "الملفات", with two sections the admin switches between: **Drive** (private, folders, trash, share links) and **Library** (public, flat, usage tracking, slugs). No data or API change. Library features stay as they are; Drive gains the library's layout switch and type filter.

## Decided design
1. **Page and routes.** New `src/pages/admin/sections/FilesSection.tsx` renders a header row with a segmented switch `Drive | Library` and the matching view. New admin section `files`. In `adminRoutes.ts` add `'files'` to `AdminSection` and `SIMPLE_SECTIONS`. Keep `media` and `drive` URLs working as aliases: `/admin/media` opens Files on the Library tab, `/admin/drive` opens Files on the Drive tab, `/admin/files` defaults to Drive, `/admin/files/library` and `/admin/files/drive` are the canonical paths. Make `parseAdminPath` return `{ section: 'files', filesTab: 'library' | 'drive' }` (add `filesTab?` to `AdminLocation`) and update the path builder so `files` plus the tab round-trips. Switching tabs updates the URL with the same navigation function other sections use (find it; do not invent a new history mechanism). Remove `media` and `drive` from `AdminSection` only if nothing else needs them (`tsc` lists every `switch` to fix).
2. **Sidebar.** One item `files` (icon `FolderOpen`, permission `manageMedia`, label key `layout.nav.files` = "Files" / "الملفات") replaces the two entries `media` and `drive`. Remove the unused `layout.nav.media` and `layout.nav.drive` keys only if nothing else uses them (grep). Add `dashboard.section.files.subtitle` and use the existing mechanism for `pageTitle`. Any other code that links to the media section (grep `'media'`, `section: 'media'`, `/admin/media`) must land on the Library tab.
3. **Split the two big components into views, behaviour unchanged.** Move the body of `MediaSection` to `src/components/admin/files/LibraryView.tsx` (`export const LibraryView`) and the body of `DriveSection` to `src/components/admin/files/DriveView.tsx` (`export const DriveView`), with their local helpers. `MediaSection.tsx` and `DriveSection.tsx` are deleted and the imports in `AdminDashboardPage.tsx` updated. Do not rewrite logic while moving: move first, run `npm run build`, then make the other changes.
4. **Tab state.** Render only the active view (unmount the other); do not lift state, each view fetches its own data as today. Remember the last tab in `localStorage` under `ajda_files_tab` (wrapped in try/catch) and use it only when the URL has no explicit tab.
5. **Drive gets the library's layout switch.** In `DriveView` add the grid/list toggle (same buttons and look as `LibraryView`, persisted in `localStorage` key `ajda_drive_layout_mode`, default `list` = today's layout). Grid mode: cards in `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`; a folder card with the folder icon and name; a file card with the kind icon (`KIND_ICON`), name, size, a "Shared" badge when `isPublic`; the checkbox in the top corner; the same three-dot menu as the list. No image thumbnails (Drive files are private and need an authenticated fetch). Reuse `menuItems(row)`, `selected` and `toggleSelect`; do not duplicate them.
6. **Drive gets the library's type filter.** A row of buttons under the toolbar: All, Images, Videos, PDF, Other (keys `files.filter.*`), filtering the loaded rows client-side by `DriveFile.kind` (`image`, `video`, `pdf`, everything else = other). Folders are visible only under "All". Select-all and counts follow the filtered rows.
7. **Storage warning in both views.** `LibraryView` keeps its disk bar and low-space banner. Extract the banner markup into `src/components/admin/files/StorageWarning.tsx` and use it in `LibraryView` and also in `DriveView` (shown when `fetchStorageStats().isLowSpace`; reuse the `media.warning.lowDiskSpace*` and `media.stat.freeLeft` keys). Do not copy the markup.
8. **i18n.** All new text in `src/i18n/admin/files.ts` (ar and en, same key set), no hard-coded Arabic in `.tsx`. Keep the existing `media.*` and `drive.*` keys in place (no mass renaming).

## Out of scope
Server code, the picker (task-files-d), moving files between Drive and Library, changing the upload manager, a folder-size view, Drive thumbnails.

## Constraints
No commits, no installs, no edits to any `CLAUDE.md` (propose changes in the report under `## CLAUDE.md proposals for Claude`). Lint baseline 46 warnings, none new.

## Gates
`npm run lint`, `npm run build`, `npm --prefix server run build` (nothing should change there). Do not run `npm --prefix server test`. In the report list every file moved, deleted or changed, gate results, decisions, and what you could not check in a browser (Claude does the browser pass in both languages).

Run with a free OpenCode model: Beam Free. If it struggles, split into two runs: steps 1-4 first, then 5-8.
