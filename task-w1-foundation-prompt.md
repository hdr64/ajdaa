# Task w1-foundation — schema + permissions for 3 new features

Worktree lane `foundation`. Foundation only: NO routes, NO UI. Later lanes build on this.

## Read first
- `docs/MASTER-PLAN.md`, `refactor.md`
- `server/prisma/schema.prisma` (SQLite dev schema; prod schema is generated from it by `server/scripts/generate-prod-schema.mjs` — models must be valid for both), `server/prisma/migrations/*` (read 3 recent ones, esp. `20261001010000_developer_notes` and `20260930140000_notification_listeners`, to copy their SQL style; the same migration SQL is applied to Postgres in prod via `prisma migrate deploy`, so write SQL that works on both, mirroring existing migrations)
- `server/src/config/permissions.ts`, `server/src/services/notificationListeners.ts`, `server/src/services/siteSettings.ts`, `server/prisma/seed.ts`, `server/test/` (how permissions/roles tests are written)

## Decided design
1. `Project`: add `model3dUrl String?` (external 3D viewer link, shown in iframe or new tab later).
2. New model `PastProject` (the "أعمالنا السابقة" page), separate table: `id Int autoincrement`, `title`, `titleEn?`, `category String?`, `categoryEn?`, `image String` (main image), `gallery String?` (JSON array of urls, same convention as `Project.gallery`), `pdfUrl String?`, `description String?`, `descriptionEn String?`, `sortOrder Int @default(0)`, `published Boolean @default(true)`, `createdAt`, `updatedAt`. Index on `(published, sortOrder)`.
3. New model `JobApplication`: `id String @id @default(cuid())`, `name`, `email`, `phone`, `jobTitle`, `message String?`, `cvPath String?` (relative path of a PRIVATE file, never a public URL), `cvOriginalName String?`, `status String @default("new")` (new | reviewed | shortlisted | rejected | hired), `adminNote String?`, `createdAt`, `updatedAt`. Indexes on `status`, `createdAt`.
4. Permissions (add to the catalogue in `config/permissions.ts` following the exact existing pattern incl. Arabic + English labels, group, and default role assignments): `managePastProjects`, `viewApplications` (see list and view details, download CV), `manageApplications` (change status, add note, delete). super_admin gets all. Look at how existing roles are seeded/derived and mirror that; do not break existing role tests, update test assertions of the catalogue where needed (see `roles.test.ts`).
5. Notification event: register a new event key `job_application` in the notification-listener event list (find where `new_inquiry`-style events are declared in `notificationListeners.ts`/`notificationService.ts` and add it, with Arabic/English label if events have labels). Do not build the sender (a later lane does).
6. Settings: document, in `server/src/config/siteSettingsDefaults` or wherever defaults live (find it), a new setting key `careers.form` with default JSON `{"required":{"name":true,"email":true,"phone":true,"jobTitle":true,"message":false,"cv":false}}`. Add a tiny typed helper `getCareersFormConfig()`/`setCareersFormConfig()` in a new file `server/src/services/careersSettings.ts` following `securitySettings.ts` (name/email/phone always forced to required=true in the getter, they cannot be turned off).
7. One migration folder named `20261022000000_foundation_past_projects_applications` covering items 1-3. Update `prisma/seed.ts` only if needed for tests.

## Out of scope
Routes, UI, email sending, uploads, any file outside `server/prisma`, `server/src/config`, `server/src/services/careersSettings.ts`, `server/src/services/notification*.ts`, and tests under `server/test`.

## Constraints
No commits, no installs (the worktree has node_modules already), never touch `.env*`. Free model only.

## Gates
`npm --prefix server run build`, `npm --prefix server test`, `npx prisma validate --schema server/prisma/schema.prisma`, and `npm --prefix server run db:gen:prod` then `npx prisma validate --schema server/prisma/schema.postgresql.prisma`. Add unit tests for `careersSettings` (defaults, forced-required fields) and the permission catalogue.

## Report
`task-w1-foundation-report.md`: files changed, gate output summary, migration SQL file name, decisions.
