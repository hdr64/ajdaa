# Review: Ajda platform (whole project)

Hostile-code-hunter pass over the entire repository. **Nothing was changed** — this is a report only.

## Scope and method

**Scope: the whole project.** `server/src` (51 files, 10.8k lines), `server/test` (43 files, 7.8k), `server/prisma` (schema + 15 migrations + seeders), `server/scripts`, `src/` (207 files, 40.9k lines), plus the deploy runbook, config and build files. ~59k lines of code.

**Method.** Four parallel reviewer passes, each with the full code-bug lens (compile/parse, logic, boundary/input, error-path, state/concurrency, security, integration, performance, test): (1) server auth/security surface, (2) server routes + services, (3) prisma schema/migrations/seeders, (4) client admin UI, (5) client public pages, (6) client services/state/i18n. Findings were then **re-verified by the orchestrator** before being promoted to "Confirmed".

Everything below is marked with how it was established:

- **`Verified`** — the orchestrator re-read the exact lines, quoted both sides where two files disagree, and ran a byte-level check where the claim is about encoding. These can be acted on without further checking.
- **`Reported`** — from a read-only review pass with its own quoted evidence, but the orchestrator did not independently re-read those lines. Treat as a strong lead, not a proven fact.
- **`Suspected`** — the reviewer could not confirm it without running the app or a database.

No dev server, build, database, or destructive command was run. No `.env*` file and no `server/prisma/dev.db` was read. No file was modified; the only files created were throwaway verification scripts, all deleted.

**Not reviewed:** `node_modules`, `server/dist`, the generated gitignored `schema.postgresql.prisma` as a primary subject (it is derived from `schema.prisma` and was byte-compared), and live behaviour of any kind — every finding is from reading code.

## Summary

**Verdict:** the codebase is in better shape than its age suggests — no SQL injection surface at all (Prisma is the only DB interface), the migration↔schema column ledger is complete, and the security primitives (bcrypt, CSPRNG, constant-time compares, peppered hashes) are used correctly. The real risk is concentrated in three places: **a set of authorization gaps where one permission grants more than it appears to**, **a dead primary conversion path on the public site**, and **pre-existing schema-vs-migration drift that production's `migrate deploy` will hit**.

Counts: **Critical 1 · High 10 · Medium 26 · Low 33 · Suspected 11** (of which the orchestrator independently verified 1 Critical, 6 High, 1 Medium).

Top risks, one line each:
1. **`C-1`** — the public project page's main "Register Interest" button opens nothing. Every project page's primary conversion is dead on a live site.
2. **`H-7`** — `manageNotifications` alone can silently re-route every customer lead (full PII) to an arbitrary address, with no super-admin guard, while the equivalent escalation on roles *is* guarded.
3. **`H-2`** — 9 of 10 recovery codes are rejected by `/me/totp/disable` and `/me/totp/recovery-codes`, so the documented "lost your phone" path usually fails.
4. **`H-1`** — a suspended account answers 403 *before* the password is checked, making login an enumeration oracle.
5. **`M-1`** — three Arabic `DEFAULT` literals in the init migration are double-encoded mojibake; production's `migrate deploy` stores them.

---

## Findings

### Critical

#### [C-1] The project page's primary "Register Interest" CTA opens nothing — **Verified**

- **Where:** `src/pages/ProjectDetailPage.tsx:75`, `:209`, `:1010`
- **What is wrong:** one `useState` slot means both "is the modal open" and "which unit". `handleOpenInterest(unit?)` sets it to `unit || null`, and the modal is gated on `interestModalUnit !== null`. Called with **no** unit, it sets the state back to `null` and nothing renders.
- **Trigger / evidence:**
  ```tsx
  const [interestModalUnit, setInterestModalUnit] = useState<PropertyUnit | null>(null);  // :75
  ...
  const handleOpenInterest = (unit?: PropertyUnit) => { setInterestModalUnit(unit || null); };  // :209
  ...
  {interestModalUnit !== null && ( ...modal JSX... )}   // :1010
  ```
  `/projects/206` → click "سجل اهتمامك بهذا المشروع" (`:513`, the largest button on the page) or the cinema-modal "Express Interest" (`:996`) → no modal, no toast, no console error. Line `:1025` (`{interestModalUnit ? ... : project.title}`) proves the no-unit case was intended to render.
- **Impact:** the main conversion action on every public project page is dead on a live site. Only a click on a specific unit card can submit.
- **Fix:** separate the two concerns:
  ```tsx
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestModalUnit, setInterestModalUnit] = useState<PropertyUnit | null>(null);
  const handleOpenInterest = (unit?: PropertyUnit) => {
    setInterestModalUnit(unit ?? null);
    setInterestModalOpen(true);
  };
  ```
  and gate the modal on `interestModalOpen`.
- **Verify:** open `/projects/206`, click the primary CTA → the modal must appear; submit → `201` and an inquiry row with `unitId: null`.

---

### High

#### [H-1] A suspended account answers 403 before the password is checked — login enumeration oracle — **Verified**

- **Where:** `server/src/routes/auth.routes.ts:565-573`
- **What is wrong:** the `status === 'suspended'` branch runs **before** `bcrypt.compare`. The `pending` branch correctly sits after it, and the comment at `:580-584` states the intended invariant ("Only reached once the password is proven, so 503/403 here is never an oracle for a wrong password") — the suspended branch violates it.
- **Trigger / evidence:**
  ```ts
  if (user.status === 'suspended') {
    return reply.status(403).send({ error: 'Account is suspended' });   // :565-567
  }
  const isMatch = await bcrypt.compare(password, user.passwordHash);    // :569
  ```
  `POST /api/auth/login {email:"victim@ajdaa.sa", password:"anything"}` → `403 "Account is suspended"`; the same call for an unknown address → `401 "Invalid credentials"`. The failed-attempt counter is not incremented on this path, so it is not bounded by the lockout.
- **Impact:** unauthenticated, scriptable enumeration of which addresses exist *and* are suspended, with no password knowledge.
- **Fix:** move the suspended branch after `bcrypt.compare`, or return the same `401 'Invalid credentials'` and reveal suspension only post-authentication.
- **Verify:** `POST /login` with a known-suspended email and a wrong password → expect 403 today, 401 after.

#### [H-2] 9 of 10 recovery codes are rejected by disable and regenerate — **Verified**

- **Where:** `server/src/routes/auth.routes.ts:1573-1579` (disable), `:1652-1658` (recovery-codes)
- **What is wrong:** both self-service routes do a single `findFirst({ where: { adminUserId, usedAt: null } })` with **no `orderBy`**, and compare the presented code against that one row only. The login path does it correctly by looping over all rows (`:382-392`). The filter does exclude used rows, so it never picks a spent one — the defect is that it never compares the other nine *unused* ones.
- **Trigger / evidence:**
  ```ts
  const recoveryCode = await prisma.recoveryCode.findFirst({          // :1573 / :1652
    where: { adminUserId: user.id, usedAt: null },
  });
  if (recoveryCode && verifyRecoveryCode(recoveryCode.codeHash, normalizedCode)) { ... }
  ```
  Compare with the correct login path:
  ```ts
  for (const rc of user.recoveryCodes) {                              // :382
    if (rc.usedAt === null && verifyRecoveryCode(rc.codeHash, normalizedCode)) { ... }
  }
  ```
  A user who lost their phone prints their 3rd code and submits it → the first unused row doesn't match → `400 "Invalid authenticator app code"`. On PostgreSQL, with no `ORDER BY`, which row comes back is arbitrary and changes as `UPDATE ... SET usedAt` rewrites heap tuples, so the accepted code can change between requests.
- **Impact:** the documented "lost your authenticator" recovery path fails for 9 of 10 codes with a misleading error, driving users to a 10-code pool or an admin reset. Probability of a legitimate user succeeding on the first try is 1/10. **This is in code written for this task** and is the single most user-visible defect in it.
- **Fix:** replace both `findFirst` calls with `findMany({ where: { adminUserId: user.id, usedAt: null } })` and loop `verifyRecoveryCode` over the rows, mirroring `:382`.
- **Verify:** enroll, then `POST /api/auth/me/totp/disable` with `recoveryCodes[3]` and the correct password → expect 200, currently 400.

#### [H-3] `/me/totp/enable` can be called on a live account, silently destroying every saved recovery code — **Verified**

- **Where:** `server/src/routes/auth.routes.ts:1486-1489` (guard), `:1505-1521` (the destructive writes)
- **What is wrong:** the route guards only on `!user.totpSecretEnc` and never on `totpEnabledAt !== null`. Because `enable` leaves `totpSecretEnc` set, a second call on a live account passes the guard, verifies one code against the live secret, then runs `recoveryCode.deleteMany` + `createMany` and writes `totpLastStep: null`. The constant `TOTP_ALREADY_ENABLED_ERROR` exists and `/me/totp/setup` uses it (`:1480`) — `enable` does not.
- **Trigger / evidence:**
  ```ts
  // Must have a pending secret
  if (!user.totpSecretEnc) {                                          // :1487
    return reply.status(400).send({ error: TOTP_SECRET_PENDING_ERROR });
  }
  ```
  `POST /api/auth/me/totp/enable {code}` twice, 30+ seconds apart, with a valid code both times.
- **Impact:** an attacker with a stolen session token plus one live code silently destroys the victim's saved recovery codes (lock-out bait) and clears `totpLastStep`, re-opening the current ±1 window to replay. A legitimate user who re-runs "enable" loses their printed codes mid-life.
- **Fix:** `if (user.totpEnabledAt !== null) return reply.status(409).send({ error: TOTP_ALREADY_ENABLED_ERROR });`
- **Verify:** enable, then call enable again with a fresh code, then `GET /api/auth/me` → `recoveryCodesLeft` is 10 while the previously issued codes fail at login.

#### [H-4] `/verify-email` and `/accept-invite` set `status: 'active'` unconditionally — a suspended account un-suspends itself — **Reported**

- **Where:** `server/src/routes/auth.routes.ts:1040-1043`, `:1219-1222`
- **What is wrong:** both endpoints write `status: 'active'` without checking the current status. A `pending` + `suspended` account still holding a live token can lift its own suspension. The sibling `mark-verified` does it correctly (`:1932`: `status: target.status === 'pending' ? 'active' : target.status`), and a test asserts the suspended case stays suspended — but only for `mark-verified`.
- **Trigger:** admin suspends a pending account → the user opens the emailed link → `200` and `status` becomes `active`.
- **Impact:** suspension bypass, lifting the only "disable" lever that needs no password change, by the suspended user's own action.
- **Fix:** mirror `mark-verified`: `status: user.status === 'pending' ? 'active' : user.status`.
- **Verify:** set a pending account to `suspended`, keep its invite token, `POST /api/auth/accept-invite` → status flips to `active` today.

#### [H-5] The scope-limited enrollment token is accepted by the socket.io handshake — **Reported**

- **Where:** `server/src/sockets/index.ts:15-39` vs `server/src/middleware/auth.ts:21-23`
- **What is wrong:** `resolveAuthenticatedAdmin` calls `fastify.jwt.verify` and only checks the user exists and is `active`. It does not reject a payload carrying `scope: 'totp_enroll'` (the guard `authenticate` applies) and does not check `passwordChangedAt`.
- **Trigger:** with `totpRequiredForAll` on, `POST /login` returns `enrollToken`; use it as `socket.handshake.auth.token` → the socket joins `admins` (and `inquiries` with `viewInquiries`) while `GET /me` with the same token returns 401.
- **Impact:** breaks the documented "a scope-limited token is never a session" invariant; invalidates password-change revocation for realtime traffic. Exposure is limited — same user, 10 minutes, no HTTP routes.
- **Fix:** reject `payload.scope !== undefined` and re-check `passwordChangedAt > iat` in `resolveAuthenticatedAdmin`, ideally by extracting the shared body of `authenticate`.
- **Verify:** connect a socket with an `enrollToken` and assert `admins` is not among its rooms.

#### [H-6] Admin-set password does not revoke sessions and sends no notice — **Reported**

- **Where:** `server/src/routes/auth.routes.ts:2086-2102`
- **What is wrong:** `passwordHash` is written but `passwordChangedAt` is not bumped. `authenticate` (`auth.ts:30-36`) is the only session-revocation mechanism; every other path that sets a password sets the stamp. No `notifyPasswordChanged` mail either.
- **Trigger:** admin does `PUT /api/auth/users/:id {password}` while the target holds a 12h token → the old token keeps working until it expires.
- **Impact:** incident-response gap — a rotation by an admin does not evict an attacker.
- **Fix:** write `passwordChangedAt: new Date()` alongside `passwordHash`, and `void notifyPasswordChanged({...})`.
- **Verify:** reuse the target's token after the rotation → 200 today, 401 after.

#### [H-7] `manageNotifications` alone is a permanent PII-exfiltration primitive — **Verified**

- **Where:** `server/src/routes/notifications.routes.ts:45` (the only guard), `server/src/services/notificationService.ts:43-61`, `server/src/services/notificationListeners.ts`
- **What is wrong:** every listener route is guarded by `requirePermission('manageNotifications')` alone. `inquiryRecipients()` returns the listener-configured addresses (`emailRecipientsFor('inquiry.created')`) and `notifyNewInquiry` sends to **every** one of them via `Promise.all(recipients.map(sendMail))`, with a body carrying the customer's name, phone, email, project, unit and free text. By contrast `roles.routes.ts:89-92, 141-147, 213` **does** require super_admin for escalating permissions.
- **Trigger / evidence:**
  ```ts
  const guards = () => ({ onRequest: [authenticate, requirePermission('manageNotifications')] });  // :45
  ...
  await Promise.all(recipients.map((to) => sendMail({ to, ...content })));   // notificationService.ts:60
  ```
  An admin holding only `manageNotifications` posts a listener with `config.emails: ['me@private.tld']` → every lead is mailed to them, permanently, and `deleteListener` cannot restore the old routing.
- **Impact:** silent, permanent exfiltration of customer PII (Saudi names and phone numbers) to an arbitrary address, plus the ability to silence notifications for everyone else — all with a permission the roles UI hands out freely.
- **Fix:** require super_admin to add/edit a listener that carries explicit `config.emails`, or at minimum to change `inquiry.created` routing; audit-log listener changes.
- **Verify:** as an admin holding only `manageNotifications`, add such a listener, submit a public inquiry, and assert mail arrived at the injected address.

#### [H-8] Every log view synchronously reads the whole file on the request thread — **Verified**

- **Where:** `server/src/services/loggerService.ts:206`, `:261`, `:305`; `server/src/routes/logs.routes.ts`
- **What is wrong:** all three are `fs.readFileSync(path, 'utf-8')` of the entire `prod.log`/`errors.log`, and only then `split('\n').slice(-tailLines)`. The `lines` query param has no zod bound (contrast the JSON endpoint, which caps `limit` at 1000). The I/O cost does not depend on `lines` at all.
- **Trigger:** a super admin opens `/api/logs/view` (which polls every 3 s) with a 100 MB `prod.log` → each poll blocks the whole API, including the public project pages.
- **Impact:** self-inflicted availability incident on the production instance, triggered by the monitoring tool the owner uses precisely when something is wrong.
- **Fix:** read the tail with a byte-range read or a bounded stream (never `readFileSync`), and validate `lines` with `z.coerce.number().int().min(1).max(5000)`.
- **Verify:** a check with a 20 MB log asserting response time and RSS do not scale with file size.

#### [H-9] The public client-error endpoint forges log lines and overrides trusted fields — **Verified**

