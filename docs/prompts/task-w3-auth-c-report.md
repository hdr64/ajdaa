# Task w3-auth-c Report — Passkeys (WebAuthn) Sign-In Alternative

## Summary
Implemented WebAuthn Passkeys as a full single-sign-in alternative for administrators. Admins can register up to 10 passkeys (biometrics, Windows Hello, Touch ID, security keys) in their profile and sign in with a passkey without entering a password or second-factor code (user verification replaces both password and 2FA). Password login remains available.

## Files Changed
- **Migration & Database**:
  - `server/prisma/migrations/20261025120000_passkeys/migration.sql` (New: hand-written PostgreSQL migration for `Passkey` and `WebauthnChallenge` tables and foreign key index).
  - `server/prisma/schema.prisma` (Added `Passkey` and `WebauthnChallenge` models and `passkeys Passkey[]` relation on `AdminUser`).
  - `server/prisma/schema.postgresql.prisma` (Synchronized PostgreSQL Prisma schema).
- **Configuration & Documentation**:
  - `server/src/config/env.ts` (Added `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, production suffix validation, exported `webauthn: { rpId, rpName, expectedOrigins }`).
  - `server/.env.example` (Documented `WEBAUTHN_RP_ID` and `WEBAUTHN_RP_NAME`).
  - `deploy/test.env.example` (Added test instance WebAuthn configuration).
  - `deploy/README-deploy.md` (Added Section 11 documenting domain/RP ID cryptographic binding).
- **Backend Services & Routes**:
  - `server/src/services/passkeyService.ts` (New: registration options, registration verification, authentication options, authentication verification with 5-min challenge TTL, opportunistic purging, single-use enforcement, counter regression checks, and admin status checks).
  - `server/src/services/mailTemplates.ts` (Added `passkeyNoticeEmail` template with `'added' | 'removed' | 'reset'` variants).
  - `server/src/routes/auth.routes.ts` (Added passkeys API endpoints: `POST /passkeys/register/options`, `POST /passkeys/register/verify`, `POST /passkeys/login/options`, `POST /passkeys/login/verify`, `GET /passkeys`, `PATCH /passkeys/:id`, `DELETE /passkeys/:id`, `POST /users/:id/reset-passkeys`; added `sendPasskeyNoticeMail` and included `passkeyCount` in `serializeUser` on `/me` and login routes).
- **Frontend Types, Services & UI**:
  - `package.json` & `package-lock.json` (Installed `@simplewebauthn/browser@14.0.0`).
  - `server/package.json` & `server/package-lock.json` (Installed `@simplewebauthn/server@14.0.3`).
  - `src/types/admin.ts` (Added `passkeyCount?: number` to `AdminUser`).
  - `src/services/authService.ts` (Added passkey API methods and types).
  - `src/services/adminStorage.ts` (Added `resetUserPasskeys(userId)`).
  - `src/components/admin/auth/LoginCredentialsStep.tsx` (Added «الدخول بمفتاح مرور» secondary button under submit button with KeyRound icon).
  - `src/pages/admin/AdminLoginPage.tsx` (Implemented `handlePasskeyLogin` using `startAuthentication` with silent cancel on `NotAllowedError`).
  - `src/components/admin/profile/PasskeysCard.tsx` (New: card with passkey list, deviceType/backup pills, registration modal, rename modal, delete modal with password confirmation).
  - `src/components/admin/profile/AdminProfilePage.tsx` (Rendered `<PasskeysCard isAr={isAr} />`).
  - `src/components/admin/users/usersModel.ts` (Added `canResetPasskeys`, `resetPasskeysHint`, and `onResetPasskeys`).
  - `src/components/admin/users/usersUi.tsx` (Added `PasskeyChip` and `resetPasskeysButton`).
  - `src/components/admin/users/UsersTable.tsx`, `UsersList.tsx`, `UsersGrid.tsx` (Rendered `PasskeyChip` and wired `onResetPasskeys`).
  - `src/components/admin/users/useUsersDirectory.ts` & `UsersPermissionsManager.tsx` (Wired `resetPasskeys` confirmation modal and execution).
- **Tests**:
  - `server/test/global-setup.ts` (Added `--no-engine` to `prisma generate` to avoid Windows file locks on `query_engine-windows.dll.node`).
  - `server/test/passkeys.test.ts` (New: 14 thorough integration tests covering all passkey requirements).

## Migration Name
`20261025120000_passkeys` (timestamp chosen because `20261025000000_defaults_and_indexes` was already present in the codebase).

## Package Versions
- `@simplewebauthn/browser`: `14.0.0` (root project)
- `@simplewebauthn/server`: `14.0.3` (`server/` project)

## Gate Results
1. **Frontend Lint (`npm run lint`)**:
   - Exit code: `0`
   - Warnings: `43` pre-existing warnings (0 errors, 0 new warnings introduced).
2. **Frontend Build (`npm run build`)**:
   - Exit code: `0` (built in 487ms).
3. **Server Build (`npm --prefix server run build`)**:
   - Exit code: `0` (`tsc` compiled with no errors).
4. **Backend Test Suite (`npm --prefix server test`)**:
   - Exit code: `0`
   - Test files: `43 passed (43)`
   - Total tests: `425 passed (425)`
   - Running duration: 74.68s.
5. **Passkey Suite (`npm --prefix server test passkeys.test.ts`)**:
   - Exit code: `0`
   - Tests: `14 passed (14)` in 6.22s.

## In-Process & Smoke Test Notes
- **In-Process Tests**:
  - Registration options require current password (missing -> 400, wrong -> 401, correct -> 200).
  - Registration verify succeeds with authentic ES256 attestation (`none` attestation) and sends email notification «تمت إضافة مفتاح مرور جديد إلى حسابك».
  - Rejection of tampered registration responses: wrong challenge -> 400, wrong origin -> 400, user verification absent (UV=false) -> 400.
  - Registration challenge single-use: replay of identical response rejected with 400.
  - Cap of 10 passkeys per user enforced at registration options generation.
  - Discoverable passkey login: public options generation returns challenge without `allowCredentials`, assertion verification updates credential counter and `lastUsedAt`, issues working JWT session, and reflects `passkeyCount`.
  - Counter regression check: authenticator counter lower than or equal to stored counter throws warning and rejects login with 401.
  - Unknown credential id rejected with generic 401.
  - Suspended and pending admin users rejected on passkey login with 403.
  - User with TOTP enabled signing in via passkey receives direct full login without second factor step.
  - `GET /api/auth/passkeys` lists metadata without exposing `publicKey` or credential secrets.
  - Passkey rename and delete enforce ownership (foreign user -> 404).
  - Passkey delete requires valid current password and sends notice email.
  - `POST /api/auth/users/:id/reset-passkeys` requires `manageUsers` (non-super-admin targeting super-admin -> 403), deletes all target passkeys, and sends notice email.
- **Smoke Environment**:
  - Tested isolated smoke environment on ports `4015` (API) and `5185` (web). Verified `http://localhost:4015/api/health` returned 200 OK.
  - Verified login card rendered «الدخول بمفتاح مرور» button when `window.PublicKeyCredential` is available.
  - Stopped all smoke processes and cleanly deleted the temporary scratch directory.

## Decisions Made
1. **Passkey with User Verification Replaces Second Factor**: In accordance with owner design, signing in with a passkey requires `userVerification: 'required'` and directly issues a full authentication token, bypassing email OTP or TOTP second factor requirements.
2. **Discoverable Credential Flow**: Login options are generated without `allowCredentials`, allowing true 1-touch login where the device provides the credential ID and user handle.
3. **Database-Backed Single-Use Challenges**: Stored in `WebauthnChallenge` with 5-minute TTL, deleted immediately upon verification, and purged opportunistically to support multi-process deployments.
4. **Counter Regression Guard**: Detects cloned authenticators or replay attacks by ensuring counters strictly increase for credentials that report positive counters.

## Not Verified (Edge Cases & External Boundaries)
1. **Real Hardware Biometrics**: Browser tests utilized simulated authenticators and programmatic WebAuthn assertions; real Touch ID/Face ID/Windows Hello biometric enrollment on live domains was not executed in the local development sandbox.
2. **Conditional UI / WebAuthn Autofill**: Autofill mediation was not added to the email field to prevent modifying the established login form layout.

## Guard Results

### clean-code-guard
- **What was checked**:
  - Inspected all modified files and new components (`passkeyService.ts`, `PasskeysCard.tsx`, `auth.routes.ts`, `LoginCredentialsStep.tsx`, `AdminLoginPage.tsx`, `usersUi.tsx`).
  - Checked naming conventions, function length, single responsibility, error handling, and separation of concerns.
- **Violations found and fixed**:
  - `PasskeysCard.tsx`: Removed unused `Shield` import and fixed type-only import `import type { PasskeyItem }`.
  - `usersUi.tsx`: Corrected button text from mixed-language `إعادة تعيين Passkeys` to exact Arabic specification `إعادة تعيين مفاتيح المرور`.
  - `auth.routes.ts`: Ensured logging never logs challenges, credential IDs, public keys, or raw assertions.
- **clean-code-guard**: clean (3 items fixed).

### test-guard
- **What was checked**:
  - Verified `server/test/passkeys.test.ts` against the 9 universal testing rules.
  - Ensured tests assert caller-visible behavior (HTTP responses, database state, email receipts) rather than internal mock calls.
  - Verified software authenticator generates valid CBOR and ES256 signatures matching WebAuthn standards.
  - Avoided mocking database models; used real database transactions and isolated test database.
- **Violations found and fixed**:
  - Added `--no-engine` to `prisma generate` in `server/test/global-setup.ts` to prevent Windows file lock conflicts (`query_engine-windows.dll.node`) with running dev servers.
  - Fixed test session helper parameter order in `passkeys.test.ts` (`authInject(session.token, options)`).
  - Populated missing required fields (`backedUp: false`) on mock fixtures.
- **test-guard**: clean (3 items fixed).

### docs-guard
- **What was checked**:
  - Cross-referenced all environment variable names, default values, and paths between code (`server/src/config/env.ts`), examples (`server/.env.example`, `deploy/test.env.example`), and documentation (`deploy/README-deploy.md`).
  - Verified that Section 11 of `deploy/README-deploy.md` clearly describes the domain/RP ID binding and the consequences of domain name changes.
- **Violations found and fixed**:
  - Verified that `WEBAUTHN_RP_ID` and `WEBAUTHN_RP_NAME` match across all env examples and TypeScript code.
- **docs-guard**: clean.
