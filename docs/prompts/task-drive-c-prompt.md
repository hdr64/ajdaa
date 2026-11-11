# task-drive-c — Drive: extract a zip file into a folder

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Read `CLAUDE.md` for project facts but **never edit any `CLAUDE.md`**.
> First action of the whole task: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.
> Run with a free OpenCode model: **Beam Free** (suggested); this one is security-sensitive, so the review will be strict. Run only after `task-drive-a` and `task-drive-b` are reviewed and merged.

## 1. Goal and why

A `.zip` already stored in the Drive can only be downloaded. Add "Extract here": the server unpacks it into a new folder next to the zip, keeping the folder structure. Extraction runs on the server so large archives do not travel through the browser.

Untrusted archives are dangerous (path traversal "zip slip", zip bombs, symlinks, disk exhaustion). The safety rules in 3.2 are mandatory, not optional.

## 2. Read first

- `docs/README.md`, `docs/ADMIN-I18N.md`, `docs/api-reference.md`, `docs/architecture.md`.
- `server/src/services/driveService.ts` (`cleanName`, `ensureFolderPath`, `createFolder`, `uniqueName`, `registerUploadedFile`, `newStorageKey`, `driveFilePath`, `ensureDriveDir`, `purgeItems`, `DRIVE_MAX_FILE_BYTES`, `DriveError`), `server/src/services/driveUploadService.ts` (`initDriveUpload` free-space check, `completeDriveUpload` assembly and cleanup on failure), `server/src/routes/drive.routes.ts`, `server/src/app.ts` (request/connection timeouts).
- `src/components/admin/files/DriveView.tsx` (file action menu around line 380, `run`, `showToast`), `src/services/driveService.ts` (`COMPLETE_TIMEOUT_MS`, `api.post` options), `src/i18n/admin/drive.ts`.
- `server/src/services/driveZipService.ts` and `server/test/drive-zip.test.ts` from task B (an archive builder is available for test fixtures).

## 3. Decided design (no open choices)

### 3.1 Dependency (explicit exception to "no installs")

Run exactly: `npm --prefix server install yauzl` and `npm --prefix server install -D @types/yauzl`. Nothing else.

### 3.2 Server: `server/src/services/driveExtractService.ts` + route

