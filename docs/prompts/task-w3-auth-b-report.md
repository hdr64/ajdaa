# Task w3-auth-b — authenticator-app 2FA (TOTP) with recovery codes

Worktree `D:\projects\html\ajda-wt\auth` (branch `lane/auth`). No commits made.

## Dependency added

`qrcode@^1.5.4` + `@types/qrcode@^1.5.6` in the **root** `package.json` only. `server/package.json` untouched (verified with `git diff --numstat server/package.json` → no output). Nothing else installed.

## Migration

`server/prisma/migrations/20261024000000_totp/migration.sql` — one hand-written file, `20261022100000_email_verification` style, CRLF, no BOM:

- `AdminUser.totpSecretEnc` (TEXT, nullable — the AES-256-GCM box from `secretBox`),
- `AdminUser.totpEnabledAt` (TIMESTAMP(3), nullable — `null` means the secret is only *pending*, not yet a live second factor),
- `AdminUser.totpLastStep` (INTEGER — RFC 6238 step of the last accepted code, replay guard),
- `RecoveryCode` table (`id`, `adminUserId`, `codeHash`, `usedAt`, `createdAt`) with an index on `adminUserId` and `ON DELETE CASCADE` to `AdminUser`.

`server/prisma/dev.db` was never read or written. Dev/tests keep `prisma db push` on SQLite.

## Files changed

**Server**

| File | Change |
|---|---|
| `src/services/totpService.ts` | **new.** RFC 6238 on `node:crypto` only — own base32, no library. `generateTotpSecret` (20 bytes → 32 base32 chars), `decodeBase32`, `totpCodeAt`, `verifyTotp` (SHA1/6/30s, ±1 step, `timingSafeEqual`, `null` on non-6-digit input), `buildOtpAuthUri`, `formatSecretForDisplay`, `generateRecoveryCodes` (10 × `XXXXX-XXXXX`), `hashRecoveryCode` (peppered SHA-256), `verifyRecoveryCode` (constant-time). |
| `src/services/otpService.ts` | `OTP_PURPOSES` gains `login_totp`; login challenges are code-less. |
| `src/routes/auth.routes.ts` | TOTP branches in `/login`; `/login/verify-totp`, `/login/enroll-totp/setup`, `/login/enroll-totp/verify`, `/me/totp/setup\|enable\|disable\|recovery-codes`, `/users/:id/reset-totp`; `serializeUser` gains `totpEnabled`/`recoveryCodesLeft`; `/me` counts unused codes; `sendTotpNoticeMail` helper. |
| `src/middleware/auth.ts` | `authenticate` rejects **any** token carrying `scope`; new `authenticateTotpEnroll`. |
| `src/services/securitySettings.ts` | `totpRequiredForAll` in interface/DEFAULTS/get/merge-save/`toSecurityView` (+`totpForcedByEnv`) + helper. `saveSecuritySettings` now takes `Partial<SecuritySettings>` and merges. |
| `src/services/mailTemplates.ts` | `MailKind` gains `totp-enabled`/`totp-disabled`/`totp-reset`; one `totpNoticeEmail({event, actorEmail})` template for all three events. |
| `src/types/fastify.d.ts` | `JwtPayload.role` optional; `scope?: 'totp_enroll'`. |
| `src/routes/settings.routes.ts` | `PUT /settings/security` fields optional + `refine` requiring at least one. |
| `prisma/schema.prisma`, `prisma/migrations/20261024000000_totp/` | new columns + model, migration. |
| `test/totpService.test.ts` | **new**, 25 tests. |
| `test/totp-auth.test.ts` | **new**, 17 tests. |
| `test/security-settings.test.ts` | expected `/settings/security` view widened to 4 fields (was 2). |

**Client**

