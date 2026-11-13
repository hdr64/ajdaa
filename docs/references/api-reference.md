# Ajda Real Estate Platform — API Reference

> **Last Updated**: 2026-10-01  
> **Base URL**: `/api`  
> **Content-Type**: `application/json`

## Route index

Guards: **public** (no session; most are rate limited), **JWT** (any signed-in admin), **`perm`** (JWT plus that permission; `super_admin` always passes), **super admin** (role `super_admin`). Permission names are the ones in the `permissions` catalogue (`GET /api/permissions`).

### Auth (`/api/auth`)

| Route | Guard | Purpose |
|---|---|---|
| `POST /login` | public | Password login. Returns a session, or a challenge (email code, TOTP, enrol-TOTP, email verification). |
| `POST /login/verify-otp`, `POST /login/resend-otp` | public | Email login code (challenge id + code). |
| `POST /login/verify-totp` | public | Authenticator code or recovery code. |
| `POST /login/enroll-totp/setup`, `POST /login/enroll-totp/verify` | enrolment token | Forced TOTP enrolment during login. |
| `POST /passkeys/login/options`, `POST /passkeys/login/verify` | public | Passkey (WebAuthn) sign-in. |
| `POST /password/forgot`, `POST /password/reset` | public | Password reset by emailed code. |
| `POST /accept-invite` | public | Invited user sets their own password (link token). |
| `POST /verify-email`, `POST /verify-email-code`, `POST /verify-email-code/resend` | public | Confirm an email address by link token or 6-digit code. |
| `GET /me`, `PATCH /me` | JWT | Current profile and permissions; update name, email, phone. |
| `POST /me/avatar`, `DELETE /me/avatar` | JWT | Upload (images only) or remove the profile picture. |
| `POST /me/password/request`, `POST /me/password` | JWT | Two-step password change: request an emailed code, then submit it with the new password. |
| `GET /me/preferences`, `PUT /me/preferences` | JWT | Per-user UI preferences. |
| `PATCH /me/login-otp` | JWT | Turn the personal email login code on or off. |
| `POST /me/totp/setup`, `/enable`, `/disable`, `/recovery-codes` | JWT | Authenticator-app 2FA and recovery codes (disable and regenerate need the password plus a code). |
| `GET /passkeys`, `PATCH /passkeys/:id`, `DELETE /passkeys/:id` | JWT | List, rename, remove own passkeys. |
| `POST /passkeys/register/options`, `POST /passkeys/register/verify` | JWT | Register a passkey. |
| `GET /users`, `GET /users/export`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id` | `manageUsers` (export also `exportData`) | Admin user management. |
| `POST /users/:id/resend-verification` | `manageUsers` | Re-send the verification email. |
| `POST /users/:id/mark-verified` | `verifyUsers` | Mark an email as verified by hand. |
| `POST /users/:id/reset-totp`, `POST /users/:id/reset-passkeys` | `manageUsers` | Clear another admin's second factor. |

### Projects, floors, units, categories

| Route | Guard |
|---|---|
| `GET /projects`, `GET /projects/:id` | public (published only; `?scope=admin` needs a session) |
| `GET /projects/export` | `exportData` |
| `POST /projects`, `PUT /projects/:id`, `DELETE /projects/:id`, `PATCH /projects/:id/publish`, `POST /projects/:id/duplicate` | `manageProjects` |
| `POST /projects/:id/floors`, `PUT /projects/:id/floors/:floorNumber`, `DELETE /projects/:id/floors/:floorNumber` | `manageProjects` |
| `POST /units`, `PUT /units/:id`, `DELETE /units/:id`, `PATCH /units/:id/status` | `manageUnits` |
| `GET /units/export` | `exportData` |
| `GET /categories` | public |
| `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` | `manageProjects` |
| `POST /media/upload`, `GET /media`, `GET /media/usage`, `DELETE /media/:id` | `manageProjects`, `managePastProjects`, `manageMedia`, or `manageCms` |
| `/drive/*` (list, folders, upload, move, copy, trash, restore, purge, download) | `manageMedia` (same rule as the media library) |
| `GET /d/:slug` | public, only while the file is shared |

### Past projects, careers, newsletter, inquiries

| Route | Guard |
|---|---|
| `GET /past-projects` | public |
| `GET /past-projects/admin`, `POST /past-projects`, `PUT /past-projects/:id`, `PATCH /past-projects/:id/published`, `DELETE /past-projects/:id` | `managePastProjects` |
| `GET /careers/form` | public (form configuration) |
| `POST /careers/applications` | public (multipart, optional CV PDF) |
| `GET /careers/applications`, `GET /careers/applications/:id`, `GET /careers/applications/:id/cv` | `viewApplications` |
| `PATCH /careers/applications/:id`, `DELETE /careers/applications/:id`, `GET /careers/settings`, `PUT /careers/settings` | `manageApplications` |
| `POST /newsletter` | public (idempotent) |
| `GET /newsletter`, `GET /newsletter/export`, `DELETE /newsletter/:id` | `exportData` |
| `POST /inquiries` | public (spam fields, rate limited; queues the notification email) |
| `GET /inquiries`, `GET /inquiries/:id`, `PATCH /inquiries/:id`, `PATCH /inquiries/:id/status` | `viewInquiries` (known gap: writes should need their own permission, see `docs/admin-audit.md` P0 #1) |
| `GET /inquiries/export` | `exportData` |
| `DELETE /inquiries/:id` | super admin |

### Roles, departments, settings, notifications

| Route | Guard |
|---|---|
| `GET /permissions` | JWT |
| `GET/POST /roles`, `PUT/DELETE /roles/:id`, `GET/POST /departments`, `PUT/DELETE /departments/:id` | `manageUsers` |
| `GET /settings/site` | public (contact details, careers switches, project-card 3D switch) |
| `PUT /settings/site`, `GET/PUT /settings/security`, `GET/PUT/DELETE /settings/mail`, `POST /settings/mail/test` | super admin |
| `GET/POST /notifications/listeners`, `PUT/DELETE /notifications/listeners/:id` | `manageNotifications` |

### CMS (`/api/cms`)

| Route | Guard |
|---|---|
| `GET /content`, `GET /content/:key`, `GET /clients` | public (ETag, HTTP 304) |
| `PUT /content/:key`, `GET /content/:key/versions`, `GET /export`, `POST /import` | `manageCms` |
| `POST /content/:key/rollback/:version` | `rollbackCms` |
| `GET /clients/all`, `POST /clients`, `PUT /clients/:id`, `DELETE /clients/:id`, `PUT /clients/reorder`, `DELETE /clients/bulk`, `PATCH /clients/bulk-visibility` | `manageClients` |

### Logs, developer notes, health

| Route | Guard |
|---|---|
| `GET /logs/view` (HTML console), `POST /logs/client-error` (browser crash beacon) | public (the console itself asks for the key and a session) |
| `GET /logs`, `GET /logs/raw`, `GET /logs/errors`, `GET /logs/stats`, `POST /logs/clear`, `POST /logs/errors/clear` | super admin session plus `x-logs-key` header (unless `LOGS_PUBLIC=true`) |
| `POST /developer/notes` | JWT (any admin) |
| `GET /developer/notes`, `GET /developer/notes/export`, `GET/PATCH/DELETE /developer/notes/:id` | super admin session plus `x-dev-notes-key` header |
| `GET /health` | public (`{ status, version }`) |

### SEO (search engines, public, no auth)

| Route | Notes |
|---|---|
| `GET /robots.txt` (site root, not under `/api`) | Allows crawling and links the sitemap when `SEO_INDEXING=on`; `Disallow: /` otherwise. |
| `GET /sitemap.xml` (site root) | Home, static pages and every **published** project (`lastmod`, main image) across both Arabic and English (`/en/...`) URLs with bidirectional `xhtml:link` alternate tags. Empty `<urlset>` plus `X-Robots-Tag: noindex` when indexing is off. Cached 10 min. |
| `GET /api/seo/shell?path=/projects/5` | The built `index.html` with per-page title, description, self-canonical, hreflang trio (`ar`, `en`, `x-default`), robots, OpenGraph, Twitter and JSON-LD tags and a `<noscript>` block. Supports `/en` and `/en/...` URLs with English copy and `<html lang="en" dir="ltr">`. 200, or 404 + noindex for unknown paths, unpublished/missing projects and `/en/admin`. Admin paths are noindex. 5xx with an empty body when the template or database fails (Caddy then serves the static file). `ETag`/304, cached 60 s. Called by Caddy, not by the SPA. |

---

## 1. Authentication & Security (`/api/auth`)

### POST `/api/auth/login`
Authenticates an administrator with email and password. Returns a JWT or indicates email OTP is required.

**Request:**
```json
{
  "email": "admin@ajda.sa",
  "password": "StrongPassword123!"
}
```

**Response (200 OK — Direct Session):**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "admin-uuid",
    "email": "admin@ajda.sa",
    "name": "المدير العام",
    "role": "super_admin",
    "permissions": {}
  }
}
```

**Response (200 OK — OTP Required):**
```json
{
  "otpRequired": true,
  "challengeId": "challenge-uuid",
  "emailHint": "a***@ajda.sa"
}
```

---

### POST `/api/auth/login/verify-otp`
Validates a 6-digit email verification code for login or password reset.

**Request:**
```json
{
  "challengeId": "challenge-uuid",
  "code": "482910"
}
```

---

### POST `/api/auth/login/verify-totp`
Validates an authenticator-app code (or a recovery code) for a login challenge.

**Request:**
```json
{
  "challengeId": "challenge-uuid",
  "code": "482910"
}
```
A recovery code is also accepted here (`XXXXX-XXXXX`), and is marked used once verified.

**Response (200 OK):**
```json
{
  "token": "jwt-session-token",
  "user": { "id": "uuid", "email": "a***@ajda.sa", "totpEnabled": true, "recoveryCodesLeft": 9 }
}
```

---

### POST `/api/auth/login/enroll-totp/setup`
Returns the pending secret and `otpauth://` URI for an enrollment token. Called once per enrollment attempt.

**Headers:** `Authorization: Bearer <totp_enroll_token>`

**Response (200 OK):**
```json
{
  "otpauthUri": "otpauth://totp/Ajda:admin@ajda.sa?secret=...&issuer=Ajda&algorithm=SHA1&digits=6&period=30",
  "secret": "AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH"
}
```

---

### POST `/api/auth/login/enroll-totp/verify`
Confirms a live code, activates TOTP, and issues a session plus the one-time recovery codes.

**Headers:** `Authorization: Bearer <totp_enroll_token>`

**Request:**
```json
{ "code": "482910" }
```

**Response (200 OK):**
```json
{
  "token": "jwt-session-token",
  "user": { "totpEnabled": true },
  "recoveryCodes": ["A2B3C-D4E5F", "8 more"]
}
```

---

### GET `/api/auth/me`
Retrieves current authenticated admin session data, permissions, and department info.

**Headers:** `Authorization: Bearer <jwt_token>`

---

## 2. Content Management System (CMS) (`/api/cms`)

### GET `/api/cms/content`
Returns the complete aggregated website content (nav, footer, home, works, clientsPage, contact, pastWorks, careers). Supports deterministic ETags and returns HTTP 304 if unchanged.

**Headers:** `If-None-Match: W/"cms-agg-v4-1727738200000"` (optional)  
**Access:** Public  
**Rate Limit:** 120 req / min  

**Response (200 OK):**
```json
{
  "nav": [...],
  "footer": {...},
  "home": {...},
  "works": {...},
  "clientsPage": {...},
  "contact": {...},
  "pastWorks": {...},
  "careers": {...}
}
```

**Newer optional fields** (both tolerant by design: a `CmsSection` row saved before they existed is served with the defaults, and a payload that omits them still validates):

| Section | Field | Type | Default |
|---|---|---|---|
| `contact` | `trustEnabled` | boolean | `true` |
| `contact` | `trustItems` | array of `{ id, textAr, textEn }`, max 6, each text max 120 chars | the three public trust bullets |
| `footer` | `madeInKsaEnabled` | boolean | `false` (the line stays hidden until switched on) |

**Response (304 Not Modified):** Empty body, 0ms latency.

---

### GET `/api/cms/content/:key`
Returns single section content. Key options: `nav`, `footer`, `home`, `works`, `clientsPage`, `contact`, `pastWorks`, `careers`.

**Access:** Public  
**Rate Limit:** 120 req / min  
**Headers:** `If-None-Match: W/"sec-footer-v3-1727738000000"` (optional)  

---

### PUT `/api/cms/content/:key`
Updates section JSON payload, increments version, archives snapshot, and invalidates cache.

**Access:** Admin (`manageCms`)  
**Rate Limit:** 60 req / min  
**Request:** Section JSON object matching section schema.  
**Special Guard:** For `key === 'works'`, validates that `featuredProjectId` exists in the database if supplied.

**Response (200 OK):**
```json
{
  "success": true,
  "version": 4,
  "updatedAt": "2026-10-01T00:20:00.000Z"
}
```

**Response (409 Conflict):** returned when two concurrent saves collide on the version unique constraint.
```json
{ "error": "A concurrent edit conflict occurred; please retry." }
```

---

### GET `/api/cms/content/:key/versions`
Fetches the last 10 version snapshot archives for audit history and inspect.

**Access:** Admin (`manageCms`)  
**Rate Limit:** 60 req / min  

**Response (200 OK):**
```json
[
  {
    "id": "ver-uuid-1",
    "version": 3,
    "createdAt": "2026-09-30T22:00:00.000Z",
    "createdById": "admin-uuid",
    "content": {...}
  }
]
```

---

### POST `/api/cms/content/:key/rollback/:version`
Restores a section to an earlier snapshot in one click, incrementing to a new active version.

**Access:** Admin (`rollbackCms`)  
**Rate Limit:** 30 req / min  

---

### GET `/api/cms/clients`
Returns public list of visible partners and clients sorted by `order`.

**Access:** Public  
**Rate Limit:** 120 req / min  

---

### GET `/api/cms/clients/all`
Returns all partner records (both visible and hidden) for the admin dashboard.

**Access:** Admin (`manageClients`)  

---

### POST `/api/cms/clients`
Creates a new corporate client/partner record.

**Access:** Admin (`manageClients`)  
**Request:**
```json
{
  "nameAr": "شركة المنيع للأجهزة الكهربائية",
  "nameEn": "Almanea Electronics",
  "sectorAr": "الأجهزة المنزلية",
  "sectorEn": "Home Appliances",
  "descAr": "نبذة عن الشراكة...",
  "descEn": "Partnership summary...",
  "logo": "/uploads/uuid.webp",
  "tagsAr": ["معارض كبرى", "لوجستي"],
  "tagsEn": ["Showrooms", "Logistics"],
  "websiteUrl": "https://almanea.sa",
  "order": 1,
  "visible": true
}
```

---

### PUT `/api/cms/clients/:id`
Updates an existing client record.

---

### DELETE `/api/cms/clients/:id`
Permanently deletes a client record.

---

### PUT `/api/cms/clients/reorder`
Updates display ordering for an array of client IDs.

**Request:** `{"ids": ["id-1", "id-2", "id-3"]}`

---

### PATCH `/api/cms/clients/bulk-visibility`
Batch toggle visible state for selected partner IDs.

**Request:** `{"ids": ["id-1", "id-2"], "visible": true}`

---

### DELETE `/api/cms/clients/bulk`
Batch deletes selected partner IDs.

**Request:** `{"ids": ["id-1", "id-2"]}`

---

### GET `/api/cms/export`
Exports a full JSON snapshot of all CMS sections and clients for backup and migration.

**Access:** `super_admin` only  

---

### POST `/api/cms/import`
Restores or imports a complete CMS JSON payload (staging → production).

**Access:** `super_admin` only  

---

## 3. Real Estate Projects & Units

### GET `/api/projects`
Lists published real estate developments for the public catalog with filter support (`type`, `city`, `priceType`).

### GET `/api/projects/:id`
Returns project details, photo gallery, coordinates, and architectural floor plans with unit availability.

### POST `/api/projects`
Creates a new project record. Requires `createProject` or `manageProjects`.

### PUT `/api/projects/:id`
Updates project information. Requires `editProject` or `manageProjects`.

### DELETE `/api/projects/:id`
Deletes a project record. Requires `deleteProject` or `manageProjects`.

### PATCH `/api/projects/:id/publish`
Toggles publish status (`draft`, `published`, `hidden`). Requires `publishProject` or `manageProjects`.

### PATCH `/api/units/:id/status`
Instant status update for a unit (`available`, `reserved`, `rented`, `sold`). Requires `manageUnits`. Broadcasts real-time WebSocket update to all active browsers.

---

## 4. CRM & Inquiries (`/api/inquiries`)

### POST `/api/inquiries`
Public submission for property viewing bookings, general inquiries, or contact forms. Broadcasts desktop notifications and email alerts.

### GET `/api/inquiries`
Lists customer inquiries with status filter (`new`, `in_progress`, `contacted`, `closed`). Requires `viewInquiries`.

### PATCH `/api/inquiries/:id/status`
Updates lead pipeline status and internal notes. Requires `viewInquiries`.

---

## 5. Media Library & Storage API (`/api/media`)

Comprehensive digital asset management for website images, brochures, and 3D architectural models. All media files are indexed in the `MediaFile` database table, tracked across all referencing entities, and protected against link rot and SEO damage.

### POST `/api/media/upload`
Uploads and indexes an image or PDF.
- **Payload:** `multipart/form-data` with `file`.
- **Processing:** Sharp automatically validates file magic bytes, strips EXIF metadata, resizes if oversized, converts images to WebP, and saves to `/uploads/`. PDFs are saved with `.pdf` extension and served as attachments.
- **Database:** Auto-creates a `MediaFile` record with `originalName`, `fileType` (`image` | `pdf` | `model3d`), `mimeType`, and `size`.
- **Response (201 Created):**
  ```json
  {
    "url": "/uploads/123e4567-e89b-12d3-a456-426614174000.webp",
    "filename": "123e4567-e89b-12d3-a456-426614174000.webp",
    "originalName": "hero-skyline.png",
    "fileType": "image",
    "mimeType": "image/webp",
    "size": 142850
  }
  ```

### POST `/api/media/upload/chunked/init` (zip extraction)
Resumable upload (`init`, `chunk`, `status/:uploadId`, `complete`, `abort/:uploadId`; up to 2 GB). `init` accepts an optional `extract`: `video`, `model3d` or `html`.
- **`folderId` (optional, uuid or null):** the library folder the file lands in; `404 Folder not found` before any session is created. With `extract`, `complete` creates ONE new folder named after the zip (`name (2)` on a clash) inside `folderId` (root when omitted), puts every created row in it, and returns `folderId` and `folderName` on each `extracted` item; a failed extraction leaves no folder behind. `POST /api/media/upload` takes the same target as `?folderId=<uuid>`.
- **Validation (same rules as the Drive upload):** the extension must be on the library allow list (images `jpg jpeg png webp gif avif`, videos, `pdf`, `glb gltf`, `html htm`, `zip rar 7z tar gz doc docx xls xlsx ppt pptx sql csv`; `svg` is refused), else `400`. `chunkSize` 256 KB to 50 MB and `totalChunks = ceil(totalSize/chunkSize)`, else `400`; free disk must cover the file (`507`). Each chunk must have exactly `chunkSize` bytes (the last one the remainder) and a valid index, else `400`; an unknown or expired session is `404`; the assembled size is checked on `complete`. The stored type and mime come from the extension, never from the client's `mimeType`. Sessions idle for 24 h are deleted.
- **With `extract` and a `.zip` file:** `complete` unpacks the zip into `uploads/<uuid>-<name>/` (the zip itself is deleted) and returns `201` with the first created item plus `extracted: MediaFile[]`. `video` lists every `.mp4/.webm/.mov/.m4v/.ogv`, `model3d` every `.glb`, `html` one row for the entry page (`index.html`, else the shallowest `.html`); other files stay on disk, unlisted. The folder carries a `.ajda-extracted` marker so the disk sync never indexes a site's css/js/images, and it is removed with its last library item.
- **Limits and safety:** max 5000 entries and 1 GB uncompressed; absolute paths, `..`, symlinks, encrypted and zip64 archives are rejected with `400`; hidden files and `__MACOSX` are skipped; a zip without files of the chosen kind is `400`.
- **Serving:** `.html` and `.svg` under `/uploads/` are sent with `Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms` and without `X-Frame-Options`, so an uploaded page cannot reach this origin's cookies or storage.

### Permanent public links: `GET /f/<slug>`, `GET /html/<slug>/` (no login)
Every library file has one `slug` (`MediaFile.slug`, unique, generated once as `<name>-<6 hex>`, e.g. `tower-view-a3f9c1`). It never changes when the file is moved or renamed; only an admin edits it.
- `GET /f/<slug>`: serves the file itself (range requests work for video). Unknown slug: `404`.
- `GET /html/<slug>/`: serves an HTML page or website (`GET /html/<slug>` redirects `301` to the trailing-slash form so relative links resolve). `/html/<slug>/<path>` serves files next to the entry page of an extracted zip (hidden files, `..` and anything outside the site folder are `404`; a single uploaded page has no siblings). Only for `fileType: html`.
- HTML and SVG responses carry `Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms`; both routes send `Access-Control-Allow-Origin: *` so a sandboxed page can load its own css/js/fonts.
- Caddy must proxy `/f/*` and `/html/*` to the API (already in `deploy/Caddyfile.ajda` and `Caddyfile.test.ajda`; the owner reloads Caddy on each server). The Vite dev server proxies them too.

### PATCH `/api/media/:id`
Changes the slug: `{ "slug": "villa-tour" }` (3-80 chars, lowercase letters, digits, single hyphens; reserved: `api`, `assets`, `uploads`, `admin`, `f`, `html`). `400` invalid, `409` already used, `404` unknown file. The old link stops working.

### GET `/api/media`
Returns paginated media assets with live usage tracking annotations.
- **Access:** Admin (`manageMedia`, `manageProjects`, `managePastProjects`, or `manageCms`).
- **Query Parameters:**
  - `page` (number, default `1`): Page number.
  - `limit` (number, default `24`, max `100`): Items per page.
  - `type` (string, default `all`): Filter by `all`, `image`, `video`, `pdf`, `model3d`, `html`, `other`.
  - `status` (string, default `all`): Filter by `all`, `linked` (in use), `orphaned` (unused).
  - `rescan` (`1`, optional): index files dropped on disk by hand right now. Without it the disk index runs at most once a minute (a full scan per request does not scale). Paging, type and search run in the database; only the rows of the requested page are loaded and annotated (a `status` filter reads ids and urls of the matches to apply usage).
  - `search` (string, optional): Substring search in `originalName` or `filename`.
  - `folder` (`all` default | `root` | folder uuid): `all` ignores folders (what the media picker uses), `root` returns files not in any folder, a uuid returns the files directly in that folder (an unknown id gives an empty page). Items carry `folderId`.
  - `sort` (`newest` default | `oldest` | `name` | `size`): `size` is largest first; `id` is the final tie-breaker so pages never repeat or skip a row.
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "cly1234567890",
        "url": "/uploads/uuid.webp",
        "filename": "uuid.webp",
        "originalName": "tower-main.webp",
        "mimeType": "image/webp",
        "fileType": "image",
        "size": 245000,
        "createdAt": "2026-11-08T12:00:00.000Z",
        "usageCount": 2,
        "usages": [
          {
            "entityType": "project",
            "entityId": 1,
            "entityTitle": "برج أجدا التجاري",
            "field": "image"
          }
        ]
      }
    ],
    "total": 42,
    "page": 1,
    "totalPages": 2
  }
  ```

### GET `/api/media/usage`
Inspects real-time references to a specific media URL across all platform entities (`Project`, `PastProject`, `CmsClient`, `CmsSection`, `AdminUser`, `DeveloperNote`, `AppSetting`).
- **Query Parameters:**
  - `url` (string, required): Full or relative URL (e.g. `/uploads/uuid.webp`).
- **Response (200 OK):**
  ```json
  {
    "url": "/uploads/uuid.webp",
    "filename": "uuid.webp",
    "usageCount": 1,
    "usages": [
      {
        "entityType": "project",
        "entityId": 10,
        "entityTitle": "مجمع العقيق السكني",
        "field": "image"
      }
    ]
  }
  ```

### Library folders (`/api/media/folders`, `/api/media/move`)
Virtual folders for the library: rows only, files stay flat on disk, so `/uploads/...`, `/f/<slug>` and `/html/<slug>/` never change. Same access as the other media routes. Names are unique per parent, case-insensitively (`409 A folder with this name already exists here`); no `/`, `\` or control characters, max 120 characters; nesting is limited to 5 levels (`400`).
- `GET /api/media/folders` → `{ folders: [{ id, name, parentId, fileCount, createdAt }] }` (every folder; `fileCount` counts files directly inside).
- `POST /api/media/folders` `{ name, parentId? }` → `201` folder.
- `PATCH /api/media/folders/:id` `{ name?, parentId? }` (at least one; `parentId: null` = root). Moving a folder into itself or a descendant is `400`.
- `DELETE /api/media/folders/:id` → `{ success, movedFiles, movedFolders }`. Never deletes files: its files and subfolders move up one level (clashing subfolder names get ` (2)`).
- `POST /api/media/move` `{ ids: string[] (1-200), folderId: string | null }` → `{ moved }`; `404` for a missing target folder.

### Staged (picker) uploads
Uploads from the media picker are staged: the row and disk file exist with `pending = true` but are hidden from every Library listing and folder count until the uploading admin confirms them. Same access as the other media routes.
- `POST /api/media/upload?staged=1` and `staged: true` in the `chunked/init` body create pending rows (a staged zip extraction also creates a pending folder). Responses gain `pending`.
- `GET /api/media` never lists pending rows unless `includePending=mine`, which adds the current admin's own. `GET /api/media/folders` hides pending folders and counts only visible files.
- `POST /api/media/staged/confirm` `{ fileIds: uuid[] (max 200), folderIds: uuid[] (max 20) }` → `{ confirmed }` (file count). Only rows that are pending and created by the current admin change; other ids are skipped (idempotent).
- `POST /api/media/staged/discard` same body → `{ discarded }`. Deletes the owned pending files (row and disk, no in-use check, non-pending rows are refused), then the owned pending folders.
- Pending rows older than 24 h are removed by the throttled disk sync (`sweepStalePendingMedia`).

### DELETE `/api/media/:id`
Safely deletes an unlinked / orphaned media file from disk and database.
- **Strict SEO Guard:** If `usageCount > 0`, deletion is **strictly blocked** and returns `409 Conflict`. Media URLs connected to live projects and content must remain permanent and immutable to prevent broken Google Search & Google Images indexing.
- **Error Response (409 Conflict):**
  ```json
  {
    "error": "لا يمكن حذف هذا الملف نهائياً لأنه مرتبط بـ (مجمع العقيق السكني). روابط الصور محمية لضمان استقرار أرشفة Google SEO وعدم كسر ظهور المشروع.",
    "usageCount": 1,
    "usages": [...]
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

---

## 5b. Drive (`/api/drive`, `GET /d/<slug>`)
Private admin file storage, separate from the media library. Guard: `manageMedia` (which `manageCms` and `manageProjects` also grant). Folders are **virtual** (tables `drive_folders`, `drive_files`); files sit flat in `PRIVATE_DIR/drive/<uuid>[.ext]`, never under the public `/uploads`. Moving, renaming and trashing therefore never touch the disk, and a file's slug never changes unless an admin edits it.

| Route | Purpose |
|---|---|
| `GET /api/drive/list?view=files&folderId=` | Folder contents + breadcrumbs (no `folderId` = root). `view=trash` lists trashed items whose parent is not itself trashed; `view=search&q=` searches names. A trashed folder answers `400`, an unknown one `404`. |
| `GET /api/drive/folders` | All live folders `{id,name,parentId}` (move/copy picker). |
| `GET /api/drive/usage` | `{ fileCount, totalBytes, trashedBytes }`. |
| `POST /api/drive/folders` `{name,parentId?}` | New folder. `409` when the name exists in that folder, `400` for empty names, slashes or control characters. |
| `PATCH /api/drive/folders/:id` `{name?,parentId?}` | Rename (409 on clash) and/or move (auto-renames `name (2)` on clash; `400` into itself or a subfolder). |
| `POST /api/drive/folders/:id/copy` `{parentId?}` | Recursive copy (max 2000 items; files are physically copied, copies get new slugs and are private). |
| `PATCH /api/drive/files/:id` `{name?,folderId?,isPublic?,slug?}` | Rename, move, share on/off, edit the slug (same rules as the media slug; `409` if used). |
| `POST /api/drive/files/:id/copy` `{folderId?}` | Copy a file. |
| `POST /api/drive/files/:id/to-library` | Copies a live Drive file into the public media library (the Drive file stays private and unchanged). Returns the new library item `{id,url,slug,filename,originalName,mimeType,fileType,size}` (`201`). `400` for an extension the library does not accept, `413` above 2 GB, `404` for a trashed, unknown or data-less file. |
| `POST /api/drive/files/:id/extract` `{folderId?}` | Unpacks a stored zip into a new folder named after it (made unique with `(2)`...), next to the zip or inside `folderId` (`null` = the Drive root). `201 { folder, files, folders, skipped }`. `400` not a zip or corrupt, `404` missing or trashed source or target, `413` archive over 2 GB, over 10 000 entries, over 5 GB extracted or an entry larger than its header says, `429` another extraction is running, `507` not enough disk space. |
| `POST /api/drive/zip/ticket` `{folderIds,fileIds,name?}` | Download of folders and selections as one zip, step 1. At least one id, `name` max 120; every id must exist and not be trashed (`404` otherwise). Returns `{ url: "/api/drive/zip/<ticket>" }`; the ticket is 48 hex characters, valid 60 s, single use. |
| `GET /api/drive/zip/:ticket` | Step 2. Auth is the ticket itself (no `Authorization` header, on purpose: a browser download link cannot send one). Streams the archive. Unknown, used or expired ticket: `404`. At most 2 archives stream at once (`429`). At most 20 000 entries (`413`). Files missing on disk are skipped and logged. |
| `POST /api/drive/move` `{folderIds,fileIds,targetId}` | Bulk move (`targetId: null` = root). |
| `POST /api/drive/trash`, `/restore`, `/purge` `{folderIds,fileIds}` | Trash stamps a folder and everything inside with one `trashedAt`; restore brings back exactly that set (an item whose folder is still trashed returns to the root); purge deletes trashed items for good (live items are skipped) and removes the bytes. |
| `POST /api/drive/trash/empty` | Purge everything in the trash (send no JSON content-type, or a body). |
| `POST /api/drive/upload?folderId=&relPath=` | One multipart file per request, max **50 MB** (`413` above: use the chunked upload). `relPath` (folder upload) such as `Photos/2024/a.jpg` creates the folders below `folderId`. Name clashes become `name (2).ext`. The stored type comes from the extension, never from the client. |
| `POST /api/drive/upload/chunked/init` `{relPath,folderId?,totalSize,totalChunks,chunkSize}` | Starts a resumable upload of up to **5 GB** (`413` above). `chunkSize` 256 KB to 50 MB (the web app sends 8 MB) and `totalChunks = ceil(totalSize/chunkSize)`; names and the target folder are validated up front; needs about the file size in free disk (`507` otherwise). Returns `{uploadId}`. Sessions idle for 24 h are deleted. |
| `POST /api/drive/upload/chunked/chunk?uploadId=&chunkIndex=` | One multipart chunk; its length must be exactly `chunkSize` (the last one the remainder), else `400`. |
| `GET /api/drive/upload/chunked/status/:uploadId` | `{uploadedChunks,totalChunks,totalSize}` so a client can resume. |
| `POST /api/drive/upload/chunked/complete` `{uploadId}` | Joins the parts (streamed; each part is deleted as it is appended), checks the final size and registers the file (`201`, same shape as `/upload`). Missing chunk: `400`, session kept. |
| `DELETE /api/drive/upload/chunked/abort/:uploadId` | Drops the session and its parts. |
| `GET /api/drive/files/:id/download[?inline=1]` | Authenticated download; `inline=1` only affects safe types. |
| `GET /d/<slug>[?download=1]` | **Public** share link. `404` unless `isPublic` and not trashed. Images, video, audio, PDF and plain text show inline; every other type (HTML, SVG, ...) is stored without its extension and always downloads (`attachment`, `nosniff`), so uploaded files can never run on the site origin. Range requests work. |

Caddy must proxy `/d/*` to the API (done in `deploy/Caddyfile.ajda` and `Caddyfile.test.ajda`; reload Caddy on each server). The Vite dev server proxies `^/d/`.

## 6. Real-Time WebSocket Events (Socket.io)

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `unit:status` | Server → Client | `{ unitId, status, floorId, projectId }` | Live unit reservation or lease update |
| `inquiry:new` | Server → Client | `{ id, name, projectTitle, type }` | Real-time lead alert for admin header |
| `cms:updated` | Server → Client | `{ key, version, timestamp }` | Triggers background SWR revalidation on public clients |
| `cms:clients:updated` | Server → Client | `{ timestamp }` | Invalidation signal for partners directory |

---

## 7. Production Logs & Telemetry API (`/api/logs`)

Production diagnostic endpoints allow real-time log streaming, system metrics inspection, and error debugging remotely from any browser or terminal.

### Authentication & Access Control
A request is allowed when `LOGS_PUBLIC=true` (explicit opt-out, off by default) or when **both** hold:
1. a valid admin session (`Authorization: Bearer <token>`) of an active `super_admin`, and
2. the shared key in the `x-logs-key` header (`LOGS_SECRET_KEY`, required in production, at least 24 characters).

The key is **not** accepted as a `?key=` query parameter (it would land in access logs and browser history). `GET /api/logs/view` and `POST /api/logs/client-error` are reachable without a session; the HTML console asks for the key and the session itself and sends them as headers.

### GET `/api/logs`
Returns structured JSON logs from the in-memory ring buffer (up to 2,000 entries) or physical log file (`prod.log`).

**Query Parameters:**
- `key` (string, optional): Secret key for authentication.
- `level` (string, default `all`): Filter by `all`, `error`, `warn`, `info`, `debug`.
- `search` (string, optional): Substring search across message, source, or JSON context.
- `limit` (number, default `100`, max `1000`): Maximum entries to return.
- `source` (string, default `buffer`): `buffer` (instant zero-disk latency) or `file` (reads `prod.log`).

**Response (200 OK):**
```json
{
  "success": true,
  "query": { "level": "all", "limit": 100, "source": "buffer" },
  "entries": [
    {
      "id": "1790804869675-1",
      "timestamp": "2026-10-01T00:47:49.675Z",
      "level": "info",
      "message": "GET /api/health - 200 (2.0ms)",
      "source": "http",
      "reqId": "req-1",
      "context": {
        "ip": "127.0.0.1",
        "statusCode": 200,
        "latencyMs": 2,
        "userAgent": "Mozilla/5.0..."
      }
    }
  ],
  "returnedCount": 1,
  "totalMatched": 1,
  "stats": {
    "uptimeSeconds": 120,
    "uptimeFormatted": "2m 0s",
    "nodeVersion": "v24.21.0",
    "platform": "linux (x64)",
    "memory": { "rssMb": 85, "heapUsedMb": 42, "heapTotalMb": 60 },
    "counts": { "total": 45, "error": 0, "warn": 1, "info": 44, "debug": 0 }
  }
}
```

### GET `/api/logs/view`
Interactive dark-mode live terminal viewer in HTML. Features:
- 🟢 Live auto-refresh polling (every 3 seconds).
- Level filter badges (`ALL`, `ERROR`, `WARN`, `INFO`, `DEBUG`).
- Real-time debounced search bar.
- Stats telemetry banner (Uptime, Memory RSS, Heap, Error counter).
- Quick actions: Raw log link, Clear logs button.

**Browser Access:** open `https://yourdomain.com/api/logs/view`, sign in as a super admin and enter the log key in the console.

### GET `/api/logs/raw`
Returns plain text log output formatted line-by-line, suitable for `curl` or terminal piping:
```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "x-logs-key: $LOGS_SECRET_KEY" "https://yourdomain.com/api/logs/raw?lines=200"
```

### GET `/api/logs/stats`
Returns system telemetry without log records (uptime, memory RSS, heap, Node version, platform, error counts).

### POST `/api/logs/clear`
Clears the in-memory ring buffer and truncates the physical `prod.log` on disk.

---

### GET `/api/logs/errors`
Streams the raw plain-text content of `server/errors.log`:
```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "x-logs-key: $LOGS_SECRET_KEY" "https://yourdomain.com/api/logs/errors?lines=100"
```

---

### POST `/api/logs/errors/clear`
Truncates the physical `server/errors.log` file on disk.

---

### POST `/api/logs/client-error`
Public telemetry beacon allowing browser frontend to report unhandled JavaScript errors, promise rejections, and API connection failures directly into `server/errors.log`.

**Payload:**
```json
{
  "message": "API POST /api/projects failed with HTTP 500",
  "source": "frontend",
  "url": "https://ajda.sa/admin/projects",
  "stack": "Error: ...",
  "context": { "status": 500 }
}
```

---

## 8. Developer Notes & Feedback (Isolated Channel)

Dedicated administrative feedback channel strictly decoupled from customer CRM inquiries.

### Authentication & Access Control
Reading, exporting, updating and deleting developer notes requires **both** an active `super_admin` session and the header `x-dev-notes-key: <DEVELOPER_NOTES_SECRET>` (required in production, at least 24 characters; no query-parameter form).

*Note: Submission (`POST /api/developer/notes`) is open to any authenticated dashboard user via the floating Pet assistant.*

### POST `/api/developer/notes`
Submits a bug report, improvement suggestion, or developer note from the Admin Feedback Pet. Dispatches an immediate HTML alert email to `DEVELOPER_EMAIL` (`cloud.data.sa@gmail.com`).

**Request:**
```json
{
  "title": "Save button unresponsive on Floorplan modal",
  "section": "Floor & Units Visualizer",
  "body": "Clicking save does not emit PUT request",
  "solution": "Check payload validation",
  "priority": "high",
  "screenshotUrl": "/uploads/feedback-screenshot.webp",
  "adminName": "System Admin",
  "metadata": {
    "url": "https://ajda.sa/admin/units",
    "screenWidth": 1920
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Developer note registered successfully",
  "note": { "id": "clx...", "title": "...", "status": "pending" }
}
```

---

### GET `/api/developer/notes`
Lists developer notes with filtering and pagination.

**Query Parameters:**
- `status` (`all` | `pending` | `in_progress` | `resolved` | `closed`)
- `priority` (`all` | `low` | `medium` | `high` | `critical`)
- `search` (string)
- `limit` (number, default 50)
- `page` (number, default 1)

---

### GET `/api/developer/notes/export`
Exports all developer notes as Markdown or JSON:
```bash
# Export as clean Markdown
curl -H "Authorization: Bearer $TOKEN" -H "x-dev-notes-key: $DEVELOPER_NOTES_SECRET" "https://yourdomain.com/api/developer/notes/export?format=markdown" > notes.md

# Export as JSON
curl -H "Authorization: Bearer $TOKEN" -H "x-dev-notes-key: $DEVELOPER_NOTES_SECRET" "https://yourdomain.com/api/developer/notes/export?format=json" > notes.json
```

---

### PATCH `/api/developer/notes/:id`
Updates note status (`status: "in_progress" | "resolved" | "closed"`), priority, or solution note.

---

### DELETE `/api/developer/notes/:id`
Permanently deletes a developer note. Requires developer key or `super_admin`.


