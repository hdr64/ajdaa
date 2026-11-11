# task-libfolders-a — Library folders: schema, folder API, move, list filter (server only)

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; its secrets and production rules still apply. Read `CLAUDE.md` for project facts but **never edit any `CLAUDE.md`**.
> At the top of your report write `Model:` (the model you run as, `unknown` if you cannot tell, never guessed), `Started:`, `Finished:`. Run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` as your very first and very last action for the two times.
> Master task: `libfolders` (a → then b and c in parallel → then d). This is step a.

## 1. Goal and why

The media Library (admin Files page, "Library" tab; table `media_files`) is one flat list; with many uploads (zip extractions, videos, many `index.html`) it becomes unusable. Add **virtual folders** to the Library, exactly like the Drive does: folders exist only in the database, files stay where they are on disk, so **public URLs (`/uploads/...`, `/f/<slug>`, `/html/<slug>/`) never change** and nothing already published breaks.

This step is the data model and the API only. No client code.

## 2. Read first

`docs/README.md`, `docs/api-reference.md`, `docs/architecture.md`, `server/prisma/schema.prisma` (`MediaFile`, `DriveFolder`), `server/prisma/migrations/20261112100000_drive/migration.sql` (the hand-written PostgreSQL style to copy), `server/src/routes/media.routes.ts` (the `GET /` list, `mediaGuard`), `server/src/services/mediaService.ts` (`deleteMediaFile`, `syncDiskMediaThrottled`), one existing media test in `server/test/` (grep for `media`) for the test setup pattern.

## 3. Decided design (no open choices)

### 3.1 Schema (`server/prisma/schema.prisma`) and migration

```prisma
model MediaFolder {
  id          String        @id @default(uuid())
  name        String
  parentId    String?
  parent      MediaFolder?  @relation("MediaTree", fields: [parentId], references: [id], onDelete: Restrict)
  children    MediaFolder[] @relation("MediaTree")
  files       MediaFile[]
  createdById String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([parentId])
  @@map("media_folders")
}
```

On `MediaFile` add `folderId String?`, `folder MediaFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)` and `@@index([folderId])`.

Write the migration by hand as **PostgreSQL SQL**: `server/prisma/migrations/20261113100000_media_folders/migration.sql` (create table, add column, FKs, indexes, same style and quoting as the drive migration). Dev uses SQLite: apply with the repo's `db:push` script (see `server/package.json`) and `prisma generate`; if Prisma's AI guard blocks a command, do not work around it, say so in the report and the owner runs it.

### 3.2 Service `server/src/services/mediaFolderService.ts` (new)

- `class MediaFolderError extends Error { statusCode }`.
- `cleanFolderName(raw)`: NFC-normalise, trim; required; max 120 chars; not `.`/`..`; no `/`, `\` or control characters (400 with a clear English message). Do not import from `driveService` (separate domain, no coupling).
- Sibling names are unique **case-insensitively** within the same parent (root counts as a parent): duplicate create / rename / move gives 409 `A folder with this name already exists here`. Compare in code (lower-case both sides), not with a DB unique index (nullable `parentId`).
- Maximum depth 5 (a root folder has depth 1): creating or moving deeper gives 400 `Folders can be nested at most 5 levels`. Moving a folder into itself or any descendant gives 400 `Cannot move a folder into itself`.
- Functions: `listFolders()` (returns every folder with `fileCount` = number of files directly inside, one `groupBy` query), `createFolder(name, parentId, adminId)`, `updateFolder(id, { name?, parentId? })`, `deleteFolder(id)`, `moveFiles(ids, folderId)`, and an exported helper `uniqueFolderName(parentId, wanted)` that returns `wanted`, else `wanted (2)`, `wanted (3)`... (used by step b for zip extraction).
- `deleteFolder` **never deletes files**: in one transaction move its child folders and its files to its parent (or root), then delete the folder. Name clashes among the moved child folders and the parent's existing folders are resolved by renaming the moved folder with `uniqueFolderName`. Returns `{ movedFiles, movedFolders }`.
- `moveFiles(ids, folderId)`: `folderId` null = library root; non-null must exist (404 `Folder not found`). One `updateMany`. Returns the number of rows updated.

### 3.3 Routes (in `server/src/routes/media.routes.ts`, same `mediaGuard`)

- `GET /api/media/folders` -> `{ folders: [{ id, name, parentId, fileCount, createdAt }] }`.
- `POST /api/media/folders` body `{ name, parentId?: string | null }` -> 201 `{ id, name, parentId, fileCount: 0, createdAt }`.
- `PATCH /api/media/folders/:id` body `{ name?, parentId? }` (at least one field, else 400) -> the updated folder dto.
- `DELETE /api/media/folders/:id` -> `{ success: true, movedFiles, movedFolders }`.
- `POST /api/media/move` body `{ ids: string[] (1..200), folderId: string | null }` -> `{ moved: number }`.
- `GET /api/media` gets a new optional query `folder`: `all` (default, today's behaviour, nothing changes for the picker), `root` (only files with `folderId = null`), or a folder id (files directly in that folder). Validate with zod; an unknown id returns an empty list, not an error. The `status` filter keeps working with it. The list items already spread the row, so each item now carries `folderId`.
- Map `MediaFolderError` to its status code like the existing routes map their errors. Register the static `/folders` and `/move` paths so they do not collide with `/:id`.

### 3.4 Tests: `server/test/media-folders.test.ts`

Create / duplicate (case-insensitive) / nested; depth limit; rename; move into itself and into a descendant (400); delete moves files and children up and keeps every file row; `POST /move` to a folder, to root, to a missing folder (404); `GET /api/media?folder=root|<id>|all`; `fileCount`. You cannot run the server test suite (Prisma's AI guard); write carefully and say in the report that the owner must run `! npm --prefix server test`.

## 4. Out of scope

Any client code; upload changes and zip extraction (step b); drag and drop; trash for folders; permissions changes; the picker (`GET /api/media` without `folder` must behave as before).

## 5. Constraints

No commits, no installs, never edit any `CLAUDE.md`, no secret values. Update in the same change: `docs/api-reference.md` (new routes and the `folder` query), `docs/architecture.md` (one short paragraph: library folders are virtual), `docs/CHANGELOG.md`. List wanted `CLAUDE.md` changes in your report under `## CLAUDE.md proposals for Claude`.

## 6. Gates

`npm --prefix server run build`, `npm run lint` (baseline 52 warnings, none new), `npm run build`. Report: files changed, gate results, decisions made, what you could not run.

Write your report to `D:\projects\html\ajda\docs\prompts\task-libfolders-a-report.md`.

Run with a free OpenCode model: **Beam Free** (suggested).
