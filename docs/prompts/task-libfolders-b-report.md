# task-libfolders-b report

Model: GLM (Z.ai)
Started: 2026-11-11 19:45 UTC
Finished: 2026-11-11 20:10 UTC

Run on the uploaded `ajda.zip` snapshot (no repo config files, no docs/); see the note in the step-a report. This step ran after step a in the same session, against its `mediaFolderService.ts`.

## Files changed

- `server/src/services/chunkedUploadService.ts`
  - `ChunkedMeta` gains `folderId?: string | null`; `initChunkedUpload` params gain `folderId` and validate it **before any session is created** (404 `Folder not found`).
  - Complete, normal file: the created `MediaFile` row gets `folderId` from the meta (`?? null`), and the response includes `folderId`.
  - Complete, `extract` set: `extractZipToLibrary` now receives `folderId: meta.folderId` (the parent).
- `server/src/services/zipExtractService.ts`
  - `extractZipToLibrary` gains the param `folderId?: string | null` (parent; null/undefined = library root).
  - After the entries are validated and just before the rows are created, it creates ONE folder: `createFolder(await uniqueFolderName(parentFolderId, wanted), parentFolderId, adminId)` where `wanted = cleanFolderName(zip name without .zip)`; if the zip's name cleans down to nothing (or is otherwise invalid) the fallback name is `Extracted`.
  - Every created row gets that folder's id; the returned `extracted` items and the response gain `folderId` and `folderName`.
  - The catch now also deletes the library folder row when the extraction fails after the folder exists (the disk-folder removal was already there).
- `server/src/routes/media.routes.ts`
  - `POST /upload/chunked/init` zod: `folderId: z.string().uuid().nullable().optional()`.
  - `POST /upload` (multipart): optional `?folderId=<uuid>`; 400 for a non-uuid, 404 `Folder not found` when missing; the row gets it; response includes `folderId`.
- `server/test/media-folder-upload.test.ts` — NEW. Chunked upload with a `folderId` lands in it (row + response + `fileCount`); unknown `folderId` gives 404 at init and creates no session (session-dir count unchanged); an `html` zip extraction creates one folder named after the zip inside the target folder, with the row inside, and the top-level response carries the folder; a second extraction of the same zip name gives `name (2)`; a failed extraction (no matching files) leaves no folder and no row; `POST /upload?folderId=` lands the row in the folder, 404s on an unknown folder, and stays at root without the query.
- `server/test/zip-helper.ts` — `Extracted` gains optional `folderId` / `folderName` (mirrors the new response shape).
- `docs/api-reference.md`, `docs/CHANGELOG.md` — NOT updated (`docs/` absent from the snapshot); owner applies: init/complete/upload `folderId`, extraction response `folderId`/`folderName`, zip always gets its own folder.

## Decisions made

- The extraction folder is created for **every** zip extraction, also when no `folderId` was sent — per the goal "a zip never scatters rows into the flat list again"; its parent is then the library root.
- Existing zip tests keep passing unchanged: they now create library folders as a side effect (named after the zip), which none of their assertions contradict; their `afterAll` cleans the rows.
- `syncDiskMediaThrottled` untouched (still `folderId = null`), and no existing rows change.

## Gate results

- Throwaway strict `tsc --noEmit`: 0 errors in all touched server files.
- Full server suite with a recreated vitest config: **553 tests / 55 files pass**, including the 10 new tests of this step and the existing `media-zip` / `media-chunked` files. (`test/devUser.test.ts` cannot import because `server/scripts/` is missing from the zip — pre-existing.)
- oxlint: no warnings in any touched file.
- Real `tsc` build / repo lint baseline / repo vitest config: not runnable in the snapshot; owner re-runs the gates, and `! npm --prefix server test`.

## What I could not check

- The browser flows (zip extract from the picker, folder landing) — client work belongs to steps c/d; this step is server-only.
- PostgreSQL behaviour (the SQLite suite ran; the migration is owner-run).

## CLAUDE.md proposals for Claude

- None beyond the test-count update in the step-a proposal (the suite total already includes this step).

Task ID: 2-b (master task `libfolders`, step b).
