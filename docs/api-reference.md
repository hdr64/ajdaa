# Ajda Real Estate Platform — API Reference

> **Last Updated**: 2026-10-01  
> **Base URL**: `/api`  
> **Content-Type**: `application/json`

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

### POST `/api/auth/verify-otp`
Validates a 6-digit email verification code for login or password reset.

**Request:**
```json
{
  "challengeId": "challenge-uuid",
  "code": "482910"
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
Allowed if any of the following is true:
1. `LOGS_PUBLIC=true` in `server/.env` (unrestricted public access).
2. Request passes `?key=<LOGS_SECRET_KEY>` query param or `x-logs-key` header (default key: `ajda-logs-secret-2026`).
3. Request includes a valid JWT token (`Authorization: Bearer <token>`) belonging to an admin user (`super_admin` or `admin`).

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

**Browser Access:**
```
https://yourdomain.com/api/logs/view?key=YOUR_SECRET_KEY
```

### GET `/api/logs/raw`
Returns plain text log output formatted line-by-line, suitable for `curl` or terminal piping:
```bash
curl -s "https://yourdomain.com/api/logs/raw?key=YOUR_SECRET_KEY&lines=200"
```

### GET `/api/logs/stats`
Returns system telemetry without log records (uptime, memory RSS, heap, Node version, platform, error counts).

### POST `/api/logs/clear`
Clears the in-memory ring buffer and truncates the physical `prod.log` on disk.

