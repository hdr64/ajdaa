# Task w1-foundation-fix — fixes after review

Worktree lane `foundation`. Follow-up to `task-w1-foundation-report.md` and `task-w1-foundation-review.md`. Do exactly the items below.

## Read first
`task-w1-foundation-review.md` (findings H-1, M-1, M-4, L-3, L-6), `server/src/services/notificationListeners.ts`, `server/src/services/notificationService.ts`, `server/test/notification-listeners.test.ts`, `server/prisma/schema.prisma` (JobApplication), `src/components/admin/users/usersModel.ts`, `src/types/admin.ts`, `server/scripts/generate-prod-schema.mjs`, `server/test/careersSettings.test.ts`.

## Decided design
1. **H-1, per-event "configured" state.** `listenersConfigured()` becomes `listenersConfigured(event)`. For `inquiry.created` it keeps using the existing `notifications` AppSetting row (existing deployments must behave exactly as before). For `job_application` it uses a separate row with key `notifications.job_application`. `createListener` writes the row that matches the listener's event (the `notifications` row for `inquiry.created`, `notifications.job_application` for `job_application`). `emailRecipientsFor(event)` checks only its own event's flag, returning `null` when that event is not configured. The existing test "sends nothing when the only listener is disabled or every listener was deleted" must keep passing unchanged. Add tests: (a) creating a `job_application` listener does NOT change inquiry recipients (the legacy fallback still applies); (b) creating an `inquiry.created` listener does not change `emailRecipientsFor('job_application')` (still `null`).
2. **M-4, comment only.** In `schema.prisma`, replace the `JobApplication` doc comment about "PRIVATE upload directory" with: `cvPath` is a relative path inside a private CV directory that must NOT live under the publicly served `UPLOAD_DIR`. Do not touch the migration SQL.
3. **M-1.** Add `managePastProjects`, `viewApplications`, `manageApplications` to `AdminPermissions` in `src/types/admin.ts` and to `PERMISSION_KEYS`, `PERMISSION_LABELS` (if present) and `emptyPermissions` in `usersModel.ts`, with the same Arabic labels as in `server/src/config/permissions.ts`. Nothing else in the frontend.
4. **L-3.** In `careersSettings.test.ts`, assert the stored `AppSetting` row (`JSON.parse(row.value).required` contains name/email/phone = true) after `setCareersFormConfig`.
5. **L-6.** In `generate-prod-schema.mjs` change the provider regex to `/provider = "sqlite" \/\/[^\n]*\n/` so it also matches CRLF files. Then run `npm --prefix server run db:gen:prod` and confirm `schema.postgresql.prisma` contains `provider = "postgresql"`. Do not commit the generated file if it is gitignored; if it is tracked, leave it as generated.

## Out of scope
M-2 (jobTitle), M-5 (3D flag), L-1, L-2, L-4, L-5, L-7, L-8, S-1, any route or UI beyond item 3.

## Constraints
No commits, no installs, never touch `.env*`, no other files. Free model only.

## Gates
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test`, `npx prisma validate --schema server/prisma/schema.prisma`, and after `db:gen:prod` `npx prisma validate --schema server/prisma/schema.postgresql.prisma` (check the provider line yourself).

## Report
Write `task-w1-foundation-fix-report.md`: files changed, test counts, gate results, decisions.
