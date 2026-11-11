# task-libfolders-e — Library page declutter: slim stats, table view, website cards, sort, bulk delete of unused files

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Never edit any `CLAUDE.md`.
> At the top of your report write `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:`, `Finished:`. Run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` as your very first and very last action for the two times.
> Master task: `libfolders`. Run only after steps a, b, c and d are reviewed and merged (you edit `LibraryView.tsx` and the media list route after them).

## 1. Goal and why

Even with folders the Library page is cluttered (owner screenshot 2026-11-11): four large stat cards push the files below the fold; the grid is mostly grey "FILE"/"VIDEO" placeholders, about 6 per row; zip-extracted sites show as repeated `index.html` / `b (a/index.html)` with a generic icon; 14 unused files cannot be cleaned up without deleting one by one; there is no sorting, no date, and long names are cut at the start (`...ita.S04E05`, unreadable in RTL).

## 2. Read first

`docs/ADMIN-I18N.md`, `src/components/admin/files/LibraryView.tsx` and `src/components/admin/files/library/*` (from step c: selection bar, folders), `src/services/mediaService.ts`, `server/src/routes/media.routes.ts` (`GET /`), `src/i18n/admin/files.ts`, `src/i18n/admin/media.ts`.

## 3. Decided design (no open choices)

1. **Slim stats strip.** Replace the four big stat cards with one compact row (about 48 px tall) of chips: total files, library size, linked, unused, and the disk bar with free/used text as a small inline element. Same data and same fetches as today. The "Unused N" chip is a button that sets the status filter to unused (orphaned); the "Linked N" chip sets it to linked. No data removed, only the presentation.
2. **Table view is the default** (list layout): columns checkbox, thumbnail or type icon (small), name, type, size, date, usage badge, actions; in flat search/filter mode also a Folder column. Use the existing list layout code if present and extend it. Keep the grid option, but make its cards compact (smaller placeholder area, 2 extra columns at wide widths). The chosen layout stays remembered the way `layoutMode` already is; only the default changes (existing stored choices win).
3. **Website cards/rows.** For `fileType === 'html'` rows whose `storageKey` contains `/` (extracted bundle): globe icon, a "Website" type label, title = the site name (the `originalName` without the trailing ` (<path>)`), second line = the entry path in small muted text. Loose `.html` files keep their plain name. Display-only; do not change stored data.
4. **Names and dates.** Show the full name wrapped to at most two lines with the full name in `title`; never cut the start of a name (remove the start-ellipsis behaviour). Show the created date (short, localised with the admin language) on cards and in the table.
5. **Sorting.** Server: `GET /api/media` gets optional `sort`: `newest` (default, today's order), `oldest`, `name` (A-Z by `originalName`, case-insensitive), `size` (largest first), zod-validated, applied in both the `status === 'all'` branch and the linked/orphaned branch (use the same ordering for the light id query). Client: a sort dropdown next to the search box, plus a page-size select (24, 48, 96; the server already caps `limit` at 100 so use 96 max). Add both to `fetchMediaList`.
6. **Bulk delete.** In the selection bar (step c) add **Delete selected** (in addition to Move): confirm dialog with the count and total size ("Delete N files (X MB)? Files used by a project cannot be deleted and will be skipped."); then call the existing `deleteMediaItem` for each selected id sequentially (max 200 per action), collect failures (the server answers 409 for files in use), and show one summary toast: `Deleted N, skipped M (in use)`. Refresh the list, stats and folders afterwards. Add a **select all on this page** checkbox in the table header and in the grid toolbar.
7. When the status filter is unused (orphaned), show a one-line banner above the list: "N unused files take X MB" (use the unused count and the sum of sizes of the loaded unused files if the total is not available; if only the page is known, say "on this page" instead of inventing a total) with a **Select all on this page** button. No automatic deletion of anything, ever.
8. i18n: all new strings in `src/i18n/admin/files.ts` or `media.ts`, ar and en, no hard-coded text, logical (RTL-safe) spacing.

## 4. Out of scope

Drag and drop; the picker modal; folder features (done in c); server changes other than the `sort` query; deleting anything automatically; changing how files are stored.

## 5. Constraints and gates

No commits, no installs, never edit any `CLAUDE.md`, no secrets. Files you may touch: `server/src/routes/media.routes.ts` (sort only), `src/services/mediaService.ts`, `LibraryView.tsx`, `src/components/admin/files/library/*`, the two i18n files, `docs/api-reference.md` (the `sort` query), `docs/CHANGELOG.md`. Gates: `npm --prefix server run build`, `npm run lint` (52 warnings baseline, none new), `npm run build`. Check in the running app in both languages at desktop and about 390 px width: stats strip, table and grid, website row, sort, select + bulk delete of a throwaway uploaded file, the in-use refusal path. Say honestly what you could not check. List wanted `CLAUDE.md` changes under `## CLAUDE.md proposals for Claude`.

Write your report to `D:\projects\html\ajda\docs\prompts\task-libfolders-e-report.md` (files changed, gate results, decisions made).

Run with a free OpenCode model: **Beam Free** (suggested). If it fails twice, split: (e1) stats strip + website rows + names/dates, (e2) sort + page size + bulk delete.
