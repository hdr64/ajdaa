# task-drive-a — Drive upload: fix the folder race, add a real upload queue, one upload window

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Read `CLAUDE.md` for project facts but **never edit any `CLAUDE.md`**.
> First action of the whole task: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.
> Run with a free OpenCode model: **Beam Free** (suggested).

## 1. Goal and why

Uploading a folder (or many files) to the admin Drive shows dozens of separate cards, and most of them fail with `A folder with this name already exists here` (owner screenshot: a `.git/hooks` folder upload, every file red).

Two real defects:

1. **Server race.** `UploadManagerContext.uploadFiles` starts every file at once (`Promise.allSettled(newItems.map(runUploadItem))`). Each file's request calls `ensureFolderPath` (`server/src/services/driveService.ts`), which does `findFirst` then `createFolder`. Parallel requests all see "no folder yet", all try to create it, and every one after the first gets the 409.
2. **No queue, no single window.** Hundreds of files start together (browser and server overload), and `UploadManagerDrawer.tsx` renders one big card per file.

Fix: make `ensureFolderPath` race-safe, add a bounded-concurrency upload queue, and replace the stack of cards with **one compact upload panel**.

## 2. Read first

- `docs/README.md` (docs rules), `docs/ADMIN-I18N.md` (admin strings: Arabic first, English translation, `t()` keys, no raw keys), `docs/architecture.md`, `docs/api-reference.md`.
- `src/context/UploadManagerContext.tsx` (whole file), `src/components/admin/media/UploadManagerDrawer.tsx` (whole file).
- `src/components/admin/files/DriveView.tsx` lines 255-290 (`uploadItems`) and every caller of `useUploadManager`, `setIsDrawerOpen`, `toggleDrawer`, `isUploading`, `activeCount`, `overallProgress` (run `Grep` over `src/`: `LibraryView.tsx`, `MediaPickerModal.tsx`, `AdminFeedbackPet.tsx`, `AdminDashboardPage.tsx` and others use them; do not break them).
- `src/services/driveService.ts` (`uploadDriveFile`), `src/services/chunkedUploadService.ts`.
- `server/src/services/driveService.ts` (`ensureFolderPath`, `createFolder`, `nameTaken`, `registerUploadedFile`), `server/src/services/driveUploadService.ts` (`completeDriveUpload`), `server/src/routes/drive.routes.ts` (`POST /upload`).
- `server/test/helpers.ts` and one existing test file for the test style.
- The i18n files that hold the keys `files.upload.targetDrive`, `files.upload.targetLibrary`, `drive.upload.*` (find them with `Grep` under `src/i18n/admin/`).

## 3. Decided design (no open choices)

### 3.1 Server: race-safe `ensureFolderPath` (`server/src/services/driveService.ts` only)