- **Where:** `server/src/routes/logs.routes.ts:586-592` (schema), `:613-623` (write); `server/src/services/loggerService.ts:141-143` (format)
- **What is wrong:** `message` and `source` are attacker-controlled strings interpolated **raw** into a line-based format. Nothing strips CR/LF or the `] [` pattern. `...context` is spread **last**, so it overrides `ip`, `userAgent` and `url`. The endpoint is public (rate limit only).
- **Trigger / evidence:**
  ```ts
  const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}${...}`;  // :141
  ...
  loggerService.error(`Client error reported: ${message}`, {
    url: reportedPath || refererPath,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    stack,
    ...context,        // :620 — spread LAST, overrides the trusted fields
  }, source);
  ```
  `POST /api/logs/client-error {"message":"x\n[2026-10-25T00:00:00.000Z] [ERROR] [system] Database connection lost\n","context":{"ip":"10.0.0.9"}}` writes a forged ERROR line into `prod.log` **and** `errors.log` with a fake IP.
- **Impact:** polluted forensics exactly when the log is the evidence; the "Errors" counter counts forged entries; a hostile actor can bury the real error a later investigation needs.
- **Fix:** `message.replace(/[\r\n]+/g,' ')`, `source.replace(/[^a-zA-Z0-9_-]/g,'')`, cap both, and put `...context` **before** the trusted fields.
- **Verify:** post a multi-line message and assert one line is written and `context.ip` cannot override `request.ip`.

#### [H-10] The user create wizard and edit dialog silently drop the phone number — **Verified**

- **Where:** `src/types/admin.ts` (`AdminUserInput`), `src/components/admin/users/UserCreateWizard.tsx:237-255`, `src/components/admin/users/UserFormDialog.tsx`
- **What is wrong:** `AdminUserInput` has no `phone` field, so neither payload can carry one. The wizard collects a phone, shows it in the review card, then never sends it; the edit dialog tracks it in `hasChanges` and renders an input but omits it from the payload. The server's `createUserSchema` **does** accept `phone` (`auth.routes.ts:176`), so this is a client-only gap.
- **Trigger / evidence:** the payload object at `UserCreateWizard.tsx:237` contains `name, email, mode, password, role, roleAr, roleId, department, departmentId, permissions, …` — no `phone` key. Create a user with a phone → the row has none, with a success toast.
- **Impact:** silent data loss in both flows, with a success message. The phone is only settable through the profile page.
- **Fix:** add `phone?: string | null` to `AdminUserInput` and send `phone: form.phone.trim() || null` in both payloads.
- **Verify:** create a user with a phone, `GET /users`, confirm it is stored; edit the phone and confirm the `PUT` body carries it.

---

### Medium

#### [M-1] Three Arabic `DEFAULT` literals in the init migration are double-encoded mojibake — **Verified**

- **Where:** `server/prisma/migrations/20260923190412_init/migration.sql` vs `server/prisma/schema.prisma`
- **What is wrong:** the schema declares correct Arabic defaults; the `CREATE TABLE` production executes bakes in different strings — the original UTF-8 bytes decoded through a single-byte code page and re-encoded as UTF-8.
- **Trigger / evidence (hex):**
  | column | schema bytes | migration bytes |
  |---|---|---|
  | `AdminUser.roleAr` | `d985d8b3d8a4d988d984…` = `مسؤول مبيعات` | `e29498c3a0c38fe29482…` = mojibake |
  | `PropertyUnit.statusAr` | `d985d8aad8a7d8ad` = `متاح` | `e29498c3a0c38fc2ac…` = mojibake |
  | `CustomerInquiry.statusAr` | `d8acd8afd98ad8af` = `جديد` | `c38fc2bcc38fc2bbe2…` = mojibake |
  
  A sweep of every `DEFAULT '…'` literal in all 15 migrations found exactly 3 Arabic-bearing literals, and all 3 are mojibake. Every other default (`'{}'`, `'active'`, `false`, `0`, `1`…) matches byte for byte. The file is unmodified since commit `a651f42`, so this is what `migrate deploy` runs forever.
- **Impact:** PostgreSQL stores the garbage as the column default. `roleAr` is returned verbatim by `serializeUser`, so any row created without an explicit value renders as broken Arabic. Latent today — every current create path sets the column explicitly — but it fires on a raw insert, an emergency psql fix, or a future create path that forgets. It will also make the planned `task-w4-postgres-dev` drift gate emit output instead of "no drift".
- **Fix:** a **new** migration (never editing the applied `init`): `ALTER TABLE "AdminUser" ALTER COLUMN "roleAr" SET DEFAULT '<correct Arabic>';` and the two others, committed as UTF-8 and verified by hex dump before committing. Add a CI grep for the mojibake rune class (`U+2500–U+25FF`).
- **Verify:** `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <scratch> --script` → empty; and `SELECT column_default … WHERE table_name='AdminUser' AND column_name='roleAr'` returns `d9 85 …`.

#### [M-2] `updateSectionContent` computes the version outside the transaction — concurrent CMS edits collide — **Reported**

- **Where:** `server/src/services/cmsService.ts:229-246`; `@@unique([sectionKey, version])` at `schema.prisma:280`
- **What is wrong:** `newVersion` is read from `findUnique` **before** `prisma.$transaction` and written inside it. Two concurrent saves both compute `N+1`; the second violates the unique constraint.
- **Trigger:** two editors open CMS → Home and both save within a second → the second gets `P2002`, which `cms.routes.ts:87-90` turns into a 400 containing a raw Prisma dump.
- **Impact:** lost edits on a live site and a schema dump in an admin's face.
- **Fix:** read the version inside the transaction (or use `version: { increment: 1 }`), and catch `P2002` explicitly for a readable 409.
- **Verify:** two concurrent `PUT /api/cms/content/home` with different bodies → one 200, one 409 with a human message.

#### [M-3] The reorder handler indexes a filtered array and swaps the full one — **Verified**

- **Where:** `src/components/admin/cms/CmsClientsPanel.tsx:294-311` (handler), called from `:450`, `:491`, `:499`
- **What is wrong:** `handleMove(index, …)` receives an index into **`filteredClients`** but swaps inside **`clients`**. The bounds check mixes the two lengths.
- **Trigger / evidence:**
  ```tsx
  {filteredClients.map((client, index) => {          // :450 — index is into the FILTERED array
    ...
    onClick={() => handleMove(index, 'up')}          // :491
  ```
  ```ts
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= clients.length) return;   // :297 — bounds from the FULL array
  const copy = [...clients];
  const temp = copy[index]; copy[index] = copy[target]; copy[target] = temp;   // :298-301
  ```
  With 6 partners, search for one matching only #3 and #5, click "move up" on the visible #5 → `copy[1]`/`copy[2]` of the unfiltered array swap, i.e. partners #2 and #3, and `PUT /cms/clients/reorder` persists it.
- **Impact:** silent corruption of the public clients-page order with nothing on screen explaining it.
- **Fix:** resolve the item first (`const item = filteredClients[index]`) and swap by identity in `clients`, or disable the arrows while filtering.
- **Verify:** with a filter active, move one item and confirm the same pair changes as with no filter.

#### [M-4] Contact-page inquiry subjects lose their AR↔EN pairing on save — **Reported**

- **Where:** `src/components/admin/cms/CmsContactPanel.tsx:144-148`
- **What is wrong:** `subjectsAr` and `subjectsEn` are each `.filter(Boolean)`-ed independently, so the arrays stop sharing an index whenever the two columns have a different number of non-empty rows.
- **Trigger:** clear the English text of subject #2 and save → `subjectsAr` keeps 4 entries, `subjectsEn` keeps 3 → the public dropdown pairs the wrong Arabic with the wrong English.
- **Fix:** filter pairs once and map both arrays from the survivors, or reject a half-empty pair.
- **Verify:** clear one EN cell, save, and read back both arrays — equal length.

#### [M-5] Password re-verification on the settings routes has no rate limit and no failed-attempt accounting — **Reported**

- **Where:** `server/src/routes/auth.routes.ts:1414-1417`, `:1448-1451`, `:1553-1556`, `:1620-1623`
- **What is wrong:** all four call `bcrypt.compare` and return 401 without `loginFailureTracker.recordFailure`, and none of the `/me/*` routes carry a `rateLimit` config (`rateLimit` is `global: false`).
- **Trigger:** loop `POST /api/auth/me/totp/setup {currentPassword: guess}` with a valid session — unbounded attempts, never tripping the 5-attempt lockout that protects `/me/password`.
- **Impact:** a stolen session becomes an unlimited password oracle.
- **Fix:** add `recordFailure` (and the lockout guard) to all four, or factor the "current password" check into one shared helper.

#### [M-6] `PATCH /me` changes the account email with no re-verification — **Reported**

- **Where:** `server/src/routes/auth.routes.ts:1251-1265`; `updateProfileSchema:128` accepts `email`
- **What is wrong:** a new address is written while `emailVerifiedAt` keeps its old non-null value, so an unproven address inherits "verified". The password-reset code is then mailed to the attacker-chosen mailbox.
- **Fix:** drop `email` from the schema, or on change set `emailVerifiedAt = null`, `status = 'pending'`, and issue a fresh verification token.

#### [M-7] `loginFailureTracker` and the security-settings cache are per-process and in-memory — **Reported**

- **Where:** `server/src/services/loginFailureService.ts:81`, `server/src/services/securitySettings.ts:26,63`
- **What is wrong:** the lockout bounding password guessing is a `Map` in one process (cleared by restart, not shared), and the settings cache is populated forever by whichever process wrote it. Turning `totpRequiredForAll` off on one instance does not affect another until it restarts.
- **Fix:** document "single instance required", or move both to Redis/the DB with a TTL.

#### [M-8] Case-insensitive search silently degrades to case-sensitive on PostgreSQL — **Reported**

- **Where:** `server/src/routes/newsletter.routes.ts:101`, `server/src/routes/developerNotes.routes.ts:191-194` vs the correct branch at `server/src/routes/careers.routes.ts:304-309`
- **What is wrong:** SQLite's `LIKE` is case-insensitive for ASCII, PostgreSQL's is not. `careers.routes.ts` branches on the datasource URL; these two use bare `contains`.
- **Trigger:** searching `Fahd@Ajdaa.sa` in the admin newsletter search returns the subscriber in dev and 0 rows in production.
- **Fix:** hoist the careers ternary into one helper and use it in all three.
- **Verify:** assert on the *query shape* (`mode: 'insensitive'` present for a non-`file:` URL) — an HTTP assertion would not fail, because SQLite returns the same rows either way.

#### [M-9] `DATABASE_URL`'s dev default is not a production config error — **Reported**

- **Where:** `server/src/config/env.ts:96` vs `:222-253` (`productionConfigErrors`)
- **What is wrong:** a missing `DATABASE_URL` is not flagged. Every other secret that must not be defaulted is enumerated; the variable that decides *which database is written to* is not.
- **Impact:** a production unit whose `.env` lost the line boots green, passes `/api/health`, then fails every query at runtime instead of at boot.
- **Fix:** add a `DATABASE_URL` check requiring a `postgres://`/`postgresql://` URL in production.

#### [M-10] The deploy runbook's migration-safety grep aborts on every foreign key — **Reported**

- **Where:** `deploy/README-deploy.md:556-561`
- **What is wrong:** `grep -nEi 'drop|truncate|delete'` matches `ON DELETE CASCADE`, which 7 of the 15 migrations contain — including the TOTP migration, so it stops the very next production deploy.
- **Impact:** a false positive on a legitimate deploy, or the owner learns to ignore the check — the moment it stops protecting anything.
- **Fix:** anchor the pattern to statements (`\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)\b`, `\bTRUNCATE\b`, `\bDELETE\s+FROM\b`) and state in the runbook that `ON DELETE …` inside a FK clause is expected.
- **Verify:** the new pattern over all 15 migrations → zero matches; and it *does* match a synthetic `DROP TABLE "Project";`.

#### [M-11] The generated production client already contains models the committed migrations do not create — **Reported**

- **Where:** `server/prisma/schema.postgresql.prisma` (working tree) vs `git status` showing `?? server/prisma/migrations/20261024000000_totp/`
- **What is wrong:** `db:gen:prod` regenerates from the working-tree schema, which already has the TOTP columns and `RecoveryCode`, while the migration creating them is untracked. `db:migrate` only applies committed folders.
- **Impact:** if the auth lane merges `schema.prisma` without the migration folder, production gets a client querying tables that do not exist → every TOTP request 500s, possibly passing a health check.
- **Fix:** commit the migration in the same commit as the schema change, and add a script asserting every model resolves to a table in the migration set.

#### [M-12] `GET /api/inquiries` returns every lead, unbounded and unpaginated — **Reported**

- **Where:** `server/src/routes/inquiries.routes.ts:209-214`; client `src/services/inquiryService.ts:101-104`
- **Trigger / impact:** after ~5 000 leads every dashboard open transfers and parses the whole lead table (PII included). `careers.routes.ts:312-320` already has the right pagination shape to copy.

#### [M-13] Mail fan-out retries as a whole, so a partially-sent notification duplicates — **Reported**

- **Where:** `server/src/services/notificationService.ts:60`, `:88`; `server/src/services/queueService.ts:29-34` (`attempts: 3`)
- **What is wrong:** `Promise.all(recipients.map(sendMail))` rejects on the first failure after the others have started; the job re-runs and re-mails everyone. The inline fallback swallows the error, so with Redis down the failure is lost entirely.
- **Fix:** send per recipient (`Promise.allSettled`, fail only if all failed), or one job per recipient.

#### [M-14] New CMS partners silently lose their `order` and `visible` values — **Reported**

- **Where:** `server/src/schemas/cms.schema.ts:309-310` (`.default(0)`/`.default(true)`) vs `server/src/services/cmsService.ts:342-346, 360-361, 385-386`
- **What is wrong:** zod defaults mean `validated.order`/`validated.visible` are never `undefined`, so `?? nextOrder` is dead code — every partner created without an explicit `order` gets `0`, colliding with the others. On update, omitting `visible` re-publishes a hidden partner.
- **Fix:** `.nullish()` instead of `.default()`, and write only the fields actually present on update.

#### [M-15] No unique constraint or duplicate check backs the floor-number rule — **Reported**

- **Where:** `server/prisma/schema.prisma:160-171` (`PropertyFloor` has no `@@unique`); `server/src/routes/projects.routes.ts:465-470, 490-522`
- **What is wrong:** "one floor number per project" is app-level only, the create is check-then-create (racy), and the update accepts a colliding `floorNumber` with no check at all.
- **Fix:** `@@unique([projectId, floorNumber])` in a migration, and forbid or check `floorNumber` on update.

#### [M-16] The public careers endpoint has a hard-coded rate limit and no de-duplication — **Reported**

- **Where:** `server/src/routes/careers.routes.ts:128-142`, `:256-280`
- **What is wrong:** `max: 5` hard-coded rather than the `RATE_LIMIT_*` config, and no per-email cap — each accepted application triggers a real email to the company inbox.
- **Fix:** drive the limit from config, add a per-email cap, and batch notifications.

#### [M-17] `scripts/migrate-developer-notes.ts` deletes production rows non-transactionally and non-idempotently — **Reported**

- **Where:** `server/scripts/migrate-developer-notes.ts:36-70`
- **What is wrong:** copies `CustomerInquiry` rows into `DeveloperNote` then deletes the source one at a time, with no transaction and no idempotency guard. A crash between create and delete means a re-run duplicates the note.
- **Fix:** wrap each pair in a transaction, record provenance on the note, add `--dry-run`.

#### [M-18] Five project permissions in the catalogue are never enforced — **Reported**

- **Where:** `server/src/config/permissions.ts:21-54, 141-160`; no `requirePermission('viewProjects'|'createProject'|… )` anywhere; `server/src/routes/projects.routes.ts:178-180` calls only `authenticate`
- **What is wrong:** `GET /api/projects?scope=admin` exposes drafts and hidden projects to **any** signed-in admin. Granting `viewProjects` does nothing and removing all project permissions does not hide drafts. This is currently *tested as intended* (`test/publish.test.ts:169-180`), so fixing it requires changing that test.
- **Fix:** enforce `viewProjects` on the two admin-scope reads, or remove the five keys from the catalogue and the roles UI.

#### [M-19] Every public project read is a full table scan (no index on any filtered column) — **Reported**

- **Where:** `server/prisma/schema.prisma:116-158` — `Project` has zero secondary indexes while the hot query filters `publishStatus`/`city`/`type`; `CustomerInquiry` likewise has none.
- **Fix:** a new hand-written PG migration adding `@@index([publishStatus])`, `@@index([city])` and `@@index([createdAt])` on `CustomerInquiry`.

#### [M-20] Unguarded `JSON.parse` on settings rows 500s public endpoints — **Reported**

- **Where:** `server/src/services/mailSettings.ts:73`, `server/src/services/siteSettings.ts:94` (contrast `careersSettings.ts:92-104`, which guards)
- **What is wrong:** `GET /api/settings/site` is public and the SPA loads it on public pages. One corrupt `site`/`mail` row → public-page 500 and/or every notification throws.
- **Fix:** try/catch and fall back to the defaults.

#### [M-21] Expired OTP / verification / recovery-code rows are never cleaned up — **Reported**

- **Where:** `server/prisma/schema.prisma:70-114`; no delete of expired rows anywhere in `server/src` or `server/jobs`
- **Impact:** unbounded table growth and indefinite retention of code hashes on a live production database.
- **Fix:** a scheduled job or a lazy opportunistic delete on issue/consume.

#### [M-22] Escape bypasses the "unsaved changes" guard in the user edit dialog — **Reported**

- **Where:** `src/components/admin/users/UserFormDialog.tsx:87-93` (unguarded) + `:411-417` (guarded)
- **What is wrong:** both the wrapper and the child register a `window` keydown listener. React flushes child effects first, so on Escape the guarded handler runs, the visitor clicks **Cancel**, and the parent then closes unconditionally.
- **Fix:** delete the wrapper's listener, or check a `dirty` ref before closing.

#### [M-23] A `manageClients`-only admin lands on the CMS **Home page** editor — **Reported**

- **Where:** `src/pages/admin/sections/CmsSection.tsx:45` (default `activeTab='home'`), `:315` (panel render, ungated)
- **What is wrong:** the panel renders on `activeTab` alone; only the tab list is permission-gated. `CmsHomePanel` then mounts, fetches, and renders its full editor with only the save button disabled.
- **Fix:** derive the rendered panel from the visible tab list, as `SettingsSection.tsx:43` already does.

#### [M-24] The status toggle offers "activate" on a pending account, which the server always rejects — **Reported**

- **Where:** `src/components/admin/users/usersUi.tsx:125-126, 147-169`; server `server/src/routes/auth.routes.ts:2075-2079`
- **Trigger:** Users → a pending row → the green activate icon is enabled → confirm → a toast with the server's error. The dialog in the same module gets this right.

#### [M-25] Password policy mismatch: the client accepts 8 characters, the server requires 10 — **Reported**

- **Where:** `src/components/admin/auth/ResetPasswordStep.tsx:41-44, 90, 112, 140`; `src/components/admin/profile/AdminProfilePage.tsx:133-138, 399, 433, 471`; server `server/src/services/passwordPolicy.ts:13`
- **Trigger:** forgot-password → type `abcdefgh` → the client passes → the server answers 400 with an English policy string in an Arabic UI. `usersModel.ts` already exports the correct `passwordPolicyError()` used by two other flows.

#### [M-26] Clicking the already-selected role card wipes the user's custom permissions — **Reported**

- **Where:** `src/components/admin/users/UserFormDialog.tsx:292-299` (`pickRole`), `RoleCards.tsx:49`
- **What is wrong:** `pickRole` unconditionally replaces `permissions` with the role defaults, and `RoleCards` calls `onSelect` even for the selected card — no "already like this" short-circuit.

#### [M-27] `refreshUser()` resets the profile form while the admin is typing — **Reported**

- **Where:** `src/components/admin/profile/AdminProfilePage.tsx:35-41`; called from `AuthenticatorTotpCard.tsx:130, 162`
- **What is wrong:** the effect re-seeds the form on every `currentUser` identity change, and `getCurrentUser()` returns a fresh object each call — so enabling 2FA in the card below snaps a half-typed name back.
- **Fix:** seed once on mount (or on `currentUser.id` change).

#### [M-28] The home-page map loses the project on "register interest" / "full details" — **Reported**

- **Where:** `src/App.tsx:265-284, 415-450`; `src/components/home/InteractiveProjectsMap.tsx:1131, 1140`
- **What is wrong:** `navigateTo` stores `projectId` in route state but never forwards it and never sets `selectedProperty`.
- **Impact:** every lead from the home page's largest section arrives unattributed.

#### [M-29] The sub-2-second anti-spam check silently discards genuine leads — **Reported**

- **Where:** `src/components/contact/ContactPage.tsx:177-184`; `src/components/booking/InterestRegistrationView.tsx:68-77`; `src/components/common/Footer.tsx:76-82`
- **What is wrong:** `startedAt` is captured at mount, and any submit under 2 s returns the success path *without calling the API*. A visitor who pastes from WhatsApp loses their lead and sees "sent".
- **Fix:** measure from first interaction, and flag suspicious submissions instead of dropping them.

#### [M-30] No per-route SEO metadata at all — **Reported**

- **Where:** `index.html` (no description, canonical, or OG tags); `src/context/LanguageContext.tsx:33-40` (the only `document.title` writes, always the home-page string)
- **Impact:** on a live public real-estate site, no per-project titles for search or link previews, no descriptions, no canonical (duplicate-content risk between `/` and `/projects/206`).

#### [M-31] "Fully Booked" is derived by exact string match on free-text admin fields — **Reported**

- **Where:** `src/data/properties.ts:839-849` (`isPropertyBooked`), consumed by `WorksPage`, `PropertyCard`, `ProjectsSection`
- **Trigger:** an admin writes `محجوز كاملاً` or `Fully booked` (case) → `isBooked` false → the card shows the emerald "available" badge and a "register interest" CTA. A live site mis-advertises availability.
- **Fix:** derive from unit statuses, or add a real enum field; centralize in one tested helper.

---

### Low

Grouped (all **Reported**):

- **L-1** `src/components/admin/users/UserCreateWizard.tsx:254, 517-529` — the super-admin "account status" picker is a dead control: `createUserSchema` has no `status` key, so a deliberately suspended super admin is created **active**. *(Verified that the schema has no `status`.)*
- **L-2** `server/src/routes/auth.routes.ts:1345-1356` — `/me/password` verifies a challenge before checking it belongs to the caller, so presenting another user's live challenge spends it.
- **L-3** `server/src/routes/auth.routes.ts:352` — a device with a fixed 30–45 s-slow clock can be permanently locked out of TOTP login.
- **L-4** `server/src/middleware/auth.ts:83-94` — dead legacy permission mapping: `rolePermissionsToUserPermissions` writes explicit `false` for every unlisted key, so the `!== undefined` guard always matches.
- **L-5** `server/src/routes/auth.routes.ts:1868-1897` — `/users/:id/resend-verification` has no rate limit.
- **L-6** `server/src/services/secretBox.ts:18-21` — AES key is a bare SHA-256 of the passphrase (no KDF); rotating `JWT_SECRET` bricks TOTP for every user.
- **L-7** `server/src/services/loggerService.ts:71-73` — `uncaughtException` logs and continues instead of exiting.
- **L-8** `server/src/services/mailService.ts:130,136` — `console.warn/error` bypasses the logger's ring buffer and log files.
- **L-9** `src/pages/ProjectDetailPage.tsx:47-52`, `src/components/home/InteractiveProjectsMap.tsx:38-43` — an unparseable `videoUrl` yields `<iframe src="">` with no error state.
- **L-10** `src/components/common/ThemeToggle.tsx` — hardcoded Arabic on a bilingual site; `LanguageToggle.tsx:35` has the mirror-image bug.
- **L-11** `src/utils/cmsMedia.ts:26-40` vs `src/services/youtube.ts` — two conflicting YouTube normalisers, the looser one sets first-party cookies and passes through any string containing `youtube.com/embed/`.
- **L-12** `src/data/properties.ts` — the exported `properties` array (~860 lines) is imported nowhere and contains at least one wrong-coordinates project; it cannot be trusted as reference data.
- **L-13** `src/data/saudiCities.ts` has no public consumer.
- **L-14** `src/pages/ProjectDetailPage.tsx:571-593, 746, 769-800` — Arabic-only strings render in English mode even though the DTO carries the English halves.
- **L-15** `src/components/home/ProjectsSection.tsx:158, 176`, `WorksPage.tsx:659` — badge positions use physical `right`/`left` instead of logical `start`/`end`.
- **L-16** `src/components/admin/cms/CmsNavPanel.tsx:310` — the toggle knob uses `after:left-[2px]` + `translate-x-full`, so in RTL it sits on the left and slides right.
- **L-17** `src/components/admin/cms/CmsVersionModal.tsx:115, 157` — hard-codes `'ar-SA'` (which on modern V8 defaults to the Hijri calendar) instead of the dashboard locale.
- **L-18** `src/pages/admin/sections/ApplicationsSection.tsx:172` — the "new" badge counts only the current page while reading as a global count; `:202-207` renders raw English field keys.
- **L-19** `src/pages/admin/sections/CmsSection.tsx:104-105` — revokes the blob URL in the same tick as `a.click()`, which can cancel the download in some browsers.
- **L-20** `src/components/admin/admin/layout/AdminSidebar.tsx:146-150` — the off-screen mobile sidebar stays in the tab order.
- **L-21** `src/components/admin/feedback/AdminFeedbackPet.tsx:280-281, 301` — pasting a second screenshot leaks the previous blob URL.
- **L-22** `src/pages/admin/sections/ProjectsSection.tsx:32-51` — `ProjectImage` never clears its `failed` flag when the URL changes.
- **L-23** `src/pages/admin/sections/ApplicationsSection.tsx:52-73, 254-260` — no `AbortController`, so stale responses can overwrite newer ones; the search never resets the page.
- **L-24** `src/hooks/useAsyncData.ts:40` — builds an `AbortController` and never aborts it; combined with no request cache, the home page issues two identical `GET /api/projects` on first paint.
- **L-25** `src/App.tsx:113-152, 275, 280, 292` — every SPA navigation drops the query string, so `?lang=en` deep links and campaign attribution are lost.
- **L-26** `src/App.tsx:110` — `parsePath` returns `{page:'home'}` for anything unrecognized, so there is no 404 route.
- **L-27** `src/components/contact/ContactPage.tsx:51-57`, `src/pages/ProjectDetailPage.tsx:1047-1101`, `src/components/booking/InterestRegistrationView.tsx:353-434` — form labels are not associated with their inputs (`CareersPage` does it correctly).
- **L-28** `src/components/common/PropertyCard.tsx:61-63`, `home/ProjectsSection.tsx:144-146`, `works/WorksPage.tsx:449-453, 649-650` — whole cards are clickable `<div>`s with no keyboard equivalent.
- **L-29** `src/components/home/ProjectsSection.tsx:44` — `properties.slice(3, 9)` hides a hardcoded slice of the API result; with ≤ 3 projects the whole section is empty.
- **L-30** `src/pages/PastProjectsPage.tsx:162-237` — no dialog semantics, hardcoded Arabic, `load()` has no `AbortController`.
- **L-31** `src/components/admin/users/UserFormDialog.tsx:468` — `accessLocked` disables the whole form's Save, so an admin editing their own name can never save, contradicting the footer copy.
- **L-32** `server/prisma/schema.prisma` — `updatedById`/`createdById` reference no table (audit labels with no FK).
- **L-33** `server/prisma/seed.ts:369-469, 479-489` — the project seed is non-atomic and `resolveSeedPassword`'s policy guard is disabled by a `NODE_ENV` typo.
- **L-34** `server/scripts/sync-data.mjs:63-70` — silently discards everything after the `properties` array, and is a bracketing parser that does not respect string literals.

---

## Suspected issues (need confirmation)

- **S-1** *(Reported)* — `server/src/routes/notifications.routes.ts` / `notificationListeners.ts` — `updateListener` moving an event leaves the old event marked "configured", so `emailRecipientsFor` returns `[]` (notify nobody). The comment says this is intended, but it is easy to misread as a bug.
- **S-2** *(Reported)* — Concurrent `POST /api/projects/:id/floors` duplicate floors: the checked create path is also check-then-act. Not reproduced (no DB access).
- **S-3** *(Reported)* — `CmsClientsPanel`'s `nextOrder` collision in `createCmsClient` (`findFirst({orderBy:{order:'desc'}})` + create) is check-then-act.
- **S-4** *(Reported)* — `migrations/20260929210000_roles_departments` derives `Department.id` with PostgreSQL `md5()` while `seed.ts` derives it in Node; if any production `AdminUser.department` differs by a trailing space or hamza form from the seed's, the upsert finds the row and does **not** update `id`, leaving `AdminUser.departmentId` pointing at a row the seed's table does not have. To confirm: `SELECT id FROM "Department"` vs Node md5 of each `nameAr`, and check every `AdminUser.departmentId` resolves.
- **S-5** *(Reported)* — `Project.id` SERIAL: whether production's sequence is already mid-flight (bug armed) or advanced (no bug). To confirm: `SELECT last_value, is_called FROM "Project_id_seq";` vs `SELECT MAX(id) FROM "Project";`
- **S-6** *(Reported)* — Whether any production `AdminUser` row actually stored a mojibake `roleAr`. Every code path sets it explicitly, so probably not. To confirm: `SELECT encode(convert_to("roleAr",'UTF8'),'hex') FROM "AdminUser";` and look for `e29498…`.
- **S-7** *(Reported)* — `src/services/api.ts:220-239` treats 304 as an error against a server that emits ETags; per Fetch a revalidated 304 is normally rewritten to the stored 200, which would mask this. Needs a real browser to settle.
- **S-8** *(Reported)* — `src/components/common/Reveal.tsx:41` sets `opacity: 0` until an IntersectionObserver fires; if it never fires (print, no observer, reduced-motion path) the content stays blank. Content is in the DOM, so SEO is unaffected.
- **S-9** *(Reported)* — `src/pages/admin/sections/ProjectUnitsPanel.tsx:85, 109-112` opens `floors[0]` while rendering the array reversed, so the default-open floor is the bottom one on screen despite the comment.
- **S-10** *(Reported)* — `ProjectShowSection.tsx:315` renders `<iframe src={project.videoUrl}>` raw (admin-writable, so self-XSS at worst); `:419`/`ProjectEditSection.tsx:746` render `brochureUrl` unvalidated, so a `javascript:` URL would execute on click.
- **S-11** *(Reported)* — `ApiError`/`reportClientError` forwards `window.location.href` (which carries `?token=` on `/admin/verify-email?token=…`) into `errors.log`.

---

## Cross-cutting patterns

1. **The permission model is enforced in one place on the server and faked in three others.** The server's `hasPermission` has alias fallbacks (`manageCms` ⇒ `rollbackCms`, `manageClients`); the client mirrors one alias and not the other; five catalogue keys are enforced by nothing at all; and one permission (`manageNotifications`) grants a capability nobody intended. Root cause: *there is no single source of truth for what a permission means*, so each consumer re-derives it.
2. **SQLite and PostgreSQL disagree in exactly the places nobody tests.** Case-insensitive search, serial sequences after explicit-id seeds, and integer PK defaults are all correct on SQLite and wrong on PostgreSQL — and 100% of the test suite runs on SQLite. This is the same root cause for M-1, M-2 (partially), M-8 and S-5.
3. **Zod `.default()` has been used where `.nullish()` was meant.** `cms.schema.ts:309-310` makes `order` and `visible` never `undefined`, which silently kills the service's fallback. Same shape as a "the default hides the bug" trap.
4. **The client's payload types are narrower than the server's schemas.** `AdminUserInput` is missing `phone`, which the server accepts — a field collected in a wizard and dropped on the floor, with a success message. Worth auditing every `*Input` type against its server schema.
5. **Boundary trust is inconsistent.** The file-upload path is exemplary (magic bytes, UUID names, path prefix checks, traversal tests); the log-ingestion path trusts raw newlines in a public endpoint. The difference is not skill, it is that one surface had a test and the other did not.
6. **Derived state is computed in two places.** `isPropertyBooked`, the YouTube normaliser, the CMS nav suffix list, the AR/EN subject arrays — each has a single wrong assumption that only shows up in the browser. This is the pattern the project has already been bitten by (the i18n raw-key bug).

## Missing tests / checks

- **The client has no test runner at all** — `package.json` has no `test` script and there is no `vitest.config` outside `server/`. The highest-risk pure functions (`parsePath`, `getPathForRoute`, `isPropertyBooked`, `getPropertyDisplay`, `resolveCmsVideo`, `passwordPolicyError`, `normalizePermissions`) are exactly what unit tests would have caught, and a round-trip test would have caught C-1's sentinel mismatch.
- **No test ever executes a committed migration.** `server/test/global-setup.ts:49-51` uses `prisma db push` against a temp SQLite file. All 15 migration files are exercised by exactly one thing: the owner's manual production `prisma migrate deploy`. This is the root cause of M-1 and S-5, and the fix is already specified in `docs/prompts/task-w4-postgres-dev-prompt.md` §4–§5 — written but never run.
- **No drift gate.** The `migrate diff` command that would catch M-1 and M-11 exists in that prompt but is not a gate. It should block a merge, not appear in a report.
- No test for a suspended-account login response (H-1), no test that a pending+suspended account cannot self-activate (H-4), no test that the enrollment token is rejected by a non-HTTP consumer (H-5), no test that an admin-set password revokes sessions (H-6).
- No test submitting a recovery code other than `recoveryCodes[0]` — which is precisely why H-2 passed every gate.
- No CMS, inquiries, units, `loggerService` or `serializers` route tests at all.
- No concurrency test for `updateSectionContent` (M-2) or multi-recipient mail failure (M-13) — the suite is entirely serial.
- No payload-shape test for `UserCreateWizard`/`UserEditTabs` (L-1, M-3), and no browser pass over the 2FA chain or the permission matrix.

## What looks solid

Verified by reading, not assumed:

- **No SQL injection surface.** `grep` for `$queryRaw|$executeRaw|…Unsafe` across `server/` returns nothing — Prisma is the only database interface.
- **The migration↔schema column ledger is complete.** All 20 models, every column, nullability, default, index, unique and foreign key were diffed mechanically against the 15 migrations: **zero columns missing, zero migration-only columns, zero nullability inversions, zero missing indexes.** No `PRAGMA`, `AUTOINCREMENT`, `DROP`, `TRUNCATE`, `ALTER COLUMN TYPE` or `DELETE` in any migration, and every `ADD COLUMN` is nullable or defaulted, so no `NOT NULL`-on-populated-table rewrite. The type mappings are correct PostgreSQL (`SERIAL`, `DOUBLE PRECISION`, `TIMESTAMP(3)`, `TEXT`, `BOOLEAN`).
- **The security primitives are used correctly.** bcrypt for passwords; `crypto.randomBytes`/`randomInt` for tokens, secrets and recovery codes (and the `% 32` bias argument for the recovery alphabet is genuinely correct because 256 is a multiple of 32); SHA-256 + `JWT_SECRET` pepper with no plaintext codes or tokens stored; `crypto.timingSafeEqual` with up-front length guards in every compare path; purpose-scoped challenge hashing so a `login` code cannot be spent on `password_reset`.
- **Challenge consumption is safe.** Single-use email tokens are enforced with an `updateMany … consumedAt: null` guard; `authenticate` re-reads the database on every request and honours status, demotion and `passwordChangedAt`; the `scope`-token rejection in `authenticate` and its inverse in `authenticateTotpEnroll` are both correct and tested.
- **File handling is exemplary.** Magic bytes rather than client MIME, re-encoding to WebP, forced `.pdf` with a UUID prefix, `path.resolve` + prefix check on the CV directory, `%PDF-` sniffing, `Cache-Control: no-store`, and `Content-Disposition: attachment` for PDFs. `careers.test.ts:300` even asserts a traversal `cvPath` returns 404.
- **CSV export** uses a BOM, CRLF, RFC 4180 quoting and leading-`=`/`+`/`-`/`@` formula neutralisation, covered by tests.
- **Error handling at the boundary is right.** Public write endpoints persist before broadcasting or dispatching; `careers` unlinks the CV on failure; the global error handler maps `P2025/P2002/P2003` to 404/409/400 and never echoes a stack. Query strings are stripped from every log line and from 404 bodies.
- **No N+1 anywhere** — every list endpoint issues one `findMany` with the needed `include`, plus a `count` where paginated.
- **Email header injection is not present** — the inquiry subject was traced through nodemailer's Q-encoding, where CR/LF becomes `=0D`/`=0A`.
- **`deploy/remote-deploy.sh` is the strongest file in the layer**: the database name is parsed from `.env` without printing the URL, `unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL` before the guard so a login-shell export cannot spoof it, `_test` suffix enforced, `set -Eeuo pipefail`, rev validation rejecting flag-like and traversal-like refs, `flock` serialisation, staged frontend build with a swap, health-check with code-only rollback, and "Prisma has no rollback" stated in comments rather than assumed away.
- **`env.ts` production hardening is load-bearing** — placeholder-word detection with word-boundary splitting, `blankToUndefined` so `LOGS_SECRET_KEY=` behaves as absent, and constant-time secret comparison with a length check first.
- **The test suite cannot touch a real database by accident.** `isTestEnvironment()` requires the temp-dir prefix on four variables before any query runs, `requireTestEnvironment()` throws rather than falling back, the JWT secret is random per run, and `QUEUE_DRIVER` is pinned to `sync`.
- **The TOTP implementation itself** — the RFC 6238 vectors, the exact ±1 window, the dynamic truncation, the base32 round trip, and the deliberate decision not to burn the first login window at enrollment time were all verified against the code and its tests, and the mutation checks confirmed the tests can actually fail.
- **`translateAdmin` key parity is real**: 750 AR/EN keys across 21 areas diff clean — no key in one language only, no empty value, no placeholder mismatch. Every `t('…')` literal in `src/` resolves to an existing key. The raw-key bug class is fixed for static keys, and the enrollment token is correctly never stored and exempt from the 401 session-clear.

---

*Report written from a whole-project review. Nothing in this repository was modified. Fixes are the owner's call — this document is the input to that decision.*
