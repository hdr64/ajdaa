# Review: `storage-library-plan.md`

> Reviewed against the actual codebase on 2026-11-08. Every claim below was verified
> against source files in this session; anything not verifiable is labeled as an
> assumption, not a fact.

## Summary of verdict

The roadmap order (MVP → trash & permissions → asset picker → chunked 1 GB uploads →
3D viewer → hardening) is sound. The core problem is that the plan was written as if
the storage feature were greenfield:

1. It duplicates an existing, working media/upload pipeline without mentioning it.
2. Step 1 ships unauthenticated file endpoints because auth is deferred to Step 2.
3. The Step 4 chunking spec is technically incorrect (append-based retry corrupts
   files, reversed magic bytes, `BigInt` serialization, `.gltf`/`.obj` claims).
4. Two referenced files don't exist, and the frontend integration points are bigger
   than the plan states.

Fix findings M1–M5 before starting Step 1; they change the implementation. Findings
F1–F2 change only who gets surprised by what, and D1–D6 are design omissions to fold
into the plan text.

---

## Major findings (must fix)

### M1 — The plan ignores the existing media/upload system

The repo already has a complete upload pipeline:

- `POST /api/media/upload` — `server/src/routes/media.routes.ts`, gated by
  `authenticate` + `requireAnyPermission('manageProjects', 'managePastProjects')`.
- 50 MB cap via `MAX_UPLOAD_BYTES = 50 * 1024 * 1024` and magic-byte validation
  (`detectMediaType`) in `server/src/services/mediaService.ts`.
- Disk storage under `server/uploads`, served statically at `/uploads/` by
  `@fastify/static` (`server/src/app.ts`).
- The frontend already consumes it: `src/services/mediaService.ts:95` posts to
  `/api/media/upload`; `ProjectCreateModal.tsx` uses it for image and brochure.

The plan defines a parallel engine (`POST /api/storage/files/upload`, its own mime
rules and disk paths) with zero mention of the above. Consequences:

- Two upload paths, two disk stores, broken single source of truth for "what files exist".
- Permission mismatch: the existing route requires `manageProjects`/`managePastProjects`,
  while the new one gets a different key (`uploadStorage`) — the same user may be able
  to upload through one route and not the other.
- The Step 3 asset picker silently switches which service project files land in.

**Fix:** share `MAX_UPLOAD_BYTES`, `detectMediaType` and the upload directory
configuration; either absorb the media pipeline into the storage library or keep the
two systems explicitly separated (see the media-library recommendation in the appendix).

### M2 — No authentication or authorization anywhere in Step 1

Every admin route in this repo uses `authenticate` + `requirePermission` /
`requireAnyPermission` (`server/src/middleware/auth.ts:100–109`). The plan's Step 1
defines six admin endpoints (folder create/list/rename, file upload/rename/download)
and mentions auth nowhere — RBAC is deferred to Step 2. As written, Step 1 ships an
unauthenticated file-upload API to production.

**Fix:** state Step 1's guard explicitly (e.g. authenticate + an existing permission
key or a new `viewStorage`/`uploadStorage` pair added in Step 1, not Step 2), and make
the upload/download paths part of the Step 1 verification gate.

### M3 — Project references are plain URL strings; no referential integrity in Step 3

Verified in `server/prisma/schema.prisma` (`model Project`, lines 146–190):
`image` (168), `gallery` (169, JSON string array), `model3dUrl` (177),
`brochureUrl` (183), `virtualTour3dAvailable` (178) — all strings/flags, no foreign
keys. Past projects have the same pattern (the route validates image URLs against
`/^(https:\/\/|\/uploads\/)/`, `server/src/routes/pastProjects.routes.ts:8`).

Once the Step 3 asset picker writes storage URLs into those fields, nothing prevents
moving, renaming, trashing, or purging that file later — projects break silently.

**Fix:** either a "file is in use" guard on storage delete/rename/move (scan
project/past-project/CMS fields for the URL), or an explicit dependency graph.
Pick one before Step 3, not during it.

### M4 — The Step 4 chunked-upload design cannot deliver what it promises

Four concrete defects:

1. **Append-based retry corrupts files.** Appending chunks with
   `fs.createWriteStream({ flags: 'a' })` means that after any partial write or
   out-of-order resend, "re-send only the failed 15 MB chunk" duplicates bytes.
   Safe retry requires writing each chunk at its exact byte offset
   (`fs.write(fd, buffer, offset)`) or a server-side chunk manifest, then verifying
   offsets before finalize.
2. **Finalize validation is incomplete.** No declared-size vs received-size check
   and no checksum; a truncated upload passes as long as the header survived.
3. **The magic-byte value is reversed.** `0x46546C67` decodes as `FTlg`. The GLB
   header magic is `glTF` = bytes `0x67 0x6C 0x54 0x46`.
4. **The format list contradicts the validation.** Step 4 claims `.glb`, `.gltf`
   and `.obj` up to 1 GB, but the `glTF` magic only matches `.glb`. A `.gltf` also
   references external `.bin`/texture files, which a single-file upload breaks.
   Either scope Step 4 to `.glb` or add real handling for the others.

**Fix:** rewrite the chunk engine section: offset-based writes, size+checksum
verification at complete, correct GLB magic, and an honest format scope.

### M5 — `size: BigInt` breaks JSON responses

Fastify serializes responses with `JSON.stringify`, which throws on `BigInt`;
nothing in `server/src` handles BigInt serialization (grep found only an unrelated
`writeBigUInt64BE` in `totpService.ts:90`). It is also unnecessary here: a 32-bit
integer covers up to 2,147,483,647 bytes (~2 GB), more than the plan's 1 GB cap.

**Fix:** store `size Int`, or if BigInt is kept, add explicit serializer handling.

---

## Factual errors in referenced paths

### F1 — `src/config/permissions.ts` does not exist

Step 2 says to register the new permission keys in "`server/src/config/permissions.ts`
and `src/config/permissions.ts`". There is no `src/config/` directory in the frontend
(verified with `Test-Path`). Adding `viewStorage`/`uploadStorage`/`manageStorage`
actually touches:

- `server/src/config/permissions.ts` — `PERMISSION_CATALOGUE` and `PERMISSION_KEYS`.
- `server/src/types/fastify.d.ts` — the `AdminPermission` union type.
- Role seeding — the `20261027140000_super_admin_permissions` migration pattern; a
  new key is invisible to all existing roles until seeded, because
  `parseRolePermissions` silently filters unknown keys to `[]`.

### F2 — "Add to Admin Sidebar under the Content group" understates the frontend work

The content group does exist (`nav.group.content` in `src/i18n/admin/layout.ts`),
but admin navigation is a typed custom router, not a path-based router: adding
`/admin/storage` and a Trash section requires new members in the `AdminSection`
union and `SIMPLE_SECTIONS` in `src/pages/admin/adminRoutes.ts`. The plan should
name these files.

---

## Design omissions

1. **Trash semantics.** No cascade story for soft-deleting a folder that has
   children, restoring a child whose parent is still trashed, or purging nested
   contents *and their files from disk*. `isDeleted`-flag trash over hierarchical
   folders is where this design will hurt most.
2. **Move cycle prevention.** Nothing stops moving a folder into its own
   descendant, which wedges the breadcrumb/path tree.
3. **The `path` column is dead in Step 1.** It is denormalized on creation, but the
   plan's move/rename operations never update it — yet Step 2's restore is defined
   as "back to original path". Either maintain it on every mutation or drop it and
   derive breadcrumbs from parent chain.
4. **Verification is manual-only in Step 1.** The repo already runs a vitest server
   suite (`server/test/`, `npm test` → `vitest run`). API tests for folder hierarchy
   and upload/download belong in Step 1, not fully deferred to Step 6.
5. **Endpoint naming inconsistency.** `GET /api/storage/folders?parentId=` is
   documented as listing subfolders *and files*; name the route after what it
   returns (`contents` / `tree`).
