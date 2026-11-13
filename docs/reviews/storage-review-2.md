# Storage Library Plan — Review #2

Model: stepfun-ai/step-5-preview
Started: 2026-11-08 17:13:02
Finished: 2026-11-08 17:16:00

---

## Scope of this review

* **Document reviewed:** `storage-library-plan.md` — the version updated on 2026-11-08 and self-titled *"Verified & Hardened on 2026-11-08: Zero Flaws Review"* (264 lines).
* **How it was reviewed:** the plan was read end to end and every factual claim in it was re-checked against the source files. No other `.md` file was used as evidence.

**Code files opened and verified during this review:**

| File | What it was checked for |
|---|---|
| `storage-library-plan.md` | the plan itself |
| `server/src/routes/media.routes.ts` | upload route, auth list, `toBuffer()` read |
| `server/src/services/mediaService.ts` | `MAX_UPLOAD_BYTES`, `detectMediaType`, `processAndSaveFile`, filename/URL shape |
| `server/src/app.ts` | multipart limits, static `/uploads/`, route prefixes |
| `server/src/middleware/auth.ts` | `hasPermission`, `requireAnyPermission`, super-admin bypass |
| `server/src/config/permissions.ts` | `PERMISSION_KEYS`, `PERMISSION_CATALOGUE`, role→user mapping |
| `server/src/types/fastify.d.ts` | `AdminPermission` union |
| `server/prisma/schema.prisma` | `Project`, `PastProject`, `CmsClient`, `CmsSection`, `AdminUser`, `DeveloperNote`, `AppSetting` |
| `server/prisma/seed-media.ts` | where seeded media actually lands on disk |
| `server/prisma/migrations/migration_lock.toml` | production provider |
| `server/prisma/migrations/20261027140000_super_admin_permissions/migration.sql` | the permission-backfill convention |
| `server/scripts/generate-prod-schema.mjs` | how the Postgres schema is produced |
| `server/package.json`, `package.json` | scripts, `three`, `sharp`, multipart |
| `server/test/media.test.ts` | existing upload coverage |
| `server/test/global-setup.ts` | how the test DB is built |
| `src/types/admin.ts` | `AdminPermissions` mirror |
| `src/services/authService.ts` | `DEFAULT_PERMISSIONS`, `normalizePermissions` |
| `src/services/mediaService.ts` | `UploadedMedia`, `uploadMedia`, accepted types |
| `src/services/api.ts` | `resolveMediaUrl` |
| `src/pages/admin/adminRoutes.ts`, `AdminDashboardPage.tsx`, `adminContextDef.ts` | `AdminSection`, `SECTION_META`, `can()` |
| `src/components/admin/layout/AdminSidebar.tsx` | nav groups |
| `src/components/admin/users/usersModel.ts` | keys, labels, `emptyPermissions()`, dependencies |
| `src/components/admin/ProjectCreateModal.tsx`, `src/pages/admin/sections/ProjectEditSection.tsx` | remove buttons and the save payload |
| `src/i18n/admin/index.ts`, `src/i18n/admin/layout.ts` | translation registry and key naming |
| `server/src/routes/auth.routes.ts`, `server/src/routes/developerNotes.routes.ts` | avatar and screenshot storage |
| `vite.config.ts` | `/uploads` proxy, same-origin production routing |

---

## Verdict

The update fixed two of the three real gaps found in review #1, and got the i18n file naming right. But the new header claim — *"Zero Flaws Review"* — is not supported by the code. There are still defects, one of which **loses live data if implemented as written**.

**Do not implement Step 0 unchanged.**

---

## What the update got right (verified)

