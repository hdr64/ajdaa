# task-libfolders-d — Library folders: upload into the open folder; show where a zip went (client only)

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Never edit any `CLAUDE.md`.
> At the top of your report write `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:`, `Finished:`. Run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` as your very first and very last action for the two times.
> Master task: `libfolders`. Run only after steps a, b and c are reviewed and merged (you edit `LibraryView.tsx` after c).

## 1. Goal and why

Close the loop: files uploaded while a folder is open land in that folder, and after a zip is extracted into the Library the admin sees the folder it created and can organise it.

## 2. Read first

`src/context/UploadManagerContext.tsx` (`UploadTarget`, `LIBRARY_TARGET`, the library branch around `uploadFileInChunks` / `uploadMedia`), `src/services/chunkedUploadService.ts`, `src/services/mediaService.ts` (`uploadMedia`, `UploadOptions`, `UploadedMedia`), `src/components/admin/files/LibraryView.tsx` (`handleFileUpload`), `src/components/admin/media/MediaPickerModal.tsx` (zip extract flow, notices), the server contract from step b (`docs/api-reference.md`).

## 3. Decided design (no open choices)

- `UploadTarget` library variant becomes `{ kind: 'library'; folderId?: string | null }`. `LIBRARY_TARGET` stays the default (root). In the library branch pass `folderId` to `uploadFileInChunks(file, { extract?, folderId })` (sent in the init body) and to `uploadMedia(file, { signal, folderId })` (sent as `?folderId=`). Omit the field when null/undefined so existing calls are byte-identical.
- `LibraryView`: `handleFileUpload` uses the currently open folder as the target (null at root). When an upload finishes, refresh the file list and the folder list (c already refreshes after uploads; reuse it).
- `UploadedMedia` gains optional `folderId` and `folderName` (what step b returns for extractions). In `MediaPickerModal`, the zip-extract success notice names the folder: add i18n keys `media.picker.extractedInFolder` ("Extracted N files into the folder \"X\" in the Library", ar and en) used when `folderName` is present; the old notices remain as the fallback. The picker still extracts to the Library root (do not add folder navigation to the picker).
- Upload panel (`UploadManagerDrawer.tsx`): no layout change; if a library upload has a target folder name available, nothing more is needed. Do not touch it unless the type change forces it.

## 4. Out of scope

Server code; folder navigation inside the picker; zip upload from the Library tab itself (the extract flow stays in the picker); Drive.

## 5. Constraints and gates

No commits, no installs, never edit any `CLAUDE.md`, no secrets. Files you may touch: the four client files above, `src/i18n/admin/media.ts` and `src/i18n/admin/files.ts` (both languages), `docs/CHANGELOG.md` (one line). Gates: `npm run lint` (52 warnings baseline, none new), `npm run build`. Check in the running app (both languages): upload a small image while inside a folder and confirm it appears there and not at root; upload at root; confirm the picker upload path still works. Say honestly what you could not check. List wanted `CLAUDE.md` changes under `## CLAUDE.md proposals for Claude`.

Write your report to `D:\projects\html\ajda\docs\prompts\task-libfolders-d-report.md` (files changed, gate results, decisions made).

Run with a free OpenCode model: **Beam Free** (suggested).
