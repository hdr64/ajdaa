# task-files-d: choose a file from Drive in the media picker

Report: `D:\projects\html\ajda\docs\prompts\task-files-d-report.md`. At the top write `Model:` (the model you run as, `unknown` if unknown), `Started:` and `Finished:` from a real clock command (`Get-Date -Format "yyyy-MM-dd HH:mm:ss"`) run as your first and last action.

Prerequisite: the server endpoint `POST /api/drive/files/:id/to-library` exists (see `docs/api-reference.md` section 5b) and task-files-c is merged.

Read first: `docs/ADMIN-I18N.md`, `src/components/admin/media/MediaPickerModal.tsx`, `src/services/driveService.ts`, `src/components/admin/drive/DriveDialogs.tsx` (the `DriveFolderPicker` pattern), `src/components/admin/drive/driveFormat.ts`, `src/i18n/admin/files.ts`.

## Goal
`MediaPickerModal` (used by projects, past projects, CMS clients, the footer and the 3D card) gets a third tab, **Drive**. The admin browses Drive folders and picks a file; the file is published into the library; the picker then returns that library item exactly as a library pick does, so the project stores a normal public `/uploads/...` URL. The Drive file stays private and unchanged.

## Decided design
1. Client service in `src/services/driveService.ts`: `publishDriveFileToLibrary(id: string): Promise<UploadedMedia>` = `api.post('/api/drive/files/' + id + '/to-library', {})`.
2. New component `src/components/admin/drive/DriveFilePicker.tsx`, props `{ fileType: MediaPickerModalProps['fileType']; selectedId: string | null; onSelect: (file: DriveFile | null) => void }`. It lists one folder at a time with `fetchDriveList({ view: 'files', folderId })`, shows breadcrumbs (click to go up), folder rows (click to open) and file rows (click to select, highlighted), and has a search box using `view: 'search'`. Only files the library would accept for `fileType` are selectable, decided by the extension of `file.name` against lists in a new `src/utils/libraryTypes.ts` (a client copy of the server lists; comment pointing to `server/src/services/mediaService.ts`): image `.jpg .jpeg .png .webp .gif .avif`; video `.mp4 .webm .mov .mkv .avi .m4v`; model3d `.glb .gltf`; pdf `.pdf`; html `.html .htm`; `other` and `all` = any extension the library allows (`.zip .rar .7z .tar .gz .doc .docx .xls .xlsx .ppt .pptx .sql .csv` plus all of the above). Other files are shown greyed and are not selectable. Files over 2 GB are greyed too (tooltip key `files.picker.tooLarge`).
3. `MediaPickerModal`: the tab type becomes `'library' | 'drive' | 'upload'`; add the tab button (`files.picker.tabDrive` = "From Drive" / "من الدرايف", `FolderOpen` icon, same style as the other tabs). The footer button "Use file" on the Drive tab calls `publishDriveFileToLibrary(selected.id)` (disabled with a spinner while it runs, errors shown in the existing `uploadError` / `notice` area), then calls `onSelect({ url, filename, originalName })` with the returned item and closes, the same as a library selection. Reuse the existing footer; do not add a second one. The selected-file hint in the footer shows the Drive file name.
4. Reset the Drive selection when the modal opens or the tab changes, like `selectedFile` is reset today.
5. i18n: all text in `src/i18n/admin/files.ts` (ar and en), no hard-coded Arabic in `.tsx`.

## Out of scope
Server code, the merged page, uploading to Drive from the picker, multi-select, a "publish" action on the Library page.

## Constraints
No commits, no installs, no edits to any `CLAUDE.md` (propose changes in the report under `## CLAUDE.md proposals for Claude`). Lint baseline 46 warnings, none new.

## Gates
`npm run lint`, `npm run build`. Do not run the server tests. Report: files changed, gate results, decisions, what is unverified in a browser.

Run with a free OpenCode model: Beam Free.
