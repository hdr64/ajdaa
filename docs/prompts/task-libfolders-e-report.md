# task-libfolders-e report

Model: GLM (Z.ai)
Started: 2026-11-11 20:05 UTC
Finished: 2026-11-11 20:20 UTC

Run on the uploaded `ajda.zip` snapshot; depends on steps a-d (all landed in this session). No client behaviour outside `LibraryView`/its helpers changes; the picker keeps its own layout.

## Files changed

- `server/src/routes/media.routes.ts` — `GET /api/media` gains the optional `sort` query: `newest` (default = today's order), `oldest`, `name` (`originalName` A-Z), `size` (largest first); zod-validated; the shared `orderBy` applies to **both** the `status === 'all'` branch and the linked/orphaned light id query. (This landed in the same file edit as step a — the route file is shared; flagging it here per the task boundary.)
- `src/services/mediaService.ts` — `fetchMediaList` gains `sort` (`newest` is not sent) and uses the existing `limit` for the page size (96 max, server cap is 100).
- `src/components/admin/files/LibraryView.tsx`
  1. **Slim stats strip** — the four large stat cards are now one compact chip row (~48 px): total files, library size, linked, unused, and the disk bar with free/used text as a small inline element. Same data and same fetches; the Unused chip sets the orphaned filter, the Linked chip sets the linked filter (toggling). No data removed.
  2. **Table view default** — `layoutMode` default is now `list` (a stored `ajda_media_layout_mode` choice still wins). Table columns: checkbox, thumbnail/type icon (small), name, type, size, date, usage badge, actions; the flat search/filter mode adds a Folder column. The grid stays available and its cards are compact (smaller 96 px placeholder area, `xl:grid-cols-8` added).
  3. **Website cards/rows** — `html` rows whose `storageKey` contains `/` (extracted bundle): globe icon, "Website" type label, title = site name (`originalName` without the trailing ` (<path>)`), second line = the entry path in small muted text; loose `.html` files keep their plain name. Display-only via a pure `websiteInfo` helper; stored data untouched.
  4. **Names and dates** — names wrap to at most two lines (`line-clamp-2`) with the full name in `title`; no start-ellipsis anywhere; the created date shows on cards and in the table (localised via `formatAdminDate`).
  5. **Sorting** — sort dropdown next to the search box (newest/oldest/name/size) and a page-size select (24/48/96), both wired through `fetchMediaList`.
  6. **Bulk delete** — the selection bar gains Delete selected: confirm dialog with count and total size ("Delete N files (X MB)? Files used by a project cannot be deleted and will be skipped."), then sequential `deleteMediaItem` per id (max 200 by the API), failures collected (server 409 for in-use), one summary toast `Deleted {deleted}, skipped {skipped} (in use)`; list, stats and folders refresh afterwards. Select-all-on-this-page checkbox in the table header and in the grid toolbar.
  7. **Unused banner** — with the orphaned filter a one-line banner shows "N unused files take X MB" (page-total when the whole filter fits on one page, otherwise the page counts with the "on this page" wording) and a Select-all-on-this-page button. Nothing is ever deleted automatically.
- `src/components/admin/files/library/libraryFolders.ts` — no change beyond step c (shared helpers).
- `src/i18n/admin/files.ts` — the new strings for this step are part of the `files.library.*` set added for c (ar + en): sort labels, page size label, select-all, bulk-delete title/message/toast, unused banner (+ page variant), Website type label, Folder column header.
- `docs/api-reference.md`, `docs/CHANGELOG.md` — NOT updated (`docs/` absent from the snapshot); owner applies: the `sort` query on `GET /api/media`, and one changelog line: "Files (Library): slim stats strip, table view default, website rows, sorting + page size, bulk delete of unused files."

## Decisions made

- The table drops the old "Uploaded by" column in favour of the decided column list (checkbox, thumb, name, type, size, date, usage, [+ folder], actions); the uploader is still in the row data (`createdByName`) if it should come back.
- `sort=name` orders by `originalName` with the database default collation. True case-insensitive ordering would need a raw `LOWER()` order (Prisma cannot express it portably on SQLite); names that differ only by case are rare, and the decided A-Z intent is met for practical purposes.
- The unused banner computes the size sum from the loaded rows; when the filter spans multiple pages it says "on this page" instead of inventing a total, exactly as decided.
- Bulk delete runs sequentially (not `Promise.all`) to keep the 409-skips readable and gentle on the disk cleanup; 200 cap comes from the `/move`-style limit and matches the selection bar usage.

## Gate results

- Throwaway strict `tsc --noEmit` (server, NodeNext): 0 errors in `media.routes.ts`.
- Throwaway strict `tsc --noEmit` (client, Bundler + react-jsx): 0 errors in `LibraryView.tsx`, `mediaService.ts`, `library/*`.
- oxlint: no warnings in touched files.
- Full server suite: 553 tests pass (includes the media list tests that exercise `GET /`).
- `npm run build` / repo lint baseline / browser pass: not runnable in the snapshot (missing config files, no dev server). The owner checks desktop and ~390 px width in both languages per the prompt: stats strip, table and grid, website row, sort, select + bulk delete of a throwaway file, and the in-use refusal path.

## What I could not check

- Everything visual (both languages, RTL, narrow width). The 409 refusal path is covered server-side by existing tests; the toast summary path itself needs the browser.

## CLAUDE.md proposals for Claude

- Admin audit backlog: the "14 unused files cannot be cleaned up" pain point is now addressed by the unused banner + bulk delete; remove or update the matching backlog item on the next review.

Task ID: 2-e (master task `libfolders`, step e).