6. **Unmeasured production constraints.** The 20 MB RAM claim for chunk piping is
   plausible but unbenchmarked, and nothing covers reverse-proxy body-size limits
   for 15 MB POSTs in the deployed environment: the API deploys over SSH to
   `/srv/ajda/app` with a reload/migration-check script (`scripts/deploy-prod.mjs`),
   and the SPA deploys via GitHub Actions from the `deploy-test` branch
   (`scripts/deploy-test.mjs`).

---

## Unverified / optimistic claims — treat as assumptions

- **"Progressive byte-range loading (HTTP 206)"** (Step 4/5): `@fastify/static` v10
  exposes `acceptRanges` for the static `/uploads/` prefix (verified at
  `server/node_modules/@fastify/static/index.js:63`), but the plan's own
  `GET /api/storage/files/:id/download` endpoint would need manual Range handling,
  and the plan doesn't say which of the two it relies on. Separately, Three.js
  `GLTFLoader` fetches whole files; byte-range streaming of `.glb` is not free from
  either `<model-viewer>` or Three.js. Step 5's "progressive" promise needs a
  concrete mechanism or a stated fallback.
- **`<model-viewer>` choice:** the repo already ships `three` ^0.185.1 and
  `@dimforge/rapier3d-compat` in root `package.json` and a `BuildingVisualizer.tsx`
  component. Adding `<model-viewer>` stacks a second 3D stack; the plan should
  justify it against the existing Three.js one.

## Items that check out

- `docs/api-reference.md`, `docs/architecture.md`, `CHANGELOG.md` all exist — the
  Step 6 documentation targets are valid.
- The DB approach roughly matches repo reality: dev SQLite via `prisma db push`,
  production PostgreSQL via a generated `schema.postgresql.prisma`
  (`server/scripts/generate-prod-schema.mjs`) plus handwritten SQL migrations and
  `prisma migrate deploy`. One caveat: the plan never mentions the
  `npm run db:gen:prod` step — a contributor following only the plan would migrate
  against a stale prod schema.
- The 50 MB limit in Step 1 matches `MAX_UPLOAD_BYTES` — but it should match by
  *sharing* that constant (see M1), not by coincidence.
- `npm --prefix server run build` (TypeScript compile) and the lint/test scripts the
  plan references exist in the respective `package.json` files.

---

## Appendix — follow-up decision recorded in review (2026-11-08)

Question asked: should the admin dashboard get a **media tab** showing uploaded
media, and should **project creation allow picking a media file from that library**?

Context verified:

- Uploaded media currently has **no database record**: `processAndSaveFile` writes
  to disk and returns a URL string; `schema.prisma` has no `Media` model. Nothing
  tracks what files exist, where they're used, or what's orphaned.

Decision:

1. **Yes to both — on a small registry.** Add a `MediaFile` model
   (`id, storageKey, url @unique, originalName, mimeType, size, createdAt`), write
   one row from the existing `POST /api/media/upload`, expose `GET /api/media`
   (paged list) and `GET|DELETE /api/media/:id`. The tab itself is a new `media`
   entry in `AdminSection` + `SIMPLE_SECTIONS`; a card grid with mime-filtered
   previews, copy-URL, and delete-with-usage-check (scan Project, past projects and
   CMS fields for the URL before deleting). Guard v1 with permissions content
   editors already have
   (`requireAnyPermission('manageProjects', 'manageCms', 'managePastProjects')`);
   introduce a dedicated `manageMedia` key later only if roles demand it.
2. **Point the project-form picker at the media registry, not the folder Drive.**
   `<MediaPickerModal />`: list from `GET /api/media`, filter by mime, direct-upload
   tab reusing `src/services/mediaService.ts` so both tabs write registry rows. The
   picker copies the URL into the existing string field — zero friction with the
   current model.
3. **Keep the two systems separate**, matching the plan's revised role:
   media library = images/PDF consumed by site content (flat, auto-recorded,
   ≤ 50 MB through the existing route); folder storage = arbitrary admin files and
   custom data (hierarchical, chunked 1 GB uploads stay here). A shared asset-picker
   component can wrap both later — don't couple them now.
4. **Do not generate the media tab from `readdir` on `/uploads`.** Without registry
   rows there are no original names, sizes, or usage data — the tab's core value
   would be missing.