| File | Change |
|---|---|
| `services/api.ts` | `RequestOptions.authToken` — one-off bearer (the enrollment token), never persisted, and a 401 from it does not clear the session. |
| `services/authService.ts` | `LoginTotpResult` + `LoginTotpEnrollResult`; `verifyLoginTotp`, `enrollTotpSetup`, `enrollTotpVerify`, `totpSetup`, `totpEnable`, `totpDisable`, `regenerateRecoveryCodes`, `resetUserTotp`; `totpEnabled`/`recoveryCodesLeft` on the DTO. |
| `services/adminStorage.ts`, `services/settingsService.ts`, `types/admin.ts` | proxies + `totpRequiredForAll`/`totpForcedByEnv` + object-shaped `update`. |
| `components/admin/auth/LoginTotpStep.tsx`, `EnrollTotpStep.tsx` | **new** login steps. |
| `components/admin/common/TotpQrCode.tsx` | **new** shared QR renderer. |
| `components/admin/profile/AuthenticatorTotpCard.tsx` | **new** 3-step dialog (password → QR/secret → recovery codes with copy + `.txt` download + a required "saved them" checkbox), plus regenerate and disable dialogs. |
| `pages/admin/AdminLoginPage.tsx` | `totp`/`enrollTotp` steps via a shared `advanceLogin` helper. |
| `components/admin/profile/AdminProfilePage.tsx`, `components/admin/settings/SecurityPanel.tsx` | mount the card; two switch cards share one `SwitchCard`. |
| `users/*`, `UsersPermissionsManager.tsx` | `TotpChip`, reset-2FA action, `canResetTotp` right. |

**Docs**: `README.md` endpoint table (8 new rows), `docs/api-reference.md` (4 endpoint sections).

## Gates

| Command | Result |
|---|---|
| `npm run lint` | **pass**, no warnings |
| `npm run build` | **pass** |
| `npm --prefix server run build` | **pass** |
| `npm --prefix server test` | **pass — 38 files, 376 tests** |

## Browser / smoke verification

Servers: API on `:4015`, web on `:5185`, a scratch SQLite DB (`prisma db push` + `db:seed`), servers run with config passed as shell variables — **no `.env` file was written at any point**. TOTP codes were generated in throwaway node scripts from the real `server/src/services/totpService.ts`. Both servers stopped and the scratch folder + DBs + scripts deleted; ports 4011/5191 untouched.

**Verified in the browser/over HTTP (33/33 checks)** — login before enrollment → setup returns the secret + `otpauth://` URI (SHA1/6/30) once → wrong code rejected → live code enables and returns 10 `XXXXX-XXXXX` codes → `/me` reports `totpEnabled` + `recoveryCodesLeft: 10` → login now answers `totpRequired` with no token and **no email is sent** (TOTP replaces the emailed code) → wrong code 400 → right code issues a session → replaying the same code on a fresh challenge 410 → recovery code accepted once, second use 400, count drops 9 → the `login_otp` challenge is not accepted by `verify-totp` (410) → a session token cannot reach the enrollment endpoints (401) → global switch on: an enrolled admin still needs a code, a **non-enrolled admin is forced to enroll** → enroll setup/verify issue a session + 10 codes, and the enrollment token is refused as a session afterwards → switch off → disable → password-only login restored.

**Verified in the browser/over HTTP (12/12 checks)** — the admin reset flow: a *different* admin clears another admin's TOTP (200), the target's `totpEnabled` goes false with 0 codes left, password-only login works again, a second reset is refused (400), and an admin holding `manageUsers` reaches the handler (refused on state, not permission).

**Client compile verified over HTTP**: `AdminLoginPage.tsx`, `LoginTotpStep.tsx`, `EnrollTotpStep.tsx`, `TotpQrCode.tsx` and `AuthenticatorTotpCard.tsx` all returned 200 with transformed JS through Vite.

## Decisions

