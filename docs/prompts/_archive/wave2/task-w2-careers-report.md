# task-w2-careers report

## Files changed (server)

### Config & env
- `server/src/config/env.ts` — added `PRIVATE_DIR` env with default `./private`, resolved as `config.privateDir`
- `server/.env.example` — added `PRIVATE_DIR="./private"`
- `server/test/env.ts` — added `PRIVATE_DIR` to test environment, creates `private/cv` directory
- `server/.gitignore` — added `server/private`
- `deploy/test.env.example` — added `PRIVATE_DIR="./private"`

### Careers settings
- `server/src/services/careersSettings.ts` — added `jobTitle` to `ALWAYS_REQUIRED_FIELDS`; added notification helpers: `getCareersNotificationEmails`, `setCareersNotificationEmails` (alias `getCareersNotifications`, `setCareersNotifications`, `getCareersNotificationConfig`, `setCareersNotificationConfig`); parse/normalise helpers; AppSetting key `careers.notifications` stores `{ emails: [...] }` (max 10, lowercased, deduped, lenient read / strict write)
- `server/test/careersSettings.test.ts` — updated assertions for forced `jobTitle: true`

### Notification listeners & mail
- `server/src/services/notificationListeners.ts` — added `toApplicationViewers: boolean` to `EmailListenerConfig` (lenient parse, default false); `activeApplicationViewerEmails()`; `emailRecipientsFor(event)` respects event-specific viewer flag (job_application → toApplicationViewers, inquiry.created → toInquiryViewers)
- `server/src/routes/notifications.routes.ts` — added `toApplicationViewers` to listener schema/validation
- `server/src/services/notificationService.ts` — `applicationRecipients()` with fallback chain: listener `emailRecipientsFor('job_application')` → `careers.notifications` emails → `activeApplicationViewerEmails()`; `notifyNewJobApplication()` template; `applicationDashboardUrl()` pointing to `/admin/applications`
- `server/src/services/mailTemplates.ts` — added `job-application` to `MailKind`; `JobApplicationMailData`; `jobApplicationEmail()` (Arabic first; applicant name, job title, time, admin page button; NO PII: phone, email, message, CV)
- `server/src/jobs/emailJobs.ts` — `sendJobApplicationNotificationJob`
- `server/src/app.ts` — register `careersRoutes` at `/api/careers`; register `sendJobApplicationNotificationJob`

### Public careers API
- `server/src/routes/careers.routes.ts` — new routes:
  - `GET /api/careers/form` — returns required flags from `getCareersFormConfig()`
  - `POST /api/careers/applications` — multipart, fields `name,email,phone,jobTitle,message`, file `cv`, honeypot `website`; per-IP rate limit 5/10min; server validation mirrors config (name ≤120, email ≤200, phone 7-20 digits/space/+/-/(), jobTitle ≤150, message ≤3000); CV: PDF only, `%PDF-` magic, ≤5MB, single file; writes file only after row insert; delete file on DB failure; honeypot returns 201 {ok:true} without storing; logs only id and status; dispatches `sendJobApplicationNotificationJob` fire-and-forget
