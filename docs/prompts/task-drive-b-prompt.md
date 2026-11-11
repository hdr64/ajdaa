# task-drive-b — Drive: download folders and selections as a zip

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Read `CLAUDE.md` for project facts but **never edit any `CLAUDE.md`**.
> First action of the whole task: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and remember it as `Started:`. Last action: run it again for `Finished:`.
> Run with a free OpenCode model: **Beam Free** (suggested). Run only after `task-drive-a` is reviewed and merged (both touch `DriveView.tsx`).

## 1. Goal and why

The Drive can only download one file at a time. Add "Download as zip" for a folder (row action) and for a multi-selection (toolbar), streamed from the server so a multi-GB folder never sits in browser memory.

## 2. Read first

- `docs/README.md` (docs rules), `docs/ADMIN-I18N.md`, `docs/api-reference.md`, `docs/architecture.md`.
- `server/src/routes/drive.routes.ts` (whole file: `guard`, `itemsBody`, `contentDisposition`, `GET /files/:id/download`), `server/src/services/driveService.ts` (`listFolder`, `driveFilePath`, `cleanName`, `uniqueName`, `toFileDto`, folder/file Prisma models in `server/prisma/schema.prisma`: `DriveFolder`, `DriveFile`, `trashedAt`).
- `src/components/admin/files/DriveView.tsx` (row action menu around line 380, selection toolbar around line 615, `run`, `showToast`), `src/services/driveService.ts`, `src/services/api.ts` (how the auth token is attached).
- One existing server test for style.

## 3. Decided design (no open choices)

### 3.1 Dependency (explicit exception to "no installs")

Run exactly: `npm --prefix server install archiver` and `npm --prefix server install -D @types/archiver`. Nothing else. (`archiver` streams, supports zip64 and UTF-8 names.)

### 3.2 Why a ticket

A browser download via a plain link cannot send the `Authorization: Bearer` header, and fetching into a blob would load the whole archive into memory. So: a POST creates a short-lived single-use ticket, then the browser navigates to a GET URL that streams straight to disk.

### 3.3 Server (new file `server/src/services/driveZipService.ts`, routes in `drive.routes.ts`)

- `POST /api/drive/zip/ticket` (guard as the other routes), body `itemsBody` (`folderIds`, `fileIds`, both required-not-both-empty; reuse the existing zod schema) plus optional `name` (string, max 120). Validates that every id exists and is **not trashed**; 404 otherwise. Returns `{ url: '/api/drive/zip/<ticket>' }`.
- Ticket: 24 random bytes hex, stored in an in-process `Map` with `{ folderIds, fileIds, name, adminId, expiresAt }`; TTL 60 s; **single use** (deleted on first GET); a sweep on each new ticket removes expired ones. 
- `GET /api/drive/zip/:ticket` (**no auth header**, the ticket is the credential; register it outside `guard` but mark in the route comment that this is intentional). Unknown or expired ticket: 404. Otherwise stream.
- Build the entry list first (before sending headers): walk the selected folders recursively through `DriveFolder` (children where `trashedAt` is null) and files (`trashedAt` null). Zip paths: selected folder name as the top directory, children below it; selected files at the zip root. Names go through `cleanName` (already safe) and, within one directory, duplicates get `name (2)` suffixes (reuse the idea of `withSuffix`; export a small helper if needed, do not duplicate logic). Empty folders are written as directory entries. Hard cap 20 000 entries: if exceeded, respond 413 `Too many items for one zip`. Do all DB reads with one query per level or a single `findMany` of live folders (the table is small), not one query per file.
- Stream: `archiver('zip', { zlib: { level: 1 } })`; for files whose extension is already compressed (`zip gz jpg jpeg png webp gif mp4 mov mkv webm mp3 m4a pdf docx xlsx pptx 7z rar glb`) pass `store: true`. Append each file with `archive.file(driveFilePath(storageKey), { name })`; if a file's bytes are missing on disk, skip it and `request.log.warn` (do not fail the whole archive). Headers: `Content-Type: application/zip`, `Content-Disposition` via the existing `contentDisposition('attachment', zipName)`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`. No `Content-Length` (streaming). Zip name: a single selected folder -> `<folder>.zip`; otherwise `drive-YYYY-MM-DD.zip`; if `name` was given use it (add `.zip` if missing, run through `cleanName`).
- Use `reply.send(archive)` after `archive.finalize()` is started. On client disconnect (`request.raw.on('close')` before the archive ended) call `archive.abort()`. Errors from the archive after headers were sent: log and destroy the socket.
- Concurrency guard: at most 2 zip streams at once process-wide; a third GET gets 429 `Too many downloads in progress, try again shortly` (decrement in `finally`/on close).
- Tests: `server/test/drive-zip.test.ts` using the existing test helpers: ticket single use (second GET 404), expired ticket 404 (inject a short TTL through a parameter or by manipulating time the way other tests do), trashed item 404 on ticket, a created folder with a nested file produces a body containing the file name bytes and starts with `PK`. **You cannot run the server test suite** (Prisma's AI guard blocks it); write carefully and say in the report that the owner must run `! npm --prefix server test`.

### 3.4 Client

- `src/services/driveService.ts`: add `downloadDriveZip(items: { folderIds: string[]; fileIds: string[] }, name?: string)`: `POST /api/drive/zip/ticket` via `api.post`, then create a hidden `<a href=resolveMediaUrl(url) download>` and click it (reuse `resolveMediaUrl` as `fetchDriveBlob` does). No blob, no fetch of the stream.
- `DriveView.tsx`: 
  - Folder row/card action menu: new action "Download as zip" (icon `Archive` from lucide-react) next to the existing ones, in the Files view only (hidden in trash and search is fine to keep visible).
  - Selection toolbar (the block shown when `selectedRows.length > 0`, non-trash): new button "Download as zip" shown when the selection has at least one folder or at least two files. A single selected file keeps the normal download.
  - Error toast on failure with the server message (`getErrorMessage`); success needs no toast.
- i18n: add keys (`drive.action.downloadZip`, `drive.toast.zipFailed`, plus whatever you need) in both languages in `src/i18n/admin/drive.ts`, following `docs/ADMIN-I18N.md`.

## 4. Out of scope

Extracting zips (task `task-drive-c`), zipping the media library, progress UI for the zip (the browser shows its own download), changes to the upload queue/panel.

## 5. Constraints

No commits, no other installs than 3.1, never edit any `CLAUDE.md`, no secret values anywhere, no schema change. Do not run the server test suite. Files you may touch: `server/src/services/driveZipService.ts` (new), `server/src/routes/drive.routes.ts`, `server/src/services/driveService.ts` only to export a helper, `server/package.json` and lockfile (install only), the new test, `src/services/driveService.ts`, `src/components/admin/files/DriveView.tsx`, `src/i18n/admin/drive.ts`, docs under 6.

## 6. Docs

Same change: add the two routes to `docs/api-reference.md` (mention the ticket flow and that the GET is ticket-authenticated), a paragraph to `docs/architecture.md` in the Drive section, and a changelog entry (find the changelog via `docs/README.md`). Never write secret values.

## 7. Gates (run and report)

`npm run lint` (baseline 52 warnings, none new), `npm run build`, `npm --prefix server run build`.

## 8. Report

Write `D:\projects\html\ajda\docs\prompts\task-drive-b-report.md` with, at the very top: `Model:` (the model you run as, `unknown` if you cannot tell), `Started:`, `Finished:`. Then: files changed or created, gate results, decisions made, anything not done, `## CLAUDE.md proposals for Claude`.
