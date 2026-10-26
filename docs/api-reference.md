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
| `POST /media/upload` | `manageProjects` or `managePastProjects` (images re-encoded to WebP, PDFs accepted) |

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
| `GET /settings/site` | public (contact details, careers switches) |
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
Returns the complete aggregated website content (nav, footer, home, works, clientsPage, contact). Supports deterministic ETags and returns HTTP 304 if unchanged.

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
  "contact": {...}
}
```

**Response (304 Not Modified):** Empty body, 0ms latency.

---

### GET `/api/cms/content/:key`
Returns single section content. Key options: `nav`, `footer`, `home`, `works`, `clientsPage`, `contact`.

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

## 5. Media Upload (`/api/media`)

### POST `/api/media/upload`
Accepts `multipart/form-data` with `file`. Sharp automatically validates magic bytes, strips EXIF metadata, resizes if oversized, converts to WebP, and saves to `/uploads/`. Returns standardized relative URL.

---

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