- **No server library for TOTP.** Short algorithm, auditable, no supply-chain surface. `qrcode` is client-side only (rendering a data URL in the browser).
- **Login challenge reuses `otpService.issueChallenge(user.id,'login_totp')`** rather than a bespoke challenge row. The generated code is discarded — the codeHash is the peppered hash of 32 random bytes nobody receives — so the challenge cannot be verified without a real TOTP/recovery code, while the TTL, per-challenge attempt cap and superseding behaviour come for free.
- **`totpLastStep` is `null` on enable/enrollment.** The setup code only proves the secret; burning the first login window would lock the admin out for up to 30 s. Replay tracking starts at the first real login.
- **Enrollment token is a 10-minute JWT with `scope:'totp_enroll'`.** `authenticate` refuses *any* token carrying `scope`, so the token is a dead end everywhere except `/login/enroll-totp/*`. `challengeId` is a UUID `OtpChallenge` row, never a JWT, and never accepted by `authenticate`.
- **`totpRequiredForAll` merges instead of overwriting.** `saveSecuritySettings` takes a `Partial` and merges, so a client that predates the second switch cannot silently reset it. `PUT /settings/security` fields are optional with a `refine`.
- **Super admins are not exempt** from the switch. A non-super-admin may still disable their own TOTP only when the switch is off — a super admin may always opt out.
- **Password reset/change does not touch TOTP.** Losing a phone is the admin reset-totp action's job.
- **`SwitchCard` takes a `policy` descriptor** (value + forcing env var) rather than 6 near-identical props.
- Three files (`VerifyEmailCodeStep.tsx`, `AcceptInvitePage.tsx`, `VerifyEmailPage.tsx`) show as `M` in `git status` because a line-ending normalisation pass touched them. `git ls-files --eol` shows `i/lf w/crlf` for them — the same state as the files I authored — and `git add` normalises CRLF→LF under `core.autocrlf=true`, so the committed content is unchanged. Flagging it because the constraint said never to rewrite a whole file just to change line endings.

## Verified against PostgreSQL (added after review)

A scratch database (`ajda_totp_mig`, plus `ajda_totp_shadow` as a shadow DB) was created on the local PostgreSQL 18.4 server, exercised, and dropped. The owner's databases were not touched.

1. **The migration applies cleanly.** `prisma db execute --file 20261024000000_totp/migration.sql` succeeded with no error on PostgreSQL.
2. **The result is exactly the expected schema.** After applying the migration, `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.postgresql.prisma --script` produced an **empty diff** — the live database matches the schema the client is generated from, byte for byte in structure.
3. **It is what Prisma itself would generate.** Replaying the whole migration directory on Postgres with and without the TOTP migration proves this: without it, Prisma emits `ADD COLUMN "totpSecretEnc" TEXT`, `ADD COLUMN "totpEnabledAt" TIMESTAMP(3)`, `ADD COLUMN "totpLastStep" INTEGER` and `CREATE TABLE "RecoveryCode"` with `CREATE INDEX "RecoveryCode_adminUserId_idx"` and `ADD CONSTRAINT "RecoveryCode_adminUserId_fkey" ... ON DELETE CASCADE ON UPDATE CASCADE` — identical names, types and referential action to the hand-written file. With it, none of those statements are emitted.
4. **The new columns hold real data.** Through a client generated from the postgres schema: an `AdminUser` row stored `totpSecretEnc`/`totpEnabledAt`/`totpLastStep` and read them back intact; a secret read **back from Postgres** still verified a live code produced by `verifyTotp`; ten `RecoveryCode` rows were created, one spent via the same query shape the service uses (`findFirst({ usedAt: null })` + `update({ usedAt })`), the peppered hash verified against the code that produced it, a spent code no longer matched an unused hash, and deleting the admin cascaded to zero remaining `RecoveryCode` rows.
5. **Scratch databases dropped and verified absent.** After the teardown, `psql -U postgres -l` (a client-independent check) listed `ajda-bacub, ajda_prod_restore, l2, l2_adm_b, l2_adm_t, l2_life1, l3, l4, postgres, weghetk_review` — the owner's 10 databases, with **no `ajda_totp_*` remaining**.

