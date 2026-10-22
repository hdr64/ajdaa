# Task w3-auth-c — passkeys (WebAuthn) as a full sign-in alternative

Part 3 of 3. Run only after task B is reviewed and committed on `lane/auth`.

## Where
Worktree `D:\projects\html\ajda-wt\auth`, branch `lane/auth`. No commits.

## Goal
Admins can register passkeys (fingerprint, Face ID, Windows Hello, phone, or a hardware key) in their profile and then sign in with a passkey **instead of** password + code. Owner decision: a passkey with user verification is the whole login (it replaces the password and the second factor). Password login stays available.

## Read first
`docs/MASTER-PLAN.md`, `task-w3-auth-a-report.md`, `task-w3-auth-b-report.md`, `server/src/routes/auth.routes.ts` (login flow, `serializeUser`), `server/src/config/env.ts` (`CLIENT_ORIGIN`, `APP_URL`, how origins are parsed), `server/src/services/loginFailureService.ts`, `server/prisma/schema.prisma`, `src/pages/admin/AdminLoginPage.tsx`, `src/components/admin/auth/*`, `src/components/admin/profile/AdminProfilePage.tsx`, `src/services/authService.ts`, `src/services/api.ts`.

## Design (decided)
**Libraries.** You may install exactly these, nothing else: `@simplewebauthn/server` in `server/` and `@simplewebauthn/browser` in the ROOT project (use the current stable majors that are compatible with Node/TypeScript here; note the versions in the report). Do not hand-roll CBOR/attestation parsing.

**Relying party config** (`server/src/config/env.ts`, validated, documented in `server/.env.example` and `deploy/*.env.example`): `WEBAUTHN_RP_ID` (optional; default = hostname of `APP_URL`, e.g. `localhost` in dev, `ajdaa.sa` in prod, `test-ajda.weghetk.com` on test), `WEBAUTHN_RP_NAME` (default = brand name). The expected origin list = the configured `CLIENT_ORIGIN` list (reuse the parsed `config.clientOrigins`), never taken from the request. In production `WEBAUTHN_RP_ID` must be a suffix of the `APP_URL` host (fail fast at boot otherwise). Passkeys are bound to the RP ID, so say in the report that changing the domain later invalidates them (and the README note belongs in `deploy/README-deploy.md`, section "Passkeys").

**Schema** (one new migration, never edit old ones): `model Passkey { id String @id @default(uuid()); adminUserId (cascade); credentialId String @unique (base64url); publicKey Bytes or String (base64url); counter Int; transports String? (JSON array); deviceType String? ('singleDevice'|'multiDevice'); backedUp Boolean; name String (user label, max 60); createdAt; lastUsedAt DateTime? }` with an index on `adminUserId`. A DB-backed `WebauthnChallenge { id, kind 'register'|'login', adminUserId?, challenge, expiresAt, createdAt }` (TTL 5 minutes, deleted on use, purged opportunistically) because the app may run several processes; no in-memory challenge store.

