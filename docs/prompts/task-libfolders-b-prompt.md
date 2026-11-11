# task-libfolders-b — Library folders: uploads land in a folder; a zip gets its own folder (server only)

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Never edit any `CLAUDE.md`.
> At the top of your report write `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:`, `Finished:`. Run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` as your very first and very last action for the two times.
> Master task: `libfolders`. Run only after `task-libfolders-a` is reviewed (it creates `MediaFolder`, `MediaFile.folderId`, `mediaFolderService.ts`). May run in parallel with step c (disjoint files).

## 1. Goal and why

Make new uploads organised from the start: an upload can target a folder, and a zip extracted into the Library (video / 3D / HTML-site picker flow) puts everything it creates into **one new folder named after the zip**, so a zip never scatters rows into the flat list again.

## 2. Read first

`server/src/services/mediaFolderService.ts` (from step a: `uniqueFolderName`, folder existence checks), `server/src/services/chunkedUploadService.ts` (`ChunkedMeta`, `initChunkedUpload`, the complete step around `meta.extract`), `server/src/services/zipExtractService.ts` (`extractZipToLibrary`), `server/src/routes/media.routes.ts` (`POST /upload`, `/upload/chunked/init`, `/upload/chunked/complete`), `docs/api-reference.md`.

## 3. Decided design (no open choices)

- **Chunked init** accepts optional `folderId: string | null` (zod `z.string().uuid().nullable().optional()`). If given and the folder does not exist: 404 `Folder not found`, before any session is created. Store it in `ChunkedMeta` (`folderId?: string | null`).
- **Complete, normal file** (no `extract`): the created `MediaFile` row gets `folderId` from the meta.
- **Complete, `extract` set**: `extractZipToLibrary` gets a new param `folderId?: string | null` (the parent). After the entries are validated and just before the `MediaFile` rows are created, create one folder with `createFolder(uniqueFolderName(folderId ?? null, <zip name without .zip, cleaned>), folderId ?? null, adminId)` and create every row with that folder's id. If creating the folder fails because the name is invalid (empty after cleaning), fall back to the name `Extracted`. On any failure after the folder exists, delete the folder too (the existing catch already removes the extracted disk folder; extend it). The returned `extracted` array items and the response gain `folderId` and `folderName` (the new folder).
- **`POST /api/media/upload`** (multipart, small files): optional query `?folderId=<uuid>`; same validation (404 if missing); the row gets it.
- The disk index sync (`syncDiskMediaThrottled`) keeps creating rows with `folderId = null`. Do not change it.
- No change to files already in the Library.

## 4. Tests

Extend the existing chunked-upload / zip tests or add `server/test/media-folder-upload.test.ts`: chunked upload with a `folderId` lands in it; unknown `folderId` gives 404 at init and creates no session; an `html` zip extraction creates one folder named after the zip with the row inside; a second extraction of the same zip name gives `name (2)`; a failed extraction (zip with no matching files) leaves no folder and no row; `POST /upload?folderId=`. You cannot run the server suite (Prisma's AI guard): write carefully and say so in the report; the owner runs `! npm --prefix server test`.

## 5. Out of scope

Client code (steps c, d); changing which zip kinds are accepted; extraction safety rules (do not touch them); Drive.

## 6. Constraints and gates

No commits, no installs, never edit any `CLAUDE.md`, no secrets. Update `docs/api-reference.md` and `docs/CHANGELOG.md` in the same change. Files you may touch: the services and routes named above, the tests, those two docs. Gates: `npm --prefix server run build`, `npm run lint` (52 warnings baseline, none new), `npm run build`. List wanted `CLAUDE.md` changes under `## CLAUDE.md proposals for Claude`.

Write your report to `D:\projects\html\ajda\docs\prompts\task-libfolders-b-report.md` (files changed, gate results, decisions made).

Run with a free OpenCode model: **Beam Free** (suggested).