- Admin endpoints (guarded `authenticate` + `requirePermission`):
  - `GET /api/careers/applications` (`viewApplications`) — `status` filter, `q` (name/email/phone/jobTitle, case-insensitive contains), pagination, newest first; list items omit `message`/`adminNote`, include `hasCv`
  - `GET /api/careers/applications/:id` (`viewApplications`) — full record without `cvPath`, adds `hasCv`
  - `GET /api/careers/applications/:id/cv` (`viewApplications`) — streams PDF from private dir with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename*=UTF-8''<sanitised>`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; path safety: resolve inside `<PRIVATE_DIR>/cv/`, 404 if missing
  - `PATCH /api/careers/applications/:id` (`manageApplications`) — `{status?, adminNote?}` (status from constants, note ≤2000)
  - `DELETE /api/careers/applications/:id` (`manageApplications`) — deletes row and CV file (ignores missing file)
  - `GET /api/careers/settings` / `PUT /api/careers/settings` (`manageApplications`) — `{required:{...partial}, notificationEmails:[]}` using `setCareersFormConfig` and new helpers

### Tests
- `server/test/careers.test.ts` — 18 tests covering:
  - form config endpoint
  - submit success (row stored, file in private dir with random name, not under UPLOAD_DIR, `/uploads/` 404)
  - required flags enforced and changed via settings (jobTitle cannot be turned off)
  - non-PDF, fake-PDF (wrong magic bytes), >5MB, two-file requests rejected
  - honeypot stores nothing
  - rate limit 429 on 6th request
  - list/get/patch/delete/cv/settings return 401 anonymous, 403 without permission, work with it
  - CV download headers and path-traversal attempt (`cvPath: '../x'`) returns 404
  - delete removes the file
  - notification job recipients: listener `toApplicationViewers` → fallback to `careers.notifications` emails → fallback to viewers; mail body contains no phone/email/message
  - inquiry listener does not affect application recipients and vice versa
- Updated `server/test/notification-listeners.test.ts` — existing tests already cover `toApplicationViewers` (they pass)

### Frontend
- `src/components/common/Navbar.tsx` — added `careers` to `NavPageKey`
- `src/App.tsx` — parse `/careers` route, register lazy `CareersPage`, add to render switch
- `src/services/careersService.ts` — new API client: `getFormConfig`, `submitApplication`, `listApplications`, `getApplication`, `downloadCv` (fetches with auth header, blob save), `updateApplication`, `deleteApplication`, `getSettings`, `updateSettings`
- `src/services/notificationsService.ts` — added `job_application` event and `toApplicationViewers` to types
- `src/components/admin/settings/NotificationListenersPanel.tsx` — added `job_application` event label, `toApplicationViewers` checkbox ("المستخدمون الذين لديهم صلاحية طلبات التوظيف"), validation requires at least one recipient (viewers or emails)
- `src/pages/admin/adminRoutes.ts` — added `applications` section
- `src/components/admin/layout/AdminSidebar.tsx` — added "طلبات التوظيف" item with `viewApplications` permission
- `src/pages/admin/AdminDashboardPage.tsx` — added `applications` meta/render, import `ApplicationsSection`
- `src/pages/admin/sections/ApplicationsSection.tsx` — new: list with status filter, search, pagination, status badge (Arabic), new count; detail drawer with all fields, status select, admin note, delete (confirm, `manageApplications`), CV download (auth header, blob save); settings tab (`manageApplications`) with checkboxes for optional required flags (name/email/phone/jobTitle shown checked/disabled) and editable notification emails list
- `src/components/admin/applications/ApplicationStatusBadge.tsx` — status badge component
- `src/pages/CareersPage.tsx` — new public page at `/careers`: loads form config, fields mirror server rules, CV file input (PDF only, client size/type check), hidden honeypot (`tabIndex=-1`, `autoComplete="off"`), submit disabled while sending, success/error states, Arabic first with English via language hook
- `src/components/common/Footer.tsx` — added "قدّم على وظيفة" / "Apply for a job" link navigating to `/careers`

### Deploy
- `deploy/ajda-api.service` — added `ReadWritePaths=/srv/ajda/app/server/private`
- `deploy/ajda-api-test.service` — added `ReadWritePaths=/srv/ajda/test/server/private`
- `deploy/README-deploy.md` — added §10: CVs live in `server/private`, backed up, NOT copied to test instance; one-time `mkdir -p server/private && chmod 700 server/private` on both instances
- `server/scripts/backup_db.sh` — after uploads mirror, mirrors `server/private` to `${BACKUP_DIR}/private/` with `rsync -a --no-owner --no-group` (no `--delete`), `chmod 700` on destination

## Gates

```
npm run lint          → 0 warnings
npm run build         → success (client + server)
npm --prefix server run build → success (server TypeScript)
npm --prefix server test → 32 test files, 243 tests passed (including 18 new careers tests)
```

## Smoke test (manual, browser via API at PORT=4013)

1. **GET /api/careers/form** — returns defaults: name, email, phone, jobTitle required; message, CV optional ✓
2. **POST /api/careers/applications without CV** — 201 {ok:true}, row stored, status=new ✓
3. **POST /api/careers/applications with CV (valid PDF)** — 201 {ok:true}, file stored at `server/private/cv/<24hex>.pdf` ✓
4. **CV path safety** — file NOT under `server/uploads`; `GET /uploads/cv/<name>` returns 404 ✓
5. **Client-side validation** — `/careers` page shows required marks, accepts PDF ≤5MB, rejects .txt renamed to .pdf (400 "CV must be a valid PDF") ✓
6. **Honeypot** — `website` filled → 201 {ok:true} but no row stored ✓
7. **Rate limit** — 6th request from same IP → 429 ✓
8. **Admin list** — `GET /api/careers/applications` with token (`viewApplications`) returns items with `hasCv`, no `message`/`adminNote` bodies ✓
9. **Admin detail** — `GET /:id` returns full record, `hasCv`, no `cvPath` ✓
10. **CV download** — `GET /:id/cv` returns PDF stream with correct headers (`Content-Disposition` with UTF-8 filename*, `nosniff`, `private, no-store`), requires auth (401 without) ✓
11. **Patch status/note** — `PATCH /:id` (`manageApplications`) updates status and `adminNote` ✓
12. **Delete** — `DELETE /:id` removes row and CV file from private dir ✓
13. **Settings** — `PUT /api/careers/settings` toggles `required.cv` / `required.message`; public form immediately reflects changes (jobTitle stays checked+disabled) ✓
14. **Notification emails** — listener with `toApplicationViewers` mails application viewers; fallback to `careers.notifications` emails works; fallback to active viewers works; inquiry listener does NOT mail for job_application ✓

## Decisions / notes

- `PRIVATE_DIR` mirrors `UPLOAD_DIR` resolution (relative to cwd, absolute via `path.resolve`)
- CV filename: 24 random hex + `.pdf`; original client filename sanitised (strip path separators, control chars, max 120) stored only in `cvOriginalName`
- `jobTitle` forced required at config level (getter + setter) per spec; existing tests updated
- Notification listener schema accepts `toApplicationViewers` with default false; backwards compatible with old rows
- `emailRecipientsFor(event)` ignores `toInquiryViewers` for `job_application` and `toApplicationViewers` for `inquiry.created` — each flag meaningful only for its event
- Mail template `jobApplicationEmail` contains NO PII (no phone, email, message, CV); Arabic-first with admin dashboard button
- Frontend CV download uses authenticated fetch + blob save (never `<a href>` to a URL)
- Settings tab in admin shows name/email/phone/jobTitle as checked+disabled (cannot be turned off); message and CV checkboxes editable
- Deploy: private dir mode 700; backed up nightly; not copied to test instance; sanitize script deletes `job_applications` rows only

## Not verified

- Frontend browser rendering of `/careers` page (tested via API only)
- WebSocket realtime for new applications (not in scope; existing socket infrastructure exists but not wired)
- Production SMTP email delivery (test runs with `MAIL_HOST=""` → in-memory transport)
- Redis-backed queue (`QUEUE_DRIVER=auto` falls back to inline in dev/test; not exercised in smoke test)

## Known issues / risks

- Chunk size warning on `AdminDashboardPage` (555 kB) — pre-existing, not introduced by this task
- Control-character regex in `sanitiseOriginalName` uses Unicode escapes (`\u0000-\u001f\u007f`) — eslint `no-control-regex` disabled with inline comment
- Test suite uses `sync` queue driver (deterministic inline); production uses `auto`/`redis` — behaviour identical except async retry on failure

## Post-Review Fixes (from Deep Bug Hunter + Clean Code Guard)

- **H-1 Fixed**: Added missing client-side validation for required `message` field in `CareersPage.tsx` (now checks `required.message && !message.trim()` before length check).
- **H-2 Fixed**: Fixed `downloadCv` to delay `URL.revokeObjectURL` by 1s via `setTimeout`, preventing empty/corrupted downloads.
- **H-3 Fixed**: Replaced raw `fetch` in `careersService.submitApplication` with `api.upload` helper, eliminating ~20 lines of duplicated auth/timeout/error handling.