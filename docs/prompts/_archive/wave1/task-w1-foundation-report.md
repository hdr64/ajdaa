# Task w1-foundation — report

Lane `foundation` (branch `lane/foundation`). Foundation only: schema, permissions, one notification
event, one settings service, one migration. **No routes, no UI, no commits, no installs.**

## Files changed

| File | Change |
|---|---|
| `server/prisma/schema.prisma` | `Project.model3dUrl String?`; new `PastProject` model (`@@map("past_projects")`); new `JobApplication` model (`@@map("job_applications")`) |
| `server/prisma/migrations/20261022000000_foundation_past_projects_applications/migration.sql` | **new** — items 1–3 of the design (see below) |
| `server/src/config/permissions.ts` | 3 new catalogue entries + `PERMISSION_KEYS` (`managePastProjects`, `viewApplications`, `manageApplications`) |
| `server/src/types/fastify.d.ts` | the 3 new keys added to the `AdminPermission` union — **outside the file scope listed in the prompt**, see “Deviations” |
| `server/src/services/notificationListeners.ts` | `job_application` added to `NOTIFICATION_EVENTS`; `NOTIFICATION_EVENT_LABELS` (Arabic + English) added |
| `server/src/services/careersSettings.ts` | **new** — `getCareersFormConfig()` / `setCareersFormConfig()` for the `careers.form` setting |
| `server/src/config/constants.ts` | `JOB_APPLICATION_STATUSES` + `JOB_APPLICATION_STATUS_AR` (mirrors the `INQUIRY_STATUSES` pattern) |
| `server/prisma/seed.ts` | the `super_admin` **role template** now carries the 3 new permissions (5 → 8). The seeded per-user permission maps are untouched |
| `server/test/careersSettings.test.ts` | **new** — 7 tests (defaults, round trip, forced identity fields, invalid input, parser edge cases) |
| `server/test/permissions.test.ts` | **new** — 8 tests (catalogue ↔ key list parity, labels, new keys, parsing) |
| `server/test/roles.test.ts` | catalogue length 14 → 17, super-admin role length 5 → 8, new keys asserted |
| `server/test/notification-listeners.test.ts` | the `events` array assertion now expects `['inquiry.created', 'job_application']`; new test that every event has a label |

Unchanged on purpose: no route, no admin UI, no seed of projects, no `.env` file was read or written.

## Migration SQL file name

`server/prisma/migrations/20261022000000_foundation_past_projects_applications/migration.sql`

`ALTER TABLE "Project" ADD COLUMN "model3dUrl" TEXT;` + `CREATE TABLE "past_projects"` +
`CREATE TABLE "job_applications"` + 3 `CREATE INDEX`. The DDL is equivalent to what
`prisma migrate diff` generates for the Postgres provider (same columns, types, defaults, primary
key and index names); the only textual differences are the house comment style and whitespace in the
`ALTER TABLE` statement.

## Gate output summary (all run in this session)

| Gate | Command | Result |
|---|---|---|
| Server build | `npm --prefix server run build` | clean (`tsc`, no output) |
| Server tests | `npm --prefix server test` | **22 files / 162 tests passed** (16 of them are new in this task: 7 careersSettings + 8 permissions + 1 notification-events) |
| Prisma validate (dev) | `npx prisma validate --schema prisma/schema.prisma` | `The schema at prisma\schema.prisma is valid 🚀` |
| Prod schema | `npm --prefix server run db:gen:prod` | ran; see the caveat below |
| Prisma validate (prod) | `npx prisma validate --schema prisma/schema.postgresql.prisma` | `The schema at prisma\schema.postgresql.prisma is valid 🚀` |
| Root lint (MASTER-PLAN gate) | `npm run lint` | clean (oxlint) |
| Root build (MASTER-PLAN gate) | `npm run build` | built (only the pre-existing “chunks > 500 kB” warning) |

`prisma validate` needs `DATABASE_URL` in the environment; the gate was run with a throwaway
`file:`/`postgresql://` value, no real database was touched by it.

### Caveat: `db:gen:prod` does not swap the provider on a Windows checkout (pre-existing bug)

`server/scripts/generate-prod-schema.mjs` replaces the provider with the regex
`/provider = "sqlite" \/\/.*\n/`. The regex does not match a CRLF line ending (`.` does not match
`\r`), and this checkout has CRLF files (`core.autocrlf=true`). The script therefore prints
“Generated …” but the file still says `provider = "sqlite"`, so `db:gen:prod` silently produces a
**SQLite** prod schema and a SQLite Prisma client on Windows. On the Linux prod host (LF checkout)
the script works.

Consequence for this lane: the “prod” validate above was repeated with a correctly generated
prod schema (same replacement, CRLF-tolerant) and it is valid, and the new models were additionally
executed against a real PostgreSQL 18.4 (see below). The script itself is outside the file scope of
this task, so it was **not** modified — the one-line fix is
`/provider = "sqlite" \/\/[^\n]*\n/`.

## Extra verification (beyond the listed gates)

* **The real prod path, end to end on PostgreSQL 18.4** (throwaway cluster in the temp folder,
  port 55432, stopped and the data dir deleted afterwards):
  `npx prisma migrate deploy --schema prisma/schema.postgresql.prisma` applied all 13 migrations
  (“All migrations have been successfully applied”), and `npm run db:seed` then seeded the migrated
  database (2 admins, 5 categories, 7 projects / 12 floors / 30 units) with the new 8-key
  `super_admin` role template.
* **No schema drift**: `prisma migrate diff --from-url <migrated db> --to-schema-datamodel
  prisma/schema.prisma --script` produced **no output** — the migrated database matches
  `schema.prisma` exactly (dev SQLite and prod Postgres agree).
* **Postgres DDL behaviour**: `past_projects.id` is `integer NOT NULL DEFAULT nextval('past_projects_id_seq')`
  (autoincrement works), `published` defaults to `true`, `sortOrder` to `0`, `job_applications.status`
  to `'new'`, and the 3 indexes exist.
* **Prisma client against PostgreSQL** (prod schema + prod client): created and read back a
  `PastProject` (id 4, `published=true`, `sortOrder=3`), a second one (id 5 → sequence works), a
  `JobApplication` (cuid id, `status='new'`), and a `Project` with `model3dUrl` (read back
  `https://viewer.example.com/model/1`).
* **Migration SQL on SQLite** (scratch file): the DDL applies; the `SERIAL` column does not
  auto-assign there, which is expected and irrelevant (dev uses `prisma db push`, prod uses
  `prisma migrate deploy` against Postgres).
* **Mutation checks** (each mutation was reverted afterwards):
  * removing the forced identity fields in `careersSettings.ts` → `careersSettings.test.ts` fails
    (1 failed / 6 passed);
  * removing `manageApplications` from `PERMISSION_KEYS` → `permissions.test.ts` fails (4 failed);
  * removing `job_application` from `NOTIFICATION_EVENTS` → `notification-listeners.test.ts` fails.
* **Regression probe** (temporary test, deleted afterwards): creating a `job_application` listener
  silently stops inquiry notifications — see “Known issues” #2.

## Decisions

1. **Table names** `past_projects` / `job_applications` via `@@map`, following the newest models
   (`cms_clients`, `developer_notes`).
2. **Autoincrement id uses `SERIAL`** in the migration, exactly like the init migration’s
   `Project.id` / `PropertyFloor.id` and like Prisma’s own Postgres DDL. `INTEGER PRIMARY KEY` would
   be the SQLite spelling but has no sequence in Postgres, where the migration is actually applied
   (`migrations/migration_lock.toml` says `provider = "postgresql"`).
3. **Permissions**: `managePastProjects` → group `cms`; `viewApplications` / `manageApplications` →
   group `inquiries`. Existing groups were reused on purpose: the admin UI renders the catalogue
   grouped by that field and falls back to the raw English slug for an unknown group
   (`PERMISSION_GROUP_LABELS[key] ?? key`), and the frontend is out of scope here.
4. **Role assignment**: only the `super_admin` **role template** got the 3 new keys. The other
   seeded roles keep their current list — they never carried the CMS permissions either
   (`manageCms`, `manageClients`, `rollbackCms` are granted to no seeded role), and an admin can
   grant the new keys per user from the users panel. `hasPermission()` grants everything to
   `role === 'super_admin'` regardless of the stored map, so super admins are unaffected either way.
5. **`careers.form` defaults live in `careersSettings.ts`** (like `SITE_DEFAULTS` in
   `siteSettings.ts` and `DEFAULTS` in `securitySettings.ts`); there is no central
   `siteSettingsDefaults` file in the repo. The getter forces `name`, `email`, `phone` to
   `required: true`, the setter normalises the same way before writing, and a corrupted or
   hand-edited row can never switch the identity fields off.
6. **The notification sender was not built** (explicitly out of scope). Only the event key and its
   labels were registered.

## Deviations / out-of-scope files touched

* `server/src/types/fastify.d.ts` — **one file outside the scope list**. The `AdminPermission` union
  is the type of `PermissionDef.key`, so adding a catalogue key without extending the union breaks
  `tsc`. The change is three lines (three new union members) and nothing else.
* `server/src/config/constants.ts` — inside the allowed `server/src/config` scope; it adds the
  `JobApplication` status list/labels that the decided design defines in the schema comment.

## Known issues & follow-ups for later lanes (not fixed here)

1. **A listener for `job_application` silently stops inquiry notifications** (regression path
   introduced by registering the event). `listenersConfigured()` is global, not per event
   (`notificationListeners.ts:84-86`): once *any* listener row exists, `emailRecipientsFor('inquiry.created')`
   returns `[]` instead of `null`, so `inquiryRecipients()` (`notificationService.ts:36-41`) skips the
   legacy fallback and no inquiry mail is sent. Reproduced in this session: creating a
   `job_application` listener (accepted with 201, because the event is now in the shared enum) and
   then submitting an inquiry produced **0** mails, while the same inquiry with no listener produced
   mail for the inquiry viewers. The admin panel makes this reachable — its event dropdown is fed
   by the server list, so it now offers an unlabelled `job_application` option
   (`NotificationListenersPanel.tsx:98-102`). Options for the next lane: land the job-application
   sender together with the event, or make the "configured" fallback per event (that changes the
   behaviour an existing test asserts, so it needs a deliberate decision). Not changed here: the
   task explicitly asked for the event to be registered without a sender, and the current fallback
   semantics are covered by an existing test.
2. **`jobTitle` is not nullable in the model but is toggleable in the form config.** The decided
   design makes `JobApplication.jobTitle` `String` (NOT NULL) while only `name`, `email` and `phone`
   are forced to required. If an admin switches `jobTitle` off, the careers lane must decide what to
   store (empty string vs. forcing the flag on). Left as specified.
3. **The listener config only knows `toInquiryViewers`.** A `job_application` listener created today
   reuses that field, which selects admins with `viewInquiries`. The careers lane needs a
   `toApplicationViewers` option (and a recipient helper based on `viewApplications`) before it can
   send application emails — that needs a change in the shared listener config and its route, which
   is out of scope here.
4. **The admin “users” form ignores the new permission keys.** The **roles** form is catalogue-driven
   and can already grant them (it renders the server catalogue and sends the keys back; the server
   accepts them). The **users** form is not: `src/components/admin/users/usersModel.ts` keeps its own
   fixed `PERMISSION_KEYS` list / `AdminPermissions` map, so the three new permissions render
   (from the server catalogue) but always unchecked, and saving a user sends a map without them —
   which silently strips them from a non-super admin. The API itself accepts them
   (`z.record(z.boolean())` in `auth.routes.ts`), so they can already be granted per user.
5. **`src/services/notificationsService.ts` / `NotificationListenersPanel.tsx`** still know only
   `inquiry.created`; the admin panel shows the raw `job_application` key until the frontend event
   list and its label map are updated (frontend out of scope).
6. **The prod `super_admin` role row** in an existing production database still holds the old
   5-permission list until the next `npm run db:seed` (the deploy runbook applies migrations and
   then the seed). Functionally irrelevant, because `hasPermission()` short-circuits for
   `role === 'super_admin'`.
7. **Pre-existing bug in `server/scripts/generate-prod-schema.mjs`** (see the gate caveat above):
   the prod schema is not generated correctly on a CRLF checkout.
8. **`JOB_APPLICATION_STATUSES` / `JOB_APPLICATION_STATUS_AR` in `server/src/config/constants.ts` are
   not used by any server code yet** — they are the status list the careers lane needs, added next to
   the equivalent `INQUIRY_STATUSES` / `UNIT_STATUSES` entries. Drop them if the next lane prefers to
   introduce them itself.
9. **There is no private upload directory yet.** `app.ts` serves the whole `UPLOAD_DIR` publicly at
   `/uploads/`, so the careers lane must add a private directory (outside `config.uploadDir`) and an
   authenticated download route for the CVs, otherwise applicant CVs are world-readable. The
   `cvPath` comment in the schema should be read with that in mind.
10. **`model3dUrl` and `virtualTour3dAvailable` now describe the same thing twice.** The archived plan
    (`docs/archive/original-refactor.md:432`) says the flag becomes derived from the new column; until
    the projects lane does that, the two can disagree (the 7 seeded projects have the flag on and no
    URL).