The 5 non-TOTP diffs that `migrate diff` reports for the whole directory (`roleAr`/`statusAr` Arabic defaults, `updatedAt DROP DEFAULT`) are **pre-existing drift unrelated to this task** — they appear identically whether or not the TOTP migration is present.

## Not verified

- **The test suite has not been run against PostgreSQL.** `server/test/env.ts` hard-codes a `file:` `DATABASE_URL` under a temp directory (`ajda-server-test-`) and refuses to run otherwise, so the suite is SQLite-bound by design. Changing that is test-infrastructure work outside this task.
- **The migration has not been run by `prisma migrate deploy`** (no `_prisma_migrations` table was created); the SQL was applied directly with `prisma db execute`. See the pre-existing drift above for why a full-directory deploy would not be a clean check.
- **The `manageUsers` 403 refusal for `reset-totp` in the browser.** The only second seeded admin holds `manageUsers`, and a freshly created admin is `pending` (403 `EMAIL_NOT_VERIFIED`, cannot sign in), so the guard is not reachable in this smoke pair. It is covered in-process by `test/totp-auth.test.ts` (throwaway viewer + super-admin target), which does pass.
- **The `.txt` download button and the clipboard copy** were code-reviewed and type-checked but never clicked in a real browser session.
- **`loginOtpRequiredForAll` / `totpRequiredForAll` set via a real `.env`.** The `*_forcedByEnv` branch is asserted `false` in tests; no smoke run set the variable.
- **No real authenticator app** was involved — every code came from this service's own `totpCodeAt`, so app-side interop (scannability of the QR, issuer display) is unverified beyond the `otpauth://` parameter set.
- **No commits, no merge, no PR.**

## Guard results

### clean-code-guard (guard-pass mode over the whole diff)

Checked: all 28 changed + 8 new files, imperatives 1–24.

**Found and fixed**

1. `src/components/admin/profile/AuthenticatorTotpCard.tsx` — `open(kind, initialStep)` carried a parameter no caller ever supplied (rule 14, speculative parameter). Removed; `open` now only takes the kind.
2. `src/components/admin/profile/AuthenticatorTotpCard.tsx` — `dialogTitle` was a three-level nested ternary. Replaced with a `DIALOG_TITLES` lookup keyed by dialog kind, so a new kind adds a row instead of another branch (rule 8).
3. `src/components/admin/profile/AuthenticatorTotpCard.tsx` — added a `text(ar, en)` helper and used it in `submitPassword`, `submitCode`, `finishCodes`, removing three repeated `isAr ?…:…` chains (rules 2, 12); `finishCodes`'s nested ternary collapsed to one `text()` call.
4. `src/components/admin/settings/SecurityPanel.tsx` — `SwitchCard` took 12 props, 6 of them identical at both call sites (`statusOn`, `statusOff`, `saving`, plus derivable `effective`/`forcedByEnv`). Replaced with a `policy: { value, forcedByEnv }` descriptor; the component now derives `effective` itself (rules 3, 12).
5. `server/src/routes/auth.routes.ts` — two error constants (`TOTP_CODE_REUSED_ERROR`, `RECOVERY_CODE_INVALID_ERROR`) were declared but unused (rule 21). Removed. `RECOVERY_CODE_USED_ERROR` was **kept** — it is used at the recovery-code path.

**Checked and deliberately left**

- `DIALOG_TITLES` is declared inside the component body (recreated each render). Moved out would be marginally cleaner, but it depends on nothing from the closure and the file's other constants follow the same in-body pattern; matching neighbour style (rule 6) wins.
- Single-level `{isAr ? ar : en}` ternaries remain (26 occurrences). `AdminProfilePage.tsx` has 39 and `ConfirmChoicesCard.tsx` has 7, so this is the established convention, not a new pattern.
- Every `catch` block either returns an explicit HTTP status (400/401/503) or logs-and-swallows for a deliberately best-effort mail send, with the reason stated in the doc comment. No silent `catch {}` that hides a failure (rule 15).
- All server `totpService` exports and all new client service methods have real callers (verified by counting references across `src`/`server/src`/`server/test`).

