# task-files-b: one upload manager for Library and Drive

Report: `D:\projects\html\ajda\docs\prompts\task-files-b-report.md`. At the top of the report write `Model:` (the model you run as, `unknown` if you cannot tell), `Started:` and `Finished:` from a real clock command (`Get-Date -Format "yyyy-MM-dd HH:mm:ss"`) run as your very first and very last action.

Read first: `CLAUDE.md` (secrets rules), `docs/ADMIN-I18N.md`, `src/context/UploadManagerContext.tsx`, `src/components/admin/media/UploadManagerDrawer.tsx`, `src/components/admin/feedback/AdminFeedbackPet.tsx` (lines ~100-120, 480-500, 585-610: the pet shows `activeCount` and `overallProgress` from the upload manager), `src/services/driveService.ts` (`uploadDriveFile`), `src/pages/admin/sections/DriveSection.tsx` (upload code, `progress` state, `uploadItems`), `src/services/chunkedUploadService.ts`.

## Goal
Drive uploads must go through the same `UploadManagerContext` as Library uploads, so they appear in the upload drawer (pause, resume, retry, cancel) and in the feedback pet's progress ring. Today Drive has its own inline progress bar and no pause or resume.

## Decided design
1. `ManagedUpload` gets `target: UploadTarget` and `relPath?: string`:
   `type UploadTarget = { kind: 'library' } | { kind: 'drive'; folderId: string | null; folderName?: string }`.
   `result` becomes `UploadedMedia | DriveFile | undefined` (keep the library type working; add a type guard where needed).
2. `uploadFiles(files: File[], opts?: { target?: UploadTarget; relPaths?: (string | undefined)[] })`. The default target is `{ kind: 'library' }`, so every existing caller keeps working unchanged. The returned promise keeps resolving to the array of successful results.
3. `runUploadItem`: when `item.target.kind === 'drive'`, call `uploadDriveFile(item.file, { folderId, relPath, signal, onProgress })` and map the percent to `progress` and `uploadedBytes`. Files up to 50 MB have no progress callback: set progress to 60 while sending, like the library does for small images. The library branch stays exactly as it is. A Drive file larger than `DRIVE_MAX_FILE_BYTES` fails immediately with status `error` and a bilingual message (check whether `useAdminT` can be used inside the provider; if it cannot, use an `isAr` ternary like the drawer does).
4. Pause and resume for Drive: `pauseUpload` aborts the controller (already the case). `resumeUpload` and `retryUpload` re-run the item; a paused or failed Drive upload restarts from the beginning (say so in the report). `cancelUpload` must not call the media `abortChunkedUpload` for Drive items (`uploadDriveFile` aborts its own session on failure).
5. Drawer (`UploadManagerDrawer.tsx`): show a small target chip under the file name: library items "Library" / "المكتبة", Drive items the folder name or "Drive" / "الدرايف". Use admin i18n keys `files.upload.targetLibrary` and `files.upload.targetDrive` in a new `src/i18n/admin/files.ts` (`defineStrings('files', ar, en)`), registered in `src/i18n/admin/index.ts` exactly like the other areas. Leave the drawer's existing bilingual `isAr` ternaries as they are.
6. `DriveSection.tsx`: delete the local `progress` state, `abortRef`, the inline progress block and the sequential loop. `uploadItems` becomes: skip files over `DRIVE_MAX_FILE_BYTES` with the existing toast, then `await uploadFiles(files, { target: { kind: 'drive', folderId, folderName }, relPaths })`, then toast the done or partial result as today (`drive.upload.done`, `drive.upload.partial`) and `refresh()`. The upload buttons are no longer disabled while uploading (several batches may queue). The drop overlay and `collectDropped` stay.
7. The drawer already opens when `uploadFiles` runs; keep that. The pet needs no change.

## Out of scope
Merging the pages (task-files-c), the picker (task-files-d), server code, resuming Drive uploads from where they stopped, the media picker's own upload path.

## Constraints
No commits, no installs, no edits to any `CLAUDE.md` (list wanted doc changes in the report under `## CLAUDE.md proposals for Claude`). Do not touch `server/`. All new visible text goes through `src/i18n/admin/*` keys (ar and en), no hard-coded Arabic in `.tsx`. Lint stays at 46 warnings, none new.

## Gates
`npm run lint`, `npm run build`. Do not run `npm --prefix server test`. Report: files changed, gate results, decisions made, anything not verified in a browser.

Run with a free OpenCode model: Beam Free.
