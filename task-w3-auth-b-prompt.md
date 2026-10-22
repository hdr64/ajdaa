# Task w3-auth-b — authenticator-app 2FA (TOTP) with recovery codes

Part 2 of 3. Run only after task A is reviewed and committed on `lane/auth` (it edits the same login flow and profile page).

## Where
Worktree `D:\projects\html\ajda-wt\auth`, branch `lane/auth`. No commits.

## Goal
Admins can turn on two-factor sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password: any RFC 6238 app). It sits next to the existing emailed login code. After a correct password, a user with TOTP enabled must enter the 6-digit app code (or a recovery code) to get a session.

## Read first
`docs/MASTER-PLAN.md`, `task-w3-auth-a-report.md`, `server/src/routes/auth.routes.ts` (login, `/login/verify-otp`, `/me/login-otp`, `requiresLoginOtp`), `server/src/services/otpService.ts`, `server/src/services/secretBox.ts` (encryption of secrets at rest), `server/src/services/securitySettings.ts` (`loginOtpRequiredForAll`), `server/src/services/loginFailureService.ts`, `server/prisma/schema.prisma`, `server/src/config/env.ts`, `src/components/admin/auth/*`, `src/pages/admin/AdminLoginPage.tsx`, `src/components/admin/profile/AdminProfilePage.tsx`, the security settings section in admin (find with `grep -rn loginOtpRequiredForAll src`), `src/services/authService.ts`.

## Design (decided)
**No TOTP library on the server.** Implement RFC 6238 with `node:crypto` in `server/src/services/totpService.ts`: 20-byte random secret (base32 encoded, own small encoder/decoder), HMAC-SHA1, 6 digits, 30 s step, accept the previous, current and next step (±1) with `crypto.timingSafeEqual`, and remember the last accepted step per user so a code cannot be replayed. Unit-test it against the RFC 6238 SHA-1 test vectors.

**QR code**: client-side only, new dependency `qrcode` (browser build) in the ROOT `package.json` only. You may install exactly this one package (`npm install qrcode`; plus `@types/qrcode` as devDependency if needed). Render the `otpauth://totp/<brand>:<email>?secret=...&issuer=<brand>` URI as a QR image and also show the secret text (grouped in 4s) with a copy button for manual entry. No server-side image generation.

**Schema** (one new migration, never edit old ones): on `AdminUser`: `totpSecretEnc String?` (encrypted with `secretBox`, never returned by any endpoint), `totpEnabledAt DateTime?`, `totpLastStep Int?`. New model `RecoveryCode { id, adminUserId (cascade), codeHash, usedAt?, createdAt }`, index on `adminUserId`; 10 codes generated per setup, format `XXXXX-XXXXX` from an unambiguous alphabet, shown ONCE, stored as peppered SHA-256 only.

**Server (`/api/auth/me/totp/*`, all `authenticate`)**
- `POST /me/totp/setup` `{ currentPassword }`: password re-check (same lockout as password change); generates a pending secret (stored encrypted but `totpEnabledAt` stays null) and returns `{ otpauthUri, secret }`. Calling again before confirming replaces the pending secret.
- `POST /me/totp/enable` `{ code }`: verifies against the pending secret, sets `totpEnabledAt`, creates the 10 recovery codes and returns them once: `{ recoveryCodes: string[] }`.
- `POST /me/totp/disable` `{ currentPassword, code }` (code = a TOTP code or an unused recovery code): clears secret, `totpEnabledAt`, deletes recovery codes. 403 when 2FA is required by the global setting (see below).
- `POST /me/totp/recovery-codes` `{ currentPassword, code }`: regenerates the 10 codes (invalidates the old ones), returns them once.
- `GET /me` / `serializeUser` gains `totpEnabled: boolean` and `recoveryCodesLeft: number` (only for the caller).
- Login: after the password is proven and before any session or email code: if the user has TOTP enabled, answer `200 { totpRequired: true, challengeId }` where `challengeId` is a short-lived (5 min) signed JWT or a DB challenge bound to the user and purpose `login_totp` (not usable as an auth token). New `POST /login/verify-totp` `{ challengeId, code }` (TOTP or recovery code) issues the session exactly like `/login/verify-otp` does (lastLogin, token, serialized user). Wrong code: generic 401, counted by a per-challenge attempt cap (5) and the same per-IP rate limit as the other login endpoints; wrong codes are not charged to the per-email lockout (same reasoning as the email OTP in the existing comments). A used recovery code is marked used and the response includes `recoveryCodesLeft`.
- If a user has BOTH TOTP and emailed login code enabled, TOTP replaces the emailed code (one second factor is enough); say so in a code comment.
- Global setting: extend the existing "login code required for everyone" security setting with a second switch `totpRequiredForAll` (same storage, same settings endpoint and UI). When on, users without TOTP are forced into enrollment at their next successful password login: the server answers `{ totpEnrollmentRequired: true, enrollToken }` (short-lived, scope-limited JWT accepted ONLY by `/login/enroll-totp/*`), the client shows the enrollment screen, and only after `enable` succeeds is the normal session issued. Super admins are NOT exempt here (they are the highest-value accounts), but the setting is off by default. A super admin turning it on is warned in the UI that all admins will be asked to enroll.
- Password change/reset: does NOT touch TOTP. An admin with `manageUsers` can reset another user's TOTP from the users page (`POST /api/auth/users/:id/reset-totp`, super admin target requires a super admin actor, audit-style log line without secrets, the user is notified by email) for lost-phone cases.
- Mail: `totp-reset` notification mail (Arabic first) when TOTP is reset by someone else; `totp-enabled` / `totp-disabled` security notices to the account owner.
- Never log secrets, codes or URIs. `otpauthUri` and `secret` appear only in the `setup` response.

**Client**
- Profile page: a new "التحقق بخطوتين" card. Not enabled: «تفعيل تطبيق المصادقة» opens a 3-step dialog (confirm password → scan QR / copy secret and enter the 6-digit code → save the 10 recovery codes with «نسخ» and «تنزيل ملف .txt» buttons and a required checkbox «حفظت الرموز» before closing). Enabled: status line with date, recovery codes left (warn at ≤ 3), «إعادة توليد رموز الاسترداد», «تعطيل» (password + code). Keep the existing email-code toggle card; if TOTP is on, show a note that the app code is used instead of the emailed one.
- Login: new step component `LoginTotpStep.tsx` (modelled on `LoginOtpStep`: 6 digit input with auto-submit, «استخدم رمز استرداد» toggle to type a recovery code, back link). `AdminLoginPage` handles `totpRequired` and `totpEnrollmentRequired` (the enrollment screen reuses the dialog content from the profile card as a full-card step).
- Security settings section: the new `totpRequiredForAll` switch next to the existing one.
- Users page: row/detail action «إعادة تعيين التحقق بخطوتين» (confirm dialog) shown when the target has TOTP and the actor has `manageUsers`; badge «2FA» in the users table when enabled.
- Arabic first, both languages where the neighbour files carry both.

## Out of scope
Passkeys (task C), SMS, push approval, changing the email-code flow, the forgot-password flow, role/permission changes, deploy files.

## Constraints
No commits. The only allowed install is `qrcode` (+ its types) in the root project; nothing in `server/`. Never read or write `.env*` except a smoke-test copy of `server/.env.example` to `server/.env` (delete afterwards; API `PORT=4015`, Vite `--port 5185` with `VITE_API_PROXY_TARGET=http://localhost:4015`). No hard-coded secrets; tests generate their own. LF endings. Free model only. Never touch a production DB; the migration is only a file.

## Tests (server/test)
`totpService.test.ts` (RFC 6238 vectors, ±1 step window, replay of the same step rejected, base32 round trip, constant-time compare used); `totp-auth.test.ts`: setup/enable/disable/regenerate with and without the right password and code, secret never in any response except setup, recovery code single use, login flow (`totpRequired` after a correct password only, wrong code cap, expired challenge, challenge not usable as a bearer token, TOTP replaces the email code, suspended/pending user blocked), enrollment-required flow with the scope-limited token (the token must be rejected by every other route), global switch on/off, reset-totp permissions (super admin target needs super admin actor) and mail, token revocation after password change still works, `me` serialization. Existing login/OTP tests must still pass.

## Gates
`npm run lint` (no new warnings), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`. Browser smoke on the ports above: enable TOTP with a real code (generate it from the shown secret with a throwaway node script using your own `totpService`), sign out, sign in with password + app code, with a recovery code (second use must fail), disable, enrollment-required flow, reset by another admin. Stop servers, delete `server/.env` and the dev DB afterwards.

## Report
Write `task-w3-auth-b-report.md`: files changed, migration name, dependency added, gate results, browser smoke notes, decisions, not verified.