| Claim in the plan | Code verification |
|---|---|
| `manageMedia` registered in 4 frontend/server locations | All four targets exist and are the right ones: `src/types/admin.ts:7-26` (`AdminPermissions`), `server/src/config/permissions.ts` (`PERMISSION_KEYS:141-160`), `server/src/types/fastify.d.ts:24-42` (`AdminPermission`), `src/components/admin/users/usersModel.ts` (`PERMISSION_KEYS` ~44-71, `PERMISSION_LABELS:73`, `PERMISSION_EN_LABELS:94`, `emptyPermissions():244`) |
| Usage scan now includes `AdminUser.avatar` | Real: `server/src/routes/auth.routes.ts:1419` stores `stored.url` from `POST /me/avatar`, returned by `serializeUser` at 614 |
| i18n file names | `src/i18n/admin/layout.ts` exists and uses `'nav.*'` keys (36-48); a new sibling file `media.ts` matches the repo's area pattern (`floorplan.ts`, `feedback.ts`) |
| `size Int` is safe for a 1 GB file | 1,073,741,824 < PostgreSQL `integer` max 2,147,483,647 — the plan's "up to 2.14 GB" claim holds |
| `prisma db push` is enough for the tests | `server/test/global-setup.ts:49-53` builds the test DB with `db push --schema prisma/schema.prisma` |

---

## Still wrong or missing, ranked

### 1. §2.7 "Delete Permanently" will destroy live data — HIGH
`GET /api/media/usage` reads the **database**. The "X" buttons in the project forms only mutate local React state: `ProjectEditSection.tsx:417-419` sends `image: form.image, gallery: [...form.gallery]` on save, and `ProjectCreateModal.tsx:403/445` are pure state edits.

So when `usageCount <= 1` because *the unsaved project record is the only reference*, "Delete Permanently" unlinks the file from disk while `Project.image`/`gallery` still point at it. If the admin then abandons the form (there is a dirty-check `leave()` guard at `ProjectEditSection.tsx:357`), the public site gets a permanently broken image and there is no record of what was there.

**Fix:** queue the delete and run it only *after* `AdminStorage.updateProject` resolves (`ProjectEditSection.tsx:424`), or restrict permanent deletes to the Media page. The plan must state this.

### 2. Production migration path is unspecified — HIGH
`prisma/migrations/migration_lock.toml` says `provider = "postgresql"`, and `db:migrate` = `prisma migrate deploy --schema prisma/schema.postgresql.prisma`. The handcrafted SQL is therefore applied to **PostgreSQL**, and `schema.postgresql.prisma` is a *generated* file — `scripts/generate-prod-schema.mjs:13-18` only swaps the provider line.

The checklist never says the migration SQL must be Postgres-compatible and never says to run `npm run db:gen:prod`. Result: schema drift plus a failing production deploy.

Additionally, `AdminUser.permissions` is a TEXT column holding a JSON **object**. Backfilling `manageMedia: true` needs a JSON-aware update; the string-overwrite convention used in `20261027140000_super_admin_permissions/migration.sql` will clobber existing keys.

### 3. The frontend permission mirror is still incomplete — MEDIUM-HIGH
`src/services/authService.ts:111-133` (`normalizePermissions`) has no `manageMedia`, and it is absent from `DEFAULT_PERMISSIONS` (91-108). `can()` (`AdminDashboardPage.tsx:137-154`) returns `false` for any key that is not `!== undefined`. So a non-super-admin legitimately granted `manageMedia` on the server sees **no** Media nav item and gets a dead page.

The plan's item 2 lists types + `usersModel` but not `authService.ts`.

Also worth stating explicitly in the plan: `hasPermission` (`auth.ts:73-97`) bypasses only for `role === 'super_admin'`, so a migration that backfills only super_admin means every other role and user gets `false`. That is correct behaviour — but the plan currently reads as if the permission is automatic.

### 4. Frontend service layer is never mentioned — MEDIUM-HIGH
`src/services/mediaService.ts:3-6` defines `UploadedMedia { url, filename }` and `uploadMedia()` (83-100) returns only that. The plan's new response shape (`id, originalName, size, fileType`) plus three new endpoints have **no client code**. `MAX_UPLOAD_BYTES` is duplicated client-side (line 17) and `ACCEPTED_*_TYPES` (13-14) is hardcoded to image + PDF.

Neither `MediaSection.tsx` nor `MediaPickerModal.tsx` can be built without a `listMedia / getMediaUsage / deleteMedia` service.

### 5. `fileType: 'model3d'` is currently unreachable — MEDIUM
`detectMediaType` (`server/src/services/mediaService.ts:59-81`) returns only `'image' | 'pdf' | null`, GLB magic is not checked, and `processAndSaveFile` throws at line 140 for anything else. So the `'model3d'` value, the `type=model3d` filter and the "3D Models" tab are dead code until Step 4.