**Server (`/api/auth/passkeys/*`)**
- `POST /passkeys/register/options` (`authenticate`, body `{ currentPassword }` re-check with the normal lockout) -> `generateRegistrationOptions`: `userVerification: 'required'`, `residentKey: 'required'` (discoverable credential, so login needs no username), `attestationType: 'none'`, `excludeCredentials` = the user's existing passkeys, user handle = the admin id bytes, challenge stored.
- `POST /passkeys/register/verify` (`authenticate`, `{ response, name }`) -> `verifyRegistrationResponse` with expectedChallenge/origins/rpID and `requireUserVerification: true`; store the credential; max 10 passkeys per user; email notice «تمت إضافة مفتاح مرور جديد إلى حسابك» to the owner.
- `POST /passkeys/login/options` (public, rate limited like `/login`) -> `generateAuthenticationOptions` with `userVerification: 'required'` and NO `allowCredentials` (discoverable flow); returns `{ options, challengeId }`.
- `POST /passkeys/login/verify` (public, rate limited, `{ challengeId, response }`) -> look the credential up by id, `verifyAuthenticationResponse` with `requireUserVerification: true`, counter check (a counter that does not increase for a credential that reports counters = reject and log), update `counter` + `lastUsedAt`, require the owner to be `active` (`suspended` -> 403, `pending` -> same 403 as the password flow), then issue the session exactly like the password login does (lastLogin, JWT, serialized user). Super admins may use passkeys too. Every failure returns the same generic 401 text. Failures are not charged to the per-email lockout (the email is unknown at this point); the per-IP rate limit is the guard.
- `GET /passkeys` (`authenticate`) lists `{ id, name, createdAt, lastUsedAt, deviceType, backedUp }` (never key material); `PATCH /passkeys/:id` rename; `DELETE /passkeys/:id` requires `{ currentPassword }`; each of them only for the caller's own passkeys (404 otherwise).
- Deleting the last second factor is never blocked (password login still works). When `totpRequiredForAll` or `loginOtpRequiredForAll` is on, passkey login still counts as full authentication (document in a comment).
- A password change or reset does not delete passkeys. Setting a user to `suspended` or deleting them already blocks/removes them; add a test.
- Admin lost-device help: `POST /api/auth/users/:id/reset-passkeys` (`manageUsers`; super admin target requires super admin actor) deletes all of a user's passkeys and mails the owner; a «إعادة تعيين مفاتيح المرور» action next to the TOTP reset in the users page.
- `serializeUser` for `/me` gains `passkeyCount`.
- Never log challenges, credential ids, keys or assertions.

**Client**
- Login card: a secondary button «الدخول بمفتاح مرور» (key icon) under the submit button, hidden when `window.PublicKeyCredential` is missing. Click -> options -> `startAuthentication` -> verify -> same post-login handling as the password flow. Cancel (`NotAllowedError`) is silent; other failures show «تعذّر الدخول بمفتاح المرور. جرّب كلمة المرور.». Also try conditional UI (autofill) only if it is a few lines and does not change the layout; otherwise skip it.
- Profile page: a «مفاتيح المرور» card: list (name, created, last used, synced/device-bound badge), «إضافة مفتاح مرور» (password confirm -> browser prompt -> name it, default «مفتاحي (<date>)»), rename, delete (password confirm). Explanatory line: «يتيح الدخول بالبصمة أو بوجهك دون كلمة مرور أو رمز».
- Users page: action «إعادة تعيين مفاتيح المرور» and a small key badge in the table when the user has any.
- Arabic first, both languages where neighbour files carry both.

## Out of scope
SMS/push, attestation verification (`none` is intended), account recovery redesign, changing TOTP or email-code flows, role/permission changes, deploy automation (only the README note and env examples).

## Constraints
No commits. Only the two named packages may be installed. Never read or write `.env*` except a smoke-test copy of `server/.env.example` to `server/.env` (delete afterwards; API `PORT=4015`, Vite `--port 5185` with `VITE_API_PROXY_TARGET=http://localhost:4015`; WebAuthn works on `http://localhost`). LF endings. Free model only. Never touch a production DB; the migration is only a file.

## Tests (server/test)
Cover with `@simplewebauthn/server`-compatible fixtures or by generating a software authenticator in the test (a tiny helper signing with `node:crypto` EC P-256, ES256, `none` attestation is enough): register options require the password; excludeCredentials; register verify success/wrong challenge/expired challenge/wrong origin/wrong rpId/no UV rejected; max 10; login success issues a working token; counter regression rejected; unknown credential, suspended and pending users rejected with the same generic 401/403 bodies; challenge single use; list never contains key material; rename/delete ownership (another user's id -> 404) and password requirement; reset-passkeys permission rules and mail; passkey login for a super admin and for a TOTP-enabled user needs no extra step; rate limit on the public endpoints. Existing tests must still pass.

## Gates
`npm run lint` (no new warnings), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`. Browser smoke on localhost with the Chrome virtual authenticator (DevTools > WebAuthn, enable a virtual authenticator with user verification): register, sign out, sign in with the passkey, rename, delete; report exactly what you could and could not verify. Stop servers, delete `server/.env` and the dev DB afterwards.

## Report
Write `task-w3-auth-c-report.md`: files changed, migration name, package versions, gate results, browser smoke notes, decisions, not verified.