- Route: `POST /api/drive/files/:id/extract` (guard as the other routes), body `{ folderId?: string | null }`. Default target: a **new folder** in the zip file's own folder, named after the zip without `.zip`, made unique with `uniqueName('folder', ...)`. If `folderId` is given, extract into a new folder with that name pattern inside it. Response `201`: `{ folder: <folder dto>, files: <number>, folders: <number>, skipped: <number> }`.
- The source must exist, not be trashed, and be a zip (name ends with `.zip` case-insensitive or mime `application/zip`); otherwise 400. A zip larger than 2 GB: 413 `Archive too large to extract (max 2 GB)`.
- Use `yauzl.open(path, { lazyEntries: true, autoClose: true, strictFileNames: true, decodeStrings: true })` and process entries one by one (`readEntry` after each finishes), streaming each entry with `openReadStream` into a file at `driveFilePath(newStorageKey(fileName))` using `stream/promises` `pipeline`. Never buffer an entry in memory.
- **Mandatory safety rules** (each needs a test, 3.4):
  1. Normalise the entry name: replace `\` with `/`, reject (count as `skipped`, do not abort) any entry that starts with `/`, contains a drive letter prefix (`^[A-Za-z]:`), a NUL byte, or any segment equal to `..`. Drop segments equal to `.` and empty segments. Then run **every** segment through `cleanName` (a `DriveError` for a bad name means that entry is skipped).
  2. Skip symlinks and other non-regular entries: use `entry.externalFileAttributes >>> 16` and check the file type bits (`(mode & 0o170000)` must be `0o100000` regular or `0o040000` directory, or the mode is 0).
  3. Skip `__MACOSX/` entries, `.DS_Store`, and `Thumbs.db` (count as skipped).
  4. Reject encrypted entries (`entry.isEncrypted()`): count as skipped.
  5. Limits: at most 10 000 entries in the archive (check `zipfile.entryCount` first, 413 otherwise); declared total uncompressed size at most 5 GB (`DRIVE_MAX_FILE_BYTES`) and each file at most `DRIVE_MAX_FILE_BYTES`; before starting, free-space check like `initDriveUpload` (`fs.statfs`, need declared total + 256 MB, else 507 `Insufficient storage`). While streaming each entry, count the real bytes with a `Transform`; if it exceeds the entry's declared `uncompressedSize`, or the running total exceeds the 5 GB limit, abort with 413 (this is the zip bomb guard; the declared sizes in the header can lie).
  6. Folder structure: for each file call `ensureFolderPath(rootFolderId, segments.slice(0, -1))` and `registerUploadedFile(...)` exactly as `completeDriveUpload` does. Directory entries create the folder with `ensureFolderPath`.
  7. Name clashes inside the new folder tree: `registerUploadedFile` already makes names unique; do not overwrite anything.
- **Rollback on any abort or error** (limit, disk, I/O): delete the bytes written so far for the current entry, then remove everything this run created: collect created file ids and the root folder id; permanently remove them through the existing purge logic (`purgeItems`) or the same Prisma deletes it uses, and unlink the storage files. After rollback rethrow as `DriveError` with the right status. No half-extracted folders left behind.
- Concurrency: one extraction at a time process-wide; a second request gets 429 `Another extraction is running, try again shortly`.
- Long request: check `server/src/app.ts` for `requestTimeout`/`connectionTimeout`; if they would cut a multi-minute extraction, set a larger `requestTimeout` for this one route only if Fastify allows it per route, otherwise state it in the report. Do not change global timeouts.

### 3.3 Client

- `src/services/driveService.ts`: `extractDriveZip(fileId: string, folderId?: string | null)` using `api.post` with `timeoutMs: COMPLETE_TIMEOUT_MS` (or a larger constant next to it).
- `DriveView.tsx`: file action menu entry "Extract here" (icon `PackageOpen` or `Archive` from lucide-react) shown only for zip files (same test as the server: name ends with `.zip` or mime `application/zip`; in the Files view, not trash). While running show a persistent info toast or a disabled-state spinner on that row, so the owner knows it is working (follow whatever pattern `DriveView` already uses for long actions; if none, a toast "Extracting..." that is replaced by the result). On success toast `Extracted {files} files into {folder}` (+ ` ({skipped} skipped)` when skipped > 0) and `refresh()`; on failure the server message via `getErrorMessage`.
- i18n keys in both languages in `src/i18n/admin/drive.ts`, per `docs/ADMIN-I18N.md`.

### 3.4 Tests (`server/test/drive-extract.test.ts`)

Build zip fixtures in the test with `archiver` (task B) or, when archiver sanitises a name you need (`../evil.txt`, `/abs.txt`, `a\..\b.txt`), build the zip bytes by hand (store method, `zlib.crc32` is available in Node 24). Cases: normal nested archive gives the right folders and files; `../evil.txt` and absolute names are skipped and nothing is written outside the new folder; a symlink entry is skipped; a non-zip file gives 400; a trashed source 404; the zip bomb guard (an entry whose real size exceeds its declared size, hand-built) aborts and leaves no folder or file behind; the entry-count limit. **You cannot run the server test suite** (Prisma's AI guard blocks it); write carefully, and say in the report that the owner must run `! npm --prefix server test`.

## 4. Out of scope

Creating zips (task B), uploading a zip with auto-extract, password-protected zips, other archive formats (rar, 7z, tar), a progress bar for extraction, the upload queue/panel.

## 5. Constraints

No commits, no other installs than 3.1, never edit any `CLAUDE.md`, no secret values anywhere, no schema change. Do not run the server test suite. Files you may touch: `server/src/services/driveExtractService.ts` (new), `server/src/routes/drive.routes.ts`, `server/package.json` and lockfile (install only), the new test, `src/services/driveService.ts`, `src/components/admin/files/DriveView.tsx`, `src/i18n/admin/drive.ts`, docs under 6.

## 6. Docs

Same change: add the route to `docs/api-reference.md` (with the limits), a paragraph in `docs/architecture.md` Drive section (safety rules listed briefly), and a changelog entry (via `docs/README.md`). No secret values.

## 7. Gates (run and report)

`npm run lint` (baseline 52 warnings, none new), `npm run build`, `npm --prefix server run build`.

## 8. Report

Write `D:\projects\html\ajda\docs\prompts\task-drive-c-report.md` with, at the very top: `Model:` (the model you run as, `unknown` if you cannot tell), `Started:`, `Finished:`. Then: files changed or created, gate results, decisions made (state which of the safety rules 1-7 each test covers), anything not done, `## CLAUDE.md proposals for Claude`.