- Keep the signature. Add an in-process lock map `Map<string, Promise<string>>` keyed by `${parentId ?? 'root'}\u0000${name}`: when a create for that key is already running, await the same promise instead of starting another. Remove the key in `finally`. (The API runs as one process; this is enough. No schema change, no migration.)
- Also handle the cross-request fallback: if `createFolder` throws a `DriveError` with status 409, re-run the `findFirst` and use that folder; if still not found, rethrow.
- `createFolder` itself keeps its 409 behaviour for the normal "New folder" button. Do not change `registerUploadedFile`, `uniqueName` or any route.
- Test: new file `server/test/drive-folder-race.test.ts`. Run `Promise.all` of 10 `ensureFolderPath(null, ['A','B'])` calls on a clean state, assert all return the same id and exactly one `A` and one `B` folder exist. Copy the setup/cleanup style from existing tests. **You cannot run the server test suite** (Prisma's AI guard blocks it); write it carefully and say in the report that the owner must run `! npm --prefix server test`.

### 3.2 Client: queue in `UploadManagerContext.tsx`

- Add `const MAX_CONCURRENT_UPLOADS = 3` (module constant). At most 3 items are in status `uploading` or `processing` at once; the rest stay `queued`.
- Replace `Promise.allSettled(newItems.map(runUploadItem))` with a scheduler: a `pendingRef` array of item ids waiting, a `waitersRef` map `id -> { resolve, reject }`, and a `pump()` that starts items from `pendingRef` while fewer than `MAX_CONCURRENT_UPLOADS` are running. Each finished/failed/aborted item calls `pump()` in `finally`.
- Keep the public contract: `uploadFiles(files, opts)` still returns `Promise<UploadResult[]>` containing only the successful results, resolved when **all items of that call** have settled (success, error, or cancel). Cancelled and paused-then-cancelled items must resolve the call (do not leave it hanging).
- `pauseUpload` aborts the running item and frees its slot (`pump()`); `resumeUpload` and `retryUpload` put the item back into the queue (status `queued`, then `pump()`) instead of calling `runUploadItem` directly; `cancelUpload` also removes the item from `pendingRef`.
- Order: upload in the order given. For folder uploads this means the first files create the folders; with 3.1 the order no longer matters for correctness.
- New context members (add to the context type and the memoised value): `retryFailed: () => void` (re-queue every item with status `error`) and `clearFinished: () => void` (remove `completed` items; keep the existing `clearCompleted` as an alias so other callers keep compiling). Also expose `queuedCount`, `errorCount`.
- Auto-dismiss: remove the per-item 5-second timers. New rule: when no item is `queued`/`uploading`/`processing`/`paused` and no item is `error` (everything completed), wait 5 seconds, then clear the list and close the panel; any new upload cancels that timer. If an error exists, the list stays until the user retries, cancels or clears.
- Keep the Drive 5 GB check and the library chunked / small-image logic unchanged.

### 3.3 Client: one window in `UploadManagerDrawer.tsx`

Replace the per-file big cards with **one panel** (same fixed position: `fixed bottom-24 end-6 z-50 w-84 sm:w-96`, same visual language: `bg-surface/95 backdrop-blur-md border border-muted-border/60 rounded-2xl shadow-2xl`):

- **Header** (always visible): title `Uploads` with a summary `{done} of {total}` (e.g. "12 of 40"), an overall progress bar (`overallProgress`), and buttons: collapse/expand (chevron; collapsed state is local `useState` in the drawer), "Retry failed" (only when `errorCount > 0`), "Clear finished" (only when completed items exist), and close (X). Close while uploads are active only hides the panel (same as today's minimize); it never cancels uploads.
- **Collapsed**: header only.
- **Expanded body**: scrollable list, `max-h-[50vh] overflow-y-auto`. One **compact row** per file (about 36-40 px high): type icon, file name truncated with `title`, size, status text or percent on the end side, and per-row actions (pause / resume / retry / cancel) as small icon buttons; a 2 px progress line under the row. Error rows show the message on a second line in red, truncated with `title`.
- **Sort for display**: error, uploading/processing, paused, queued, completed (stable inside each group). Render at most 200 rows; if more, one last line `+N more` (i18n key with `{count}`).
- Show the target label (`folderName` / library) **once in the header subtitle** when all items share a target, instead of a badge per row; if targets differ, show it per row.
- Must work with RTL (`start`/`end` logical classes, as the current file does) and with a narrow screen (390 px wide: panel width `w-[calc(100vw-2rem)] max-w-96`).
- All strings through `t()` keys added to both languages in the i18n file that already holds the `files.upload.*` keys. Remove the hard-coded `isAr ? ... : ...` literals from the drawer. Follow `docs/ADMIN-I18N.md` (no raw keys, no `missing key` warning).

### 3.4 `DriveView.tsx`

Only adapt if the queue change forces it. The toast logic in `uploadItems` stays (it uses the array `uploadFiles` returns). Do not redesign anything else in `DriveView.tsx` in this task (the next task adds zip actions there).

## 4. Out of scope

Zip features (tasks `task-drive-b` and `task-drive-c`), chunk size or retry logic in `driveService.ts`/`chunkedUploadService.ts`, real XHR progress for small files, any schema or migration, `LibraryView` redesign, the feedback pet.

## 5. Constraints

No commits, no `npm install`, no new dependencies, never edit any `CLAUDE.md`, no secret values in files or the report, do not touch `server/prisma/`, do not run the server test suite. Keep `uploadFiles`'s signature. Files you may touch: `src/context/UploadManagerContext.tsx`, `src/components/admin/media/UploadManagerDrawer.tsx`, the i18n file(s) for the new keys, `src/components/admin/files/DriveView.tsx` (only if required), `server/src/services/driveService.ts`, the new test file, and docs under 6.

## 6. Docs

Add one changelog entry (find the changelog file via `docs/README.md`) describing the race fix and the upload queue/window. No `api-reference.md` change (no route changed). List any `CLAUDE.md` changes you would want under `## CLAUDE.md proposals for Claude` in the report.

## 7. Gates (run and report the results)

`npm run lint` (baseline 52 warnings, no new ones), `npm run build`, `npm --prefix server run build`. Browser check is Claude's job in review, but state in the report how you tested the queue logic (at minimum read it twice for hangs: a promise that never resolves after cancel, a slot never freed on error/abort).

## 8. Report

Write `D:\projects\html\ajda\docs\prompts\task-drive-a-report.md` with, at the very top: `Model:` (the model you run as, `unknown` if you cannot tell), `Started:`, `Finished:`. Then: files changed or created, gate results, decisions you made, anything not done, and `## CLAUDE.md proposals for Claude`.
