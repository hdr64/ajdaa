# task-libfolders-c — Library folders: browse, create, rename, move, delete in the admin UI (client only)

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Never edit any `CLAUDE.md`.
> At the top of your report write `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:`, `Finished:`. Run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` as your very first and very last action for the two times.
> Master task: `libfolders`. Run only after `task-libfolders-a` is reviewed; you code against its API (section 3.1). May run in parallel with step b (server files, disjoint). Step d follows you (it edits `LibraryView.tsx` after you).

## 1. Goal and why

The Library tab of the Files page shows one flat grid (see `src/components/admin/files/LibraryView.tsx`, 1000+ lines). Let the admin **organise it into folders**, like the Drive tab already does, including a way to sort the ~40 files that are already there: select several files and move them into a folder.

## 2. Read first

`docs/ADMIN-I18N.md` (translation rules; ar and en), `src/components/admin/files/LibraryView.tsx`, `src/components/admin/files/DriveView.tsx` (breadcrumb ~667-690, folder tiles, menus, toasts, confirm dialogs), `src/components/admin/drive/DriveDialogs.tsx` (`DriveNameDialog`, `DriveFolderPicker`: you reuse these), `src/services/mediaService.ts`, `src/i18n/admin/files.ts` and `src/i18n/admin/media.ts`.

## 3. Decided design (no open choices)

### 3.1 API you code against (built in step a)

`GET /api/media/folders` -> `{ folders: [{ id, name, parentId, fileCount, createdAt }] }` · `POST /api/media/folders` `{ name, parentId? }` · `PATCH /api/media/folders/:id` `{ name?, parentId? }` · `DELETE /api/media/folders/:id` -> `{ success, movedFiles, movedFolders }` (files are never deleted, they move up one level) · `POST /api/media/move` `{ ids, folderId | null }` -> `{ moved }` · `GET /api/media` gains `folder=all|root|<id>`; items carry `folderId`. Server errors come as `{ error }`; show them with the existing `getErrorMessage` pattern.

### 3.2 Service (`src/services/mediaService.ts`)

Add `MediaFolderDto`, `fetchMediaFolders`, `createMediaFolder`, `updateMediaFolder`, `deleteMediaFolder`, `moveMediaFiles`, add `folderId` to `MediaFileDto`, and an optional `folder` param to `fetchMediaList`. Same `api` helper and error style as the neighbours. The picker (`MediaPickerModal.tsx`) must keep working unchanged: do not touch it, and `fetchMediaList` without `folder` must send nothing new.

### 3.3 Behaviour in `LibraryView`

- **Reuse Drive's folder UI, do not write parallel copies (owner decision 2026-11-11: no duplicated folder UI).** Exactly this, nothing wider:
  1. `DriveNameDialog` (`src/components/admin/drive/DriveDialogs.tsx`) is already generic (title, initial, confirmLabel, onSubmit): import and use it as is for "New folder" and "Rename".
  2. `DriveFolderPicker` (same file) is hard-wired to `fetchDriveFolders`. Add optional props, defaults keep Drive byte-for-byte unchanged: `loadFolders?: () => Promise<DriveFolderNode[]>` (default `fetchDriveFolders`), `rootLabel?: string` (default the current `drive.dialog.target.root` text, also used in the "current target" line), and `createFolder?: (name: string, parentId: string | null) => Promise<DriveFolderNode>`. When `createFolder` is given, show a small "New folder here" button in the picker (it opens `DriveNameDialog`; on success reload the list and navigate into the new folder). The Library passes `loadFolders` (maps `MediaFolderDto` to `{ id, name, parentId }`), its own `rootLabel`, and `createFolder` (calls `createMediaFolder`); Drive passes none of the three. The same picker serves moving files and moving folders (`blockedIds` = the moved folder, descendants are blocked by the picker itself).
  3. Extract the breadcrumb `<nav>` of `DriveView.tsx` (around lines 667-690) into `src/components/admin/files/FolderBreadcrumb.tsx` with props `{ rootLabel: string; crumbs: { id: string; name: string }[]; onOpen: (id: string | null) => void }`; `DriveView` uses it with identical markup and behaviour, then the Library uses it too.
  4. The folder tile is NOT extracted (Drive's rows mix files and folders in one inline map; refactoring it is risky). Write one small new `FolderTile.tsx` in `src/components/admin/files/library/` in the same visual style (amber `Folder` icon, same card and list classes as the neighbouring Library cards).
  5. Pure helpers `src/components/admin/files/library/libraryFolders.ts` (children of, path of, descendants). Put nothing else new in `LibraryView.tsx` than wiring.
  Do not otherwise change `DriveView.tsx` or `DriveDialogs.tsx`; after your edit the Drive tab must look and behave exactly as before (check it in the app: create, rename, move dialog, breadcrumb).
- **Location state** `folderId: string | null` (null = root), kept in component state.
- **Browse mode** (no search text, type filter `all`, status filter `all`): show the breadcrumb (`Library > A > B`, each crumb clickable), then the folder tiles of the current folder (grid or list like the files), then the files with `folder=root` or `folder=<id>`. Folders come from one `fetchMediaFolders()` call (not paginated) and are re-fetched after every folder or move action and after an upload completes.
- **Search / filter mode** (search text, or a type filter, or a status filter is set): flat results across all folders (`folder=all`), no folder tiles, and a one-line hint "Showing results from all folders" with a button to clear the filters. Each file card in this mode shows its folder path as a small chip when it has one.
- **New folder** button in the toolbar (`DriveNameDialog`, creates in the current folder). Errors (409 duplicate etc.) are shown by the dialog (it already shows errors thrown from `onSubmit`).
- **Folder tile**: icon, name, file count; click opens it; menu: Rename (modal), Move to... (opens the move dialog in folder mode), Delete (confirm text: files inside are kept and move up one level; nothing is deleted from the library).
- **Selection**: a checkbox on each file card/row (both layouts, visible on hover and always when anything is selected); when at least one is selected a sticky action bar shows "N selected", **Move to folder**, **Clear**. Selection resets on folder change, filter change and page change.
- **Move dialog** = the generalised `DriveFolderPicker` (see above), opened with `startId` = the current folder. One flow for files (`moveMediaFiles`) and for folders (`updateMediaFolder` with `parentId`, `blockedIds: [folder.id]`). After success refresh, toast `Moved N items`.
- Each file's existing menu/actions gets **Move to...** too (single file).
- Empty folder state: a short empty message in the folder view. Respect RTL (logical spacing: `ms-`/`me-`/`start`/`end`, no hard-coded left/right), keep existing styling tokens and icon set (lucide-react).
- i18n: every new string in `src/i18n/admin/files.ts` in both `ar` and `en` (Arabic first), no hard-coded text, no English parentheticals in Arabic labels.

## 4. Out of scope

Server code; upload behaviour (step d); drag and drop; folder pages in the URL; the media picker modal; folder colours, sorting options, bulk delete.

## 5. Constraints

No commits, no installs, never edit any `CLAUDE.md`, no secrets. Do not run the dev server against production data. Files you may touch: `src/services/mediaService.ts`, `src/components/admin/files/LibraryView.tsx`, the new `src/components/admin/files/library/*`, the new `src/components/admin/files/FolderBreadcrumb.tsx`, and, only for the three reuse changes in section 3.3, `src/components/admin/drive/DriveDialogs.tsx` and `src/components/admin/files/DriveView.tsx`; plus `src/i18n/admin/files.ts` and `src/i18n/admin/drive.ts` (only if a new picker string is needed) and `docs/CHANGELOG.md` (one line).

## 6. Gates

`npm run lint` (baseline 52 warnings, none new; fix what you add), `npm run build`. If the server from step a is merged, run the app and check the Library tab in both languages, one duplicate-name error path, and a move; say honestly in the report what you could and could not check. List wanted `CLAUDE.md` changes under `## CLAUDE.md proposals for Claude`.

Write your report to `D:\projects\html\ajda\docs\prompts\task-libfolders-c-report.md` (files changed, gate results, decisions made).

Run with a free OpenCode model: **Beam Free** (suggested). If it fails this twice, split it: (c1) the Drive reuse changes (picker props, breadcrumb extraction; Drive must be unchanged), (c2) service, helpers, tiles, browse mode, (c3) selection + move wiring.