Two process mistakes worth recording: a `Set-Content`-based line splice in `AuthenticatorTotpCard.tsx` silently dropped the `return (` line, which lint caught as `Unexpected token`; and a scratch `.env` was written before the "never read or write `.env*`" rule was applied, then deleted. Both were fixed, and the final `npm run lint` is clean.

### test-guard

Checked: both new files (42 tests), rules 1–9.

**No violations found.**

- **Zero mocks** anywhere (verified by grepping `vi.mock|jest.mock|vi.spyOn|vi.fn` → 0 hits). Tests run real HTTP through the Fastify injector against a real throwaway SQLite DB, so no internal seam is hidden (rules 1, 2, 8).
- **Rule 3**: the six RFC 6238 vectors are one `it.each` table, not six near-identical tests.
- **Rule 4**: every test names a bug it catches that no other test catches — e.g. `verifyTotp` returning `null` instead of throwing on non-6-digit input (the `timingSafeEqual` length hazard), `verifyRecoveryCode` returning `false` rather than throwing on a malformed stored hash, and the exact ±1 window boundary.
- **Rule 5**: names read as scenarios (`accepts the current code and reports the matched step`, `refuses to replay a code that was already accepted`).
- **Rule 6**: no production test was weakened. The only change to an existing test is a *widening* of the `/settings/security` exact-shape assertion from 2 to 4 fields.
- **Rule 9**: persistence is the subject of several tests, so they run against a real DB with `db push` applied.

**Mutation testing (confirming the tests can actually fail)**

| Mutation | Result |
|---|---|
| `WINDOW_STEPS = 1` → `0` | 2 tests fail (`accepts the previous step`, `accepts the next step`) |
| `RECOVERY_ALPHABET` → digits only | 1 test fails (recovery-code format + ambiguity) |
| replay guard `<=` → `<` in `verifyLoginTotpChallenge` | 1 test fails (`refuses to replay a code that was already accepted`) |

All mutations were reverted and the baseline re-confirmed at 25 + 17 passing.

### docs-guard

Checked: every claim I added to `README.md` and `docs/api-reference.md` against the source.

**Every claim verified by reading the route table**, not recalled: the 8 new endpoint paths and HTTP methods were cross-checked against `server/src/routes/auth.routes.ts` (`POST /login/verify-totp`, `POST /login/enroll-totp/setup`, `POST /login/enroll-totp/verify`, `POST /me/totp/setup|enable|disable|recovery-codes`, `POST /users/:id/reset-totp`), the auth guards (`authenticateTotpEnroll` on both enrollment endpoints, `authenticate + requirePermission('manageUsers')` on reset-totp), and the response fields were read from the source: `otpauthUri`/`secret` from the setup handler, `totpEnabled`/`recoveryCodesLeft` from `serializeUser`, `recoveryCodes` from the verify handler.

**No new env var was introduced** — I checked `server/src/config/env.ts` for `TOTP` and found only the pre-existing rate-limit keys, so the README env table was correctly left alone rather than given an invented row.

**No code samples** were added, so Rule 2 did not apply. No unverifiable performance or compatibility claims (Rule 4). No filler or signature-paraphrasing docstrings (Rule 7).

**Flagged, not fixed**: the `docs/archive/original-refactor.md` and `docs/prompts/_archive/**` files still describe only the emailed-code flow. They are archived records of past tasks, so I did not rewrite history; the live docs (`README.md`, `docs/api-reference.md`) are now current.

**PostgreSQL verification pass (after review)**: re-checked every documented claim about the migration against a real PostgreSQL 18.4 instance rather than the schema alone — column types (`TEXT`/`TIMESTAMP(3)`/`INTEGER`), the index name, the FK constraint name and its `ON DELETE CASCADE ON UPDATE CASCADE` action were each compared against what Prisma emits for the same change (see the PostgreSQL section above). The report's "Not verified" list was corrected accordingly: PostgreSQL is now verified, and what remains unverified is stated explicitly.
