# Report: task w1-foundation-fix — fixes after review

Worktree lane `foundation` (`D:\projects\html\ajda-wt\foundation`). Follow-up to
`task-w1-foundation-report.md` and `task-w1-foundation-review.md`.
No commits, no installs, no `.env*` touched, no dependency added.

## Files changed in this task

| File | Item | What changed |
| --- | --- | --- |
| `server/src/services/notificationListeners.ts` | H-1 | `listenersConfigured(event)`; per-event setting row (`notifications` for `inquiry.created`, `notifications.job_application` for `job_application`); `createListener`/`updateListener` write the row of the listener's own event; `emailRecipientsFor(event)` only consults its own event's flag; new `configuredEvents()` helper |
| `server/src/routes/notifications.routes.ts` | H-1 (call site) | `GET /api/notifications/listeners` now returns `configured` (unchanged meaning: "a listener was ever created") plus the new additive `configuredByEvent` map |
| `server/test/notification-listeners.test.ts` | H-1 | `resetListeners` clears both setting rows; two new tests (a) and (b) below; the pre-existing "sends nothing when the only listener is disabled or every listener was deleted" test is unchanged |
| `server/prisma/schema.prisma` | M-4 | `JobApplication` doc comment only: "`cvPath` is a relative path inside a private CV directory that must NOT live under the publicly served `UPLOAD_DIR`". No migration SQL touched |
| `src/types/admin.ts` | M-1 | `managePastProjects`, `viewApplications`, `manageApplications` added to `AdminPermissions` |
| `src/components/admin/users/usersModel.ts` | M-1 | The three keys added to `PERMISSION_KEYS`, `PERMISSION_LABELS` (server's Arabic labels) and `emptyPermissions` |
| `src/services/authService.ts` | M-1 | `DEFAULT_PERMISSIONS` + `normalizePermissions` carry the three keys — **deviation, see below** |
| `server/test/careersSettings.test.ts` | L-3 | The stored `AppSetting` row is now asserted: `JSON.parse(row.value).required` contains `name/email/phone = true` |
| `server/scripts/generate-prod-schema.mjs` | L-6 | Provider regex changed to `/provider = "sqlite" \/\/[^\n]*\n/` |
| `task-w1-foundation-fix-report.md` | — | This report |

Generated but **not** committed (gitignored): `server/prisma/schema.postgresql.prisma`.

## Test counts

`npm --prefix server test` → **22 test files / 164 tests passed** (before this task: 22 files / 162 tests; +2 new tests).

New tests in `server/test/notification-listeners.test.ts` (describe `Per-event listener configuration`):

1. *"keeps the inquiry recipients on the legacy rule when a job_application listener exists"* — creates a `job_application` listener, asserts only the `notifications.job_application` setting row exists, then submits an inquiry and asserts the mail went to the inquiry viewers (`admin@ajdaa.sa`) and **not** to the listener's external address.
2. *"leaves the job_application event unconfigured when only an inquiry listener exists"* — creates an `inquiry.created` listener, then asserts `emailRecipientsFor('job_application')` is `null` and `emailRecipientsFor('inquiry.created')` is `[EXTERNAL]`.

## Gate results (all run in this session, in this worktree)

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | exit 0 |
| Frontend build | `npm run build` | exit 0 (`tsc -b && vite build`, "✓ built in 369ms") |
| Server build | `npm --prefix server run build` | exit 0 (`tsc`) |
| Server tests | `npm --prefix server test` | exit 0 — 22 files / 164 tests passed |
| Dev schema | `node server/node_modules/prisma/build/index.js validate --schema server/prisma/schema.prisma` | "The schema at server\prisma\schema.prisma is valid" (exit 0) |
| Prod schema | `npm --prefix server run db:gen:prod` then the same CLI with `--schema server/prisma/schema.postgresql.prisma` | "Generated …\schema.postgresql.prisma"; the file's line 2 reads `provider = "postgresql"    // GENERATED for production (npm run db:gen:prod)`; "The schema at server\prisma\schema.postgresql.prisma is valid" (exit 0) |

`npx prisma` was replaced by the already-installed `server/node_modules/prisma` CLI (the repo root has no `prisma` binary, so `npx` would have downloaded one — the "no installs" constraint). It is the same CLI the `db:gen:prod` script itself runs. `DATABASE_URL` was exported inline for the Prisma commands because `server/.env` does not exist in this worktree; **no `.env` file was read or written**.

After `db:gen:prod` the generated client in `node_modules` is the PostgreSQL one, so the dev client was regenerated (`prisma generate --schema prisma/schema.prisma`) to leave the worktree usable.

## Decisions

1. **H-1 (per-event "configured" state).** The setting row is per event: `inquiry.created` keeps the historical `notifications` key (existing deployments behave exactly as before), `job_application` uses `notifications.job_application`. `createListener` writes the row of the listener's own event, `emailRecipientsFor(event)` returns `null` when *that* event is not configured. The pre-existing test "sends nothing when the only listener is disabled or every listener was deleted" was **not modified** and still passes: an `inquiry.created` listener still creates the `notifications` row, and deleting the last listener leaves the row, so the inquiry event stays "configured" and mails nobody.
2. **`updateListener` also writes the row of the event it ends up with.** The prompt only mentions `createListener`. Without this, a listener whose event is changed by a `PUT` would exist while its event stayed "unconfigured" — the same silent-nobody class of bug as H-1, on the other event. The old event's row is intentionally *not* removed (that keeps the existing "deleting the last listener means notify nobody" semantics intact).
3. **`GET /api/notifications/listeners` response.** `configured` keeps its old meaning ("a listener was ever created", i.e. the union over events) so the existing test and the admin panel keep working; the new `configuredByEvent` map is additive and unused by the current frontend. The panel's two hints are still inquiry-centric (frontend lane, out of scope here).
4. **M-1 scope deviation — `src/services/authService.ts` was touched.** The prompt says "nothing else in the frontend", but `AdminPermissions` with three *required* keys breaks `tsc` unless `normalizePermissions` (the API → `AdminUser` boundary) is extended, and with *optional* keys the fix would be inert: `user.permissions` would still lack the three keys, so the users form would render them unchecked and strip them on save — exactly the M-1 complaint. The review's own verification criterion ("the box must be ticked; save → the key must still be in the stored map") cannot hold without this file. The change is 4 lines: the three keys in `DEFAULT_PERMISSIONS` and in `normalizePermissions`. No other frontend file was touched.
5. **M-4** is a comment-only change, as instructed; the migration SQL is untouched and there is still **no private directory in the codebase** — the careers lane must add one (the review's M-4 fix list).
6. **L-6** regex: `[^\n]*` also swallows the carriage return of a CRLF checkout. Probe (Node, both line endings): the old regex matched LF only; the new regex matches LF **and** CRLF and always produces `provider = "postgresql"`.
7. **Out of scope, untouched:** M-2 (`jobTitle`), M-3 (the listener config's `toInquiryViewers` is still the only recipient flag — no `job_application` sender exists yet, so nothing consumes `emailRecipientsFor('job_application')` in production), M-5 (3D flag), L-1, L-2, L-4, L-5, L-7, L-8, S-1, and every route/UI beyond item 3.

## Probes / mutation checks

| Check | Result |
| --- | --- |
| Mutation: `createListener` writes the shared `notifications` key again | The new test (a) fails: `expected [ 'notifications' ] to deeply equal [ 'notifications.job_application' ]` → the test detects the regression |
| Mutation: `emailRecipientsFor` checks `listenersConfigured('inquiry.created')` | The new test (b) fails: `expected [] to be null` → the test detects the regression |
| Mutation: `setCareersFormConfig` stores the raw input instead of the normalised document | The L-3 assertion fails: `expected { Object (jobTitle, message, ...) } to match object { Object (name, email, ...) }` → the stored-row assertion detects it (the returned value was still correct, which is the gap L-3 described) |
| Frontend M-1 behaviour (temporary vitest probe, file deleted afterwards) | 3/3 passed: the three keys are in `PERMISSION_KEYS`, the Arabic labels equal the server's, `emptyPermissions()` contains them, and a granted `viewApplications` survives `toAdminUser()` → the users form shows it ticked and the save does not strip it |
| Prisma provider regex on LF and CRLF | old: LF match / CRLF no-match; new: LF and CRLF both match, output always `provider = "postgresql"` |

All three mutations were reverted immediately; the final full-suite run (22 files / 164 tests) was done after the reverts.

Guard pass (clean-code-guard) applied after the gates: two cleanups, both re-verified by the gates above —

* `server/src/services/notificationListeners.ts` — the `configuredKeyFor()` export was removed (it existed only for the test, and the test asserting against it was self-referential); the test now pins the literal key name `notifications.job_application`.
* `src/components/admin/users/usersModel.ts` — `PERMISSION_LABELS` reordered to match `PERMISSION_KEYS`.

clean-code-guard: 2 fixed, 0 flagged for author.

## Not verified

* The behaviour in a browser (admin users form, admin notification panel) was not exercised through a real UI; the frontend verification above is a headless probe of the same functions the UI calls.
* `server/prisma/schema.postgresql.prisma` was generated and validated, but not applied to a PostgreSQL database in this task (no database was started here).
* `npx prisma …` was not run verbatim: the repo root has no `prisma` binary, so `npx` would have installed one; the equivalent local CLI was used instead (same package as `db:gen:prod` runs).
* The review's other findings (M-2, M-3, M-5, L-1…L-8, S-1) were not touched; their status is unchanged from `task-w1-foundation-review.md`.
