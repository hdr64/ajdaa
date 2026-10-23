# Review: task w1-foundation (schema + permissions for 3 new features)

## Scope and method

Reviewed everything this lane changed or added, in the worktree `D:\projects\html\ajda-wt\foundation`
(branch `lane/foundation`):

* `server/prisma/schema.prisma`, `server/prisma/migrations/20261022000000_foundation_past_projects_applications/migration.sql`,
  `server/prisma/seed.ts`
* `server/src/config/permissions.ts`, `server/src/config/constants.ts`, `server/src/types/fastify.d.ts`
* `server/src/services/careersSettings.ts` (new), `server/src/services/notificationListeners.ts`
* `server/test/{careersSettings,permissions,roles,notification-listeners}.test.ts`
* `task-w1-foundation-report.md`

Method: read every changed line; traced the new permission keys / notification event / setting key
through the surrounding code (`middleware/auth.ts`, `routes/roles.routes.ts`, `routes/auth.routes.ts`,
`routes/notifications.routes.ts`, `services/notificationService.ts`, `src/components/admin/**` for the
consumer side); ran the gates; executed the migration chain against a throwaway PostgreSQL 18.4 and
ran `prisma migrate diff` to check drift; ran mutation checks on the new tests; and ran one temporary
regression probe against the running API (the probe file was deleted afterwards).

**Not reviewed / out of scope**: the frontend implementation of the three features (not in this lane),
and the prod deployment itself (no prod system was touched).

## Summary

The foundation layer is sound: the migration is additive, applies cleanly on real PostgreSQL through
the real `prisma migrate deploy` path, leaves **zero** drift against `schema.prisma`, and the new
models behave correctly through the generated Prisma client. The permission catalogue and the
`careers.form` setting are internally consistent and mutation-tested.

One **High** finding is a real regression path introduced by this lane: registering `job_application`
in the shared notification-event enum lets an admin create a listener for an event that has no
sender yet, and doing so **silently stops all inquiry notifications** — reproduced in this session.
Everything else is Low/Medium and mostly concerns the next lane or the frontend.

Counts: **Critical 0 / High 1 / Medium 5 / Low 8 / Suspected 1.**

Top risks:
1. A `job_application` listener silently kills inquiry e-mails (H-1).
2. The admin **users** form renders the new permissions as always-unchecked and drops them on save (M-1).
3. `JobApplication.jobTitle` is `NOT NULL` in the DB but toggleable in the form config (M-2).
4. **There is no private upload directory**: everything under `UPLOAD_DIR` is served publicly at
   `/uploads/`, so a CV stored there is world-readable (M-4).
5. `model3dUrl` and `virtualTour3dAvailable` now encode the same fact twice, and the 7 seeded
   projects have the flag set with no URL (M-5).

> A second, deeper pass was run after the first report (see **Second pass** at the end): it covered
> the dev/SQLite path, the upload-serving convention and the `Project` 3D flag, and produced M-4,
> M-5, L-7, L-8 plus the verification evidence in “What looks solid”.

## Findings

### [H-1] A `job_application` listener silently disables inquiry notifications — High · Confirmed

- **Where:** `server/src/services/notificationListeners.ts:84-86` (`listenersConfigured`),
  `server/src/services/notificationListeners.ts:144-162` (`emailRecipientsFor`),
  `server/src/services/notificationService.ts:36-41` (`inquiryRecipients`),
  reachability: `server/src/routes/notifications.routes.ts:22` (`z.enum(NOTIFICATION_EVENTS)`),
  `src/components/admin/settings/NotificationListenersPanel.tsx:98-102` (the event dropdown)
- **What is wrong:** “have the team configured notifications?” is decided **globally**, not per event.
  `listenersConfigured()` only checks whether an `AppSetting` row with key `notifications` exists, and
  `createListener` creates that row for *any* event. Once it exists, `emailRecipientsFor('inquiry.created')`
  returns `[]` (not `null`) when no enabled `inquiry.created` listener matches, and `inquiryRecipients()`
  therefore skips the legacy fallback (`NOTIFY_INQUIRY_EMAILS` / all `viewInquiries` admins) and mails
  nobody. Before this lane the only creatable event was `inquiry.created`, so a listener was always an
  inquiry listener. Now an admin can create a `job_application` listener — the event is in the shared
  enum — and inquiry notifications die without any error.
- **Trigger / evidence:** reproduced with a temporary vitest probe against the running API:
  1. baseline, no listener row → `POST /api/inquiries` → mail sent to the inquiry viewers
     (`PROBE baseline recipients: [ admin@ajdaa.sa ]`);
  2. `POST /api/notifications/listeners` with `event: 'job_application'` → **201 Created**
     (`{"id":"cmvii5ncc0000txnknzil4k5h","event":"job_application", …}`);
  3. `POST /api/inquiries` again → `PROBE inquiry recipients after job_application listener: []`,
     `PROBE every sent mail kind: []` — **zero** mails, no error, no log.
  The admin panel makes this reachable without any API knowledge: the event `<select>` is filled from
  the server’s event list and renders `EVENT_LABELS[event] ?? event`, so the new event appears in the
  dropdown as the raw key `job_application`.
- **Impact:** sales inquiry alerts (a business-critical channel) stop silently after a plausible admin
  action. Nothing in the UI or the logs says “inquiry notifications are now off”.
- **Fix:** the task explicitly asked for the event to be registered without a sender, so the *event
  registration* stays. The fallback semantics must become per event, or the sender must land with it.
  Minimal, behaviour-preserving-for-inquiries variant in `emailRecipientsFor`:
  ```ts
  export async function emailRecipientsFor(event: NotificationEvent): Promise<string[] | null> {
    if (!(await listenersConfigured())) return null;
    const listeners = await prisma.notificationListener.findMany({
      where: { event, channel: 'email', enabled: true },
    });
    if (listeners.length === 0) return null;   // no listener for THIS event → keep the legacy rule
    …
  }
  ```
  ⚠️ This changes the semantics asserted by the existing test “sends nothing when the only listener is
  disabled or every listener was deleted” (`server/test/notification-listeners.test.ts:152-166`), which
  encodes “once configured, always configured”. That is a deliberate product decision, so it needs the
  reviewer’s call, not a silent change. The alternative — land the careers sender in the same merge —
  needs no change to the shared semantics.
- **Verify:** the probe above (baseline > 0 recipients, after a `job_application` listener > 0 recipients).

### [M-1] The admin “users” form shows the new permissions as unchecked and strips them on save — Medium · Confirmed

- **Where:** `src/components/admin/users/usersModel.ts:41-56` (fixed `PERMISSION_KEYS`),
  `src/components/admin/users/usersModel.ts:107-125` (`emptyPermissions`),
  `src/types/admin.ts:7-22` (`AdminPermissions`),
  `src/components/admin/users/UserFormDialog.tsx:273` (`permissions: { ...user.permissions }`),
  `:295` (toggle), `:352` (`changes.permissions = form.permissions`)
- **What is wrong:** the users form renders permissions from the **server catalogue** (so the three new
  ones appear) but keeps the checked state in a **fixed frontend map** that does not contain them.
  `form.permissions['viewApplications']` is `undefined` → the checkbox renders unchecked even for an
  admin who holds the permission, and saving any user posts a map without the three keys, so they are
  deleted from that user’s stored map. The **roles** form is unaffected (it is catalogue-driven end to
  end and the server accepts the new keys).
- **Trigger / evidence:** reading the code path above; `usersModel.ts` lists 14 keys, none of them
  `managePastProjects` / `viewApplications` / `manageApplications`. The server side is fine:
  `auth.routes.ts:92,106` use `z.record(z.boolean())`, so the API can grant the keys today.
- **Impact:** the new permissions can be granted per role but not per user through the UI, and any user
  edited in the UI loses them. Silent, but the effective access of a non-super admin changes.
- **Fix:** extend the frontend `AdminPermissions` type and `PERMISSION_KEYS`/`emptyPermissions` in
  `usersModel.ts` with the three keys (frontend lane).
- **Verify:** create a user with `viewApplications` via the API, open it in the users form → the box
  must be ticked; save → the key must still be in the stored map.

### [M-2] `jobTitle` is `NOT NULL` in the database but optional in the form config — Medium · Confirmed (spec tension)

- **Where:** `server/prisma/schema.prisma:316` (`jobTitle String`), `server/src/services/careersSettings.ts:44-53`
  (default `jobTitle: true`, not in `ALWAYS_REQUIRED_FIELDS`)
- **What is wrong:** the decided design makes the column mandatory while the form flag that governs it
  can be switched off. An admin who turns `jobTitle` off produces applications the column cannot hold.
- **Trigger / evidence:** `setCareersFormConfig({required:{jobTitle:false}}, …)` succeeds and stores
  `jobTitle:false`; a later application without a job title then violates the `NOT NULL` constraint.
- **Impact:** a runtime insert error on the public application endpoint — the main path of the feature
  the next lane builds.
- **Fix:** either add `jobTitle` to `ALWAYS_REQUIRED_FIELDS` (it is structurally required), or make the
  column nullable in the schema + migration. Both change the decided design, so the owner/reviewer must
  pick. Left as specified in this lane.
- **Verify:** after the decision, a test that stores `jobTitle:false` and asserts the resulting
  behaviour.

### [M-3] The listener config has no “application viewers” option — Medium · Confirmed

- **Where:** `server/src/services/notificationListeners.ts:22-26` (`EmailListenerConfig.toInquiryViewers`),
  `server/src/services/notificationListeners.ts:125-138` (`activeInquiryViewerEmails`)
- **What is wrong:** the recipient resolver for a `job_application` listener selects admins with
  `viewInquiries` (the config field is literally named `toInquiryViewers`). The new `viewApplications`
  permission is never consulted.
- **Trigger / evidence:** code read; the careers lane will need a `toApplicationViewers` flag and a
  recipient helper based on `viewApplications`, which means changing the shared listener config and its
  route schema.
- **Impact:** wrong recipients (or, once H-1 is fixed, inquiry viewers receiving application alerts) —
  PII of job applicants going to the wrong people.
- **Fix:** in the careers lane, add `toApplicationViewers` to the listener config and a
  `activeApplicationViewerEmails()` helper; keep the two event families separate.
- **Verify:** a listener for `job_application` with `toApplicationViewers: true` must resolve exactly
  the admins holding `viewApplications`.

### [L-1] `JOB_APPLICATION_STATUSES` / `JOB_APPLICATION_STATUS_AR` are unused exports — Low · Confirmed

- **Where:** `server/src/config/constants.ts:46-60`
- **What is wrong:** nothing in the server imports them yet (every other entry in that file is consumed
  by a route via `z.enum(...)`, e.g. `inquiries.routes.ts:39`).
- **Impact:** dead code today; the careers lane needs exactly this list, so it is more “pre-placed
  constant” than “dead code”, but a reviewer may prefer it to arrive with the lane that uses it.
- **Fix:** keep it (it mirrors `INQUIRY_STATUSES` and pins the values the schema comment defines), or
  delete it and let the careers lane add it.

### [L-2] The server-side event labels are not used by the admin UI — Low · Confirmed

- **Where:** `server/src/services/notificationListeners.ts:19-30` (`NOTIFICATION_EVENT_LABELS`),
  `src/components/admin/settings/NotificationListenersPanel.tsx:13-15` (the UI’s own `EVENT_LABELS`)
- **What is wrong:** two label sources. The UI keeps its own map, so the new event shows as the raw
  key `job_application` in the dropdown; the server map is only read by the test.
- **Impact:** a raw English key in an Arabic admin panel; also a future drift risk between the two maps.
- **Fix:** the frontend lane should use the server labels (they are now served by the API) or add the
  key to the UI map.

### [L-3] Test gap: the setter’s normalisation of the *stored* row is not asserted — Low · Confirmed

- **Where:** `server/test/careersSettings.test.ts:67-88`
- **What is wrong:** the test asserts the value returned by `setCareersFormConfig`, but not the row that
  was written. A regression that stores the raw input and only forces on read would still pass.
- **Fix:** add
  ```ts
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  expect(JSON.parse(row!.value).required).toMatchObject({ name: true, email: true, phone: true });
  ```

### [L-4] The cached settings object is returned by reference — Low · Confirmed

- **Where:** `server/src/services/careersSettings.ts:107-112`
- **What is wrong:** `getCareersFormConfig()` returns the cached object itself; a caller that mutates it
  (`config.required.message = true`) poisons the cache for every later reader in the process.
- **Impact:** none today (no caller yet); the same pattern exists in `securitySettings.ts` and
  `siteSettings.ts`, so it is the house style rather than a new defect.
- **Fix:** return a copy (`{ required: { ...cached.required } }`) if a future caller mutates the result.

### [L-5] The seeded super-admin user map and the super-admin role template now disagree — Low · Confirmed

- **Where:** `server/prisma/seed.ts:144-160` (role template: 8 keys) vs `server/prisma/seed.ts:18-25`
  (user map: 5 keys)
- **What is wrong:** the role template and the seeded user’s permission map are two separate sources of
  truth and now differ by the three new keys. `GET /api/roles` shows 8, `GET /api/auth/users` shows 5
  for the same super admin.
- **Impact:** cosmetic only — `hasPermission()` short-circuits for `role === 'super_admin'`
  (`server/src/middleware/auth.ts:41`), and the seeded map was already a minimal core set (it omits 9
  other catalogue keys). The existing “Migration equivalence check” test asserts the user map, not the
  role, so it still passes.
- **Fix:** none required; mention it if the reviewer expects the two to match.

### [L-6] `npm run db:gen:prod` produces a SQLite “prod” schema on a CRLF checkout — Low · Confirmed (pre-existing, out of scope)

- **Where:** `server/scripts/generate-prod-schema.mjs:12-15`
- **What is wrong:** the regex `/provider = "sqlite" \/\/.*\n/` cannot match a CRLF line ending, and this
  Windows checkout has CRLF files. The script prints “Generated …” but the file still says
  `provider = "sqlite"`, so the “prod” Prisma client is a SQLite client.
- **Trigger / evidence:** after `npm run db:gen:prod`, `server/prisma/schema.postgresql.prisma` still
  contained `provider = "sqlite"`; the prod-schema gate therefore validated the SQLite schema.
  (On the Linux prod host, with an LF checkout, the script works.)
- **Impact:** the prod-schema gate is toothless on Windows; a developer could ship a SQLite client.
- **Fix:** `/provider = "sqlite" \/\/[^\n]*\n/`. The file is outside this lane’s scope, so it was not
  changed.

### [M-4] There is no private upload directory — a CV stored under `UPLOAD_DIR` is public — Medium · Confirmed

- **Where:** `server/src/app.ts:67-69` (`fastifyStatic({ root: config.uploadDir, prefix: '/uploads/' })`),
  `server/src/config/env.ts:13,145` (`UPLOAD_DIR`), `server/src/services/mediaService.ts:108,133`
  (every upload is written into `UPLOAD_DIR`), `server/prisma/schema.prisma:315-316` (my comment)
- **What is wrong:** the whole upload directory is served by Fastify **without any authentication**.
  There is no second, private directory in this codebase, yet my schema comment says “`cvPath` points at
  a file in the PRIVATE upload directory”. That directory does not exist, so the comment states an
  assumption the code does not support — and the natural place for the careers lane to put a CV
  (`UPLOAD_DIR`, the only upload path in the repo) makes every applicant’s CV a public URL that only
  needs a guessable filename.
- **Trigger / evidence:** `GET /uploads/<file>` is served by the static plugin for anything under
  `config.uploadDir`, and `mediaService` writes every upload there. CVs are PII of job applicants.
- **Impact:** disclosure of applicant CVs if the careers lane follows the obvious path; the misleading
  comment makes that more likely.
- **Fix (careers lane):** add a `PRIVATE_DIR` env (outside `config.uploadDir`), write CVs there, and
  serve them only through an authenticated route (`requirePermission('viewApplications')` + a
  path-traversal-safe `res.sendFile`).
- **Fix (this lane, one comment):** make the schema comment precise, e.g. “`cvPath` is a relative path
  inside the private CV directory, which must NOT live under the publicly served `UPLOAD_DIR`”.
- **Verify:** after the careers lane, `GET /uploads/<cv>` must 404 and the authenticated download must
  work.

### [M-5] `model3dUrl` and `virtualTour3dAvailable` are now two sources of truth for one fact — Medium · Confirmed

- **Where:** `server/prisma/schema.prisma:105-106` (the new column sits next to the existing flag),
  `server/prisma/seed.ts:383` + `server/prisma/seed-data/projects.seed.ts` (all 7 seeded projects have
  `virtualTour3dAvailable: true`), `src/pages/admin/sections/ProjectShowSection.tsx:394` (the admin panel
  renders “الجولة الافتراضية: متوفرة/غير متوفرة” from the flag),
  `docs/archive/original-refactor.md:432` (“`Project.model3dUrl`; `virtualTour3dAvailable` becomes derived
  from it”)
- **What is wrong:** the archived plan already says the flag should become derived from the new column,
  but the flag is still an independent boolean with `default(false)`. The two can disagree in both
  directions: a project with a URL but a stale `false` hides the viewer, and the 7 seeded projects have
  `true` with **no** URL.
- **Trigger / evidence:** the seed writes `virtualTour3dAvailable: p.virtualTour3dAvailable ?? false` and
  every seeded project sets it to `true`, while `model3dUrl` is null for all of them (verified on the
  migrated prod database: `model3dUrl` is NULL for all 7 seeded projects).
- **Impact:** after the wave-2 projects lane, a “3D tour available” badge/button with no link, or a
  hidden viewer for a project that has one. The public payload also changed silently: the project
  endpoints use `include` without a `select` whitelist, so every project JSON now carries
  `model3dUrl: null` (no test asserts the payload key set, and the frontend ignores the unknown field).
- **Fix (projects lane):** derive the flag from `model3dUrl` in the server serializer, or set both in
  the admin write path; backfill `virtualTour3dAvailable = (model3dUrl IS NOT NULL)` when it lands.
- **Verify:** a project with `model3dUrl` shows the viewer and one without does not — regardless of the
  stored flag.

### [L-7] `updatedAt` has no DB default — a raw insert fails — Low · Confirmed (house pattern)

- **Where:** `server/prisma/migrations/20261022000000_foundation_past_projects_applications/migration.sql:25`
  (`"updatedAt" TIMESTAMP(3) NOT NULL`), same for `past_projects` and for the existing
  `developer_notes` / `cms_sections` models
- **What is wrong:** Prisma fills `@updatedAt` on write, but the column has no DB default, so any raw
  SQL insert (a data migration, a hand-written seed, a fix script) that omits it fails.
- **Trigger / evidence:** verified on the dev SQLite database — an `INSERT INTO job_applications (...)`
  without `updatedAt` → `PrismaClientKnownRequestError` (NOT NULL constraint).
- **Impact:** a future lane that inserts applications by raw SQL hits a confusing constraint error.
- **Fix:** none required (it matches every other `@updatedAt` model in this schema); mention it in the
  careers lane’s notes, or add `DEFAULT CURRENT_TIMESTAMP` if the project prefers DB-side defaults.

### [L-8] The settings key set is incomplete for wave 2 — Low · Confirmed

- **Where:** `docs/MASTER-PLAN.md:12` (“settings keys for job-form required flags **and notification
  emails**”), `refactor.md:11-12` (5.2 “recipient emails configurable”)
- **What is wrong:** the MASTER-PLAN expects **two** settings keys for this feature; the task prompt
  (authoritative for this lane) only asked for `careers.form`, which is what I built. There is no key
  for the configurable recipient addresses, and the listener config has no `toApplicationViewers`
  field (M-3).
- **Impact:** none for this lane; the careers lane must add both the recipients setting and the
  listener-config field, or the “recipients configurable” requirement (note 5.2) is unmet.
- **Fix:** in the careers lane — e.g. an `AppSetting` key `careers.notifications` plus a
  `toApplicationViewers` flag in the listener config.

### [S-1] Suspected: the careers settings cache is per-process — Suspected

- **Where:** `server/src/services/careersSettings.ts:62` (module-level `cached`)
- **Why it might be a problem:** with more than one server process, a config change made through one
  process leaves the others serving the old document until they restart.
- **To confirm:** the deployment runs a single process (`deploy/ajda-api.service:22` → `node dist/server.js`,
  no cluster flag), so today it is a non-issue. It becomes one only if the API is scaled horizontally.
  No action needed now.

## Cross-cutting patterns

* **Two sources of truth for the same catalogue.** The server owns the permission keys and the event
  list, but the frontend keeps parallel copies (`usersModel.PERMISSION_KEYS`, `usersModel.PERMISSION_LABELS`,
  `notificationsService.NotificationEvent`, `NotificationListenersPanel.EVENT_LABELS`). Every new
  server-side key/event therefore lands in a UI that is silently out of date — the root cause of M-1 and
  L-2. A follow-up that serves the catalogue/labels from the API (they already are) and drops the
  frontend copies would remove the whole class.
* **Global “configured” flags where per-item state is meant.** `listenersConfigured()` decides for all
  events at once, which is what turns H-1 from a nit into a silent outage.
* **Lenient read, strict write.** `parseCareersFormConfig` ignores invalid stored values while
  `setCareersFormConfig` rejects them. That asymmetry is intentional and documented, and it is the
  reason a corrupted row can never widen access — worth keeping.

## Missing tests / checks

1. The stored row after `setCareersFormConfig` (see L-3).
2. A regression test for H-1 (a listener for an event without a sender must not disable the other
   event’s notifications) — the behaviour it pins is a product decision, so the test should be written
   together with that decision.
3. A test that the `JobApplication` status values accepted by the API are exactly the ones in
   `JOB_APPLICATION_STATUSES` (once a route exists).

## What looks solid (actually checked)

* The migration is purely additive (`ALTER TABLE … ADD COLUMN` of a nullable column + 2 new tables +
  3 indexes) — no rewrite, no long lock on `Project`.
* `prisma migrate deploy --schema prisma/schema.postgresql.prisma` applied all 13 migrations on a real
  PostgreSQL 18.4, and `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma
  --script` printed **nothing** → the migrated database matches `schema.prisma` exactly, dev and prod
  agree, and the new `@@map`ped tables keep Prisma’s expected names/index names.
* The new models behave correctly through the generated client on PostgreSQL: `PastProject.id`
  auto-increments via `nextval('past_projects_id_seq')`, `published`/`sortOrder` defaults apply,
  `JobApplication.id` is a cuid, `status` defaults to `new`, and `Project.model3dUrl` round-trips.
* **The dev path was verified too** (second pass): `prisma db push` on a scratch SQLite database
  creates `past_projects` with Prisma’s own SQLite spelling
  `"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT` → the autoincrement works on dev as well
  (ids 1, 2), the three indexes exist with the expected names and columns
  (`past_projects_published_sortOrder_idx`, `job_applications_status_idx`,
  `job_applications_createdAt_idx`), `Project.model3dUrl` is added to the SQLite `Project` table and
  round-trips, and `WHERE published = true ORDER BY sortOrder` (the public list query) is served by the
  composite index in the right column order.
* The “identity fields can never be optional” invariant is enforced on **both** paths (getter forces,
  setter normalises) and is mutation-verified: removing the forcing makes
  `careersSettings.test.ts` fail.
* The catalogue ↔ `PERMISSION_KEYS` parity test (`permissions.test.ts`) makes the two lists impossible
  to let drift apart; the mutation check confirmed it fails when they do.
* `rolePermissionsToUserPermissions` and `parseRolePermissions` are key-driven, so the three new keys
  flow through the role APIs automatically — no route change was needed, and the roles API already
  accepts them (`z.enum(PERMISSION_KEYS)`).
* The new tests are deterministic and isolated (temp SQLite DB, no clock/network/ordering dependence);
  the full suite is 22 files / 162 tests, green.
* No `.env` file was read or written, no dependency was added, nothing was committed, and no file
  outside the lane’s scope was modified except `server/src/types/fastify.d.ts` (3 lines, required by
  `PermissionDef.key`).

## Second pass (added after the first report)

The first pass covered the compile/logic/boundary/error-path/state/security/integration/test lenses on
the diff itself. A second pass was then run over the **paths around** the diff that the first pass had
not executed:

* the **dev/SQLite** path (`prisma db push` + Prisma client) for the new models — executed on a
  scratch database, DDL inspected, inserts/queries run (results in “What looks solid”, and L-7);
* the **upload-serving convention** — read `app.ts`, `config/env.ts`, `mediaService.ts` to test the
  premise of my own `cvPath` comment (→ M-4);
* the **`Project` 3D fields** — traced `virtualTour3dAvailable` through the seed, the admin UI and the
  archived plan (→ M-5);
* the **API payload shape** — checked whether the project endpoints whitelist columns (they do not, so
  `model3dUrl` is already in the public JSON);
* the **settings-key inventory** — compared the MASTER-PLAN against what this lane created (→ L-8);
* the **raw-SQL insert path** for the new tables (→ L-7).

Both passes are read-only apart from the report files; no production data was touched, the scratch
PostgreSQL cluster and the scratch SQLite database were deleted, and the temporary regression probe
file was removed.
