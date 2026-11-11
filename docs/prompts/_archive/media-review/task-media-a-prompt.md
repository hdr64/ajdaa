# task-media-a: harden the media library's chunked upload (server)

Run with a free OpenCode model: **Beam Free** (fallback DeepSeek V4.1 Flash Free).

**Report header (mandatory, first lines of the report):** `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:` and `Finished:` from a real clock command run as your very first and very last action (PowerShell: `Get-Date -Format "yyyy-MM-dd HH:mm:ss"`). Write the report to `D:\projects\html\ajda\docs\prompts\task-media-a-report.md`.

## Goal
`server/src/services/chunkedUploadService.ts` (media library, routes `/api/media/upload/chunked/*`) lacks the safeguards the Drive's `driveUploadService.ts` already has. Bring it to the same standard. One concern only: this file, its route handlers and its test.

## Read first
- `server/src/services/driveUploadService.ts` (the template: chunk validation, atomic part writes, streaming assembly, stale cleanup)
- `server/src/services/chunkedUploadService.ts` (the file to change)
- `server/src/routes/media.routes.ts` (lines for `/upload/chunked/*`)
- `server/src/services/zipExtractService.ts` (`extractZipToLibrary` is called from complete; keep that path working)
- `server/test/media-chunked.test.ts`, `server/test/media-zip.test.ts`, `server/test/drive.test.ts` (chunked section)

## Defects to fix (decided design, no open choices)
1. **Chunk index and size are not validated.** In `saveUploadChunk`: reject an index that is not an integer in `[0, totalChunks)` (400), and reject a buffer whose length differs from the expected size (every chunk is `chunkSize`, the last one is `totalSize - chunkSize*(totalChunks-1)`). Copy `expectedChunkSize` from the Drive service. Read `meta.json` instead of only `fs.access`.
2. **Init is not validated.** In `initChunkedUpload` (or the route schema) require `chunkSize` between 256 KiB and 50 MiB, `totalChunks === Math.max(1, Math.ceil(totalSize / chunkSize))`, `totalChunks <= 20000`. Keep the existing 2 GB `totalSize` cap in the route. Add the disk check `free >= totalSize + 50 MiB` (the route already does a weaker one; keep one place only, in the service, and let the route map the error to 507).
3. **Half-written chunks count as received.** Write each chunk to `tmp_<index>` then `fs.rename` to `part_<index>` (as Drive does). In the status function only accept names matching `/^part_\d+$/`.
4. **Assembly loads every chunk into memory and ignores backpressure.** Replace the `readFile` + `writeStream.write` loop with the Drive pattern: one `createWriteStream`, then for each part `await pipeline(createReadStream(part), out, { end: false })` followed by deleting the part, and `out.end` in a `finally`. After assembly check `stat.size === meta.totalSize`, else delete the target and throw (400).
5. **No cleanup of abandoned sessions.** Add `removeStaleSessions()` (24 h, by directory mtime) called fire-and-forget from init, same as Drive.
6. **Any extension is accepted on complete.** Allowed extensions after the change, nothing else (400 "Unsupported file type"): images `.jpg .jpeg .png .webp .gif .avif`, videos `.mp4 .webm .mov .mkv .avi .m4v`, `.pdf`, models `.glb .gltf`, `.html .htm`, and the document/archive list already in `mediaService.processAndSaveFile` (`.zip .rar .7z .tar .gz .doc .docx .xls .xlsx .ppt .pptx .sql .csv`). **Remove `.svg`** from the image list (the simple upload path never accepted it). Export the allow list from `mediaService.ts` and use it in both files instead of keeping two copies. Validate the extension in `initChunkedUpload` (fail before gigabytes arrive), keep the `extract` rule (only `.zip`).
7. **Client-supplied mime is trusted.** In `resolveFileTypeAndMime` derive the mime from the extension only (table in the same file); drop the `providedMime` branches. The `mimeType` field of the init body stays accepted and ignored.
8. **Error mapping in the routes.** In `media.routes.ts` the init handler answers 500 for validation problems and the chunk/complete handlers answer 400 for everything. Add a small `MediaUploadError extends Error { statusCode }` in `chunkedUploadService.ts` (400 validation, 404 session not found, 413 too large, 507 storage) and let the handlers pass `err.statusCode` through; unknown errors stay 500 with a generic message (do not echo internal error text).
9. **Chunk route body limit.** The multipart plugin limit is 50 MiB (`MAX_UPLOAD_BYTES`), which equals the maximum chunk size, so no change is needed; just confirm `data.file.truncated` is checked after `toBuffer()` and answer 413.

## Out of scope
The simple `/upload` route, the media list route, any frontend file, Drive code, the Prisma schema, migrations.

## Tests
Extend `server/test/media-chunked.test.ts` (keep the existing happy-path test passing; adjust its last chunk to the exact expected size if needed): wrong chunk size, out-of-range index, `.svg` / `.exe` refused at init, inconsistent `totalChunks`, assembled size mismatch cannot happen silently (missing chunk -> 400), unknown upload id -> 404.

## Constraints
No commits, no installs, no `CLAUDE.md` edits. Do not touch files outside the list above. Prisma's AI guard blocks `npm --prefix server test` for agents: run `npm run lint`, `npm run build`, `npm --prefix server run build`, and tell the owner which test command to run by hand (`! npm --prefix server test -- media-chunked media-zip drive`). Lint warnings must not increase (baseline 46).

## Report contents
Files changed, gate results, decisions made, anything not done and why, and a section `## CLAUDE.md proposals for Claude` (docs that should change, e.g. `docs/api-reference.md` for the new status codes and the removed `.svg`).