Either drop them from Step 0 or state the allowlist change.

### 6. The boot scan will not find most existing files — MEDIUM
* Seeded media lives in `uploads/seed/**` (`prisma/seed-media.ts:12-13, 98-100`). A non-recursive scan of `server/uploads/` contradicts the plan's own claim that "existing site images and PDFs appear immediately".
* `detectMediaType` needs a whole-file Buffer. Scanning the corpus at boot must read only the first 12 bytes (the guard at `mediaService.ts:60`), not every byte of every file.
* Running it "when `GET /api/media` is called" puts fs work on a request path. Keep it at startup (the earlier `scripts/sync-existing-media.ts` idea was better) or guard it with a lock.
* Backfilled `thumbnailUrl` and `metadata { width, height, format }` require `sharp().metadata()`, i.e. decoding the entire existing image corpus at boot. Cap it or make it lazy.

### 7. Usage scan still misses two media-holding fields — MEDIUM
`DeveloperNote.screenshotUrl` (`schema.prisma:348`) explicitly accepts `/uploads/` paths (`developerNotes.routes.ts:40`) — a note's screenshot will show as orphaned and can be deleted from under the note. `AppSetting.value` (268-273) is a free-form JSON blob holding site image settings. Neither is listed in §2.3.

### 8. CMS filename matching needs a precise definition — LOW-MEDIUM
"searches for occurrences of the filename inside stored JSON" is ambiguous. State it as exact `/uploads/<filename>` token matching, otherwise `abc.webp` can match inside `xabc.webp`.

Also decide the absolute-URL case: `resolveMediaUrl` (`api.ts:325-329`) prefixes `VITE_API_BASE_URL`, and `uploadMedia()` returns that absolute form to the forms. `VITE_API_BASE_URL` is currently unset anywhere in the repo, so stored values are relative today — but that is an env-dependent landmine, and the scanner should normalise both forms.

### 9. `getBatchMediaUsage()` is "one round-trip", not "one fast query" — LOW-MEDIUM
It still loads every `CmsSection.content` blob and string-matches it; there is no index for substring JSON search in SQLite or PostgreSQL. It is one HTTP round trip, not one fast query, and it runs *before* `status=orphaned` filtering — which means pagination can only be correct after usage is computed for all rows. Add that sentence and a cap.

### 10. Step 4 has two unlisted blockers — MEDIUM (forward-looking)
`app.ts:136-139` registers `@fastify/multipart` with `limits.fileSize = MAX_UPLOAD_BYTES` (50 MB) for **all** routes, and `media.routes.ts:17` does `await data.toBuffer()`. "1 GB at flat < 20 MB RAM" requires both raising or route-scoping that limit and switching to a `data.file` stream. Neither appears in the Step 4 list.

### Minor
* **`media` not registered in `adminStrings`** (`src/i18n/admin/index.ts:29-51`). `AdminKey` is derived from that map (56-58), so the new `media.ts` file must be imported and added there or `useAdminT('media.*')` fails to compile.
* **Delete path safety:** state that `storageKey` is resolved and containment-checked against `UPLOAD_DIR` before `fs.unlink`.
* **`url @unique` + backfill:** must be an upsert keyed on `url`, or a re-scan throws `P2002`.
* **Checklist says "Write Vitest suite `server/test/media.test.ts`"** — the file already exists (91 lines: WebP re-encode, forced `.pdf` extension, rejection). Say *extend*.
* **Adding `manageCms` to the upload route** (§2.4:111) widens who can upload. Correct by intent, but flag it as a permission change instead of folding it in silently.
* **`status=orphaned` filtering** requires usage computed before pagination (see item 9).

---

## Bottom line

As a **dev SQLite demo** the plan is implementable. As written it would:

1. ship a data-loss bug in §2.7,
2. break the production PostgreSQL migration,
3. render the Media page invisible to every non-super-admin, and
4. hide the seeded corpus from the library.

Fix items 1-6 before anyone starts coding and this becomes a solid plan.

Remove *"Zero Flaws Review"* from the plan header. It invites the next reader to skip exactly the verification that found these issues.
