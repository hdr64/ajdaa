# task-libfolders-a report

Model: GLM (Z.ai)
Started: 2026-11-11 19:25 UTC
Finished: 2026-11-11 20:05 UTC

Note: this run happened on the uploaded `ajda.zip` (source-only snapshot: no `docs/`, no `tsconfig.json`, no `vite.config.*`, no `server/scripts/`, no vitest config, no binary assets). Everything below reflects what could actually be executed in that environment. The owner should re-run the gates after copying the files into the real checkout.

## Files changed

- `server/prisma/schema.prisma` — new `MediaFolder` model (self-relation "MediaTree", `onDelete: Restrict` on the parent, `@@index([parentId])`, `@@map("media_folders")`); `MediaFile` gains `folderId String?`, the `folder` relation with `onDelete: SetNull`, and `@@index([folderId])`.
- `server/prisma/migrations/20261113100000_media_folders/migration.sql` — NEW, hand-written PostgreSQL in the style of `20261112100000_drive` (create table, `parentId` FK with `ON DELETE RESTRICT`, `media_files.folderId` with `ON DELETE SET NULL`, both indexes).
- `server/src/services/mediaFolderService.ts` — NEW. `MediaFolderError` (statusCode), `cleanFolderName` (NFC, trim, required, max 120, no `.`/`..`, no `/`/`\`/control chars → 400), case-insensitive sibling-uniqueness checked in code (409 `A folder with this name already exists here`), depth limit 5 (root = 1 → 400 `Folders can be nested at most 5 levels`), `Cannot move a folder into itself` for self/descendant moves; `listFolders()` (one `groupBy` for fileCount), `createFolder`, `updateFolder` (rename and/or move; the name must also be free in the destination), `deleteFolder` (one `$transaction`: children + files move up one level, clashes resolved with `uniqueFolderName`, folder row deleted, files never deleted; returns `{ movedFiles, movedFolders }`), `moveFiles` (single `updateMany`, 404 `Folder not found` for a missing target), and the exported `uniqueFolderName(parentId, wanted)` helper (optional third param for transaction clients, used by step b).
- `server/src/routes/media.routes.ts` — `GET /folders`, `POST /folders`, `PATCH /folders/:id` (400 when neither `name` nor `parentId`), `DELETE /folders/:id` (`{ success, movedFiles, movedFolders }`), `POST /move` (`ids` 1..200 uuids, `folderId` uuid|null → `{ moved }`), all behind the existing `mediaGuard` and registered before the `/:id` routes; `MediaFolderError` mapped to its status code; `GET /` gains the zod-validated `folder` query (`all` default / `root` / uuid; an unknown id yields an empty list, not an error) and the `status` filter keeps working with it. Items already spread the row, so each item now carries `folderId`.
- `server/test/media-folders.test.ts` — NEW. Create / duplicate (case-insensitive) / nested; invalid names; unknown parent 404; depth limit; rename; rename clash 409; move into itself and into a descendant (400); move onto a held name (409); delete resolves clashes by renaming (`name (2)`); delete moves files and children up and keeps every file row; `POST /move` to a folder, to root, to a missing folder (404); `fileCount`; `GET /api/media?folder=root|<id>|all` incl. unknown id → empty and combined with `status=linked`.
- Docs (`docs/api-reference.md`, `docs/architecture.md`, `docs/CHANGELOG.md`) — NOT updated: `docs/` is not part of the uploaded zip, so the files do not exist here. The owner should apply the planned doc lines (new routes, the `folder` query, one paragraph "library folders are virtual") in the real checkout.

## Decisions made

- `MediaFolder.parent` uses `onDelete: Restrict` exactly as decided; the test cleanup therefore deletes leaves first.
- A move that lands on an existing case-insensitive sibling name answers 409 (per the decided design); automatic renaming with `uniqueFolderName` happens only where the design says so (deleteFolder promoting children).
- The route-level zod union for `folder` is `z.literal('all') | z.literal('root') | z.string().uuid()`; a syntactically invalid id is a 400 (validation), an unknown but well-formed id is an empty page (as decided).
- The `sort` query of step e was added to `GET /` in the same edit (same file, shared `orderBy` used by both the `status === 'all'` branch and the linked/orphaned light query); see the step-e report.

## Gate results (as far as the snapshot allows)

- `npm --prefix server run build` — could not run as-is: `server/tsconfig.json` is not in the uploaded zip. Replaced by a throwaway strict `tsc --noEmit` (NodeNext) over `src/` + `test/`: **0 errors in all files touched by this task** (pre-existing files show a few errors that stem from the missing repo config, e.g. `prisma/seed.ts` `.ts`-extension imports and tests importing `server/scripts/*`, which the zip does not contain).
- `prisma db push` on a throwaway SQLite DB: **schema pushes cleanly** (the new table/column/FKs/indexes are valid for the dev path too).
- `npm run lint` — ran oxlint over the snapshot: 0 errors; the only warning in a file of this task was an unused import in the new test, fixed. (Warning counts differ from the 52 baseline because the snapshot lacks config files; nothing new was added.)
- Tests: the suite cannot run via `npm --prefix server test` here (the repo's `vitest.config.ts` is not in the zip). It was recreated as a throwaway config with the same `globalSetup`/`setupFiles` wiring: **the whole server suite passes: 553 tests / 55 files, 0 failures** — including `media-folders.test.ts` (12 tests) and the untouched `media.test.ts`, `media-zip.test.ts`, `media-chunked.test.ts`. The only file that cannot even import is `test/devUser.test.ts`, which needs `server/scripts/` — absent from the zip, pre-existing.
- The hand-written PostgreSQL migration was **not** executed (no PostgreSQL here); the owner runs `db:migrate` as usual.

## What I could not run

- The real `tsc` build with the repo's tsconfig, the real lint baseline, and `! npm --prefix server test` via the repo config — all need files outside the uploaded zip. The owner must run the three gates by hand after copying the files.
- Docs updates (see above).
- Production migration — owner-only by policy.

## CLAUDE.md proposals for Claude

- Gates note: `npm --prefix server test` now covers 55 files / 553 tests (update the counts line on the next merge).
- Database facts: mention `media_folders` next to the Drive folders when the library paragraphs are next touched (one home per fact: details live in `docs/architecture.md`).

Task ID: 2-a (master task `libfolders`, step a).
