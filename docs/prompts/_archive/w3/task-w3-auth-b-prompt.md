# Task w3-auth-b — authenticator-app 2FA (TOTP) with recovery codes

Part 2 of 3. Run only after tasks A **and A2** are reviewed and committed on `lane/auth` (they edit the same login flow, login page, profile page and users page). Build on them; do not restructure them.

## Where
Worktree `D:\projects\html\ajda-wt\auth`, branch `lane/auth`. No commits.

## Goal
Admins can turn on two-factor sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password: any RFC 6238 app). It sits next to the existing emailed login code. After a correct password, a user with TOTP enabled must enter the 6-digit app code (or a recovery code) to get a session.

## Read first
`docs/MASTER-PLAN.md`, `D:\projects\html\ajda\docs\prompts\_archive\wave3\task-w3-auth-a-report.md`, `D:\projects\html\ajda\docs\prompts\task-w3-auth-a2-report.md` (or under `D:\projects\html\ajda\docs\prompts\_archive\` once archived), `server/src/middleware/auth.ts`, `server/src/routes/auth.routes.ts` (login, `/login/verify-otp`, `/me/login-otp`, `requiresLoginOtp`), `server/src/services/otpService.ts`, `server/src/services/secretBox.ts` (encryption of secrets at rest), `server/src/services/securitySettings.ts` (`loginOtpRequiredForAll`), `server/src/services/loginFailureService.ts`, `server/prisma/schema.prisma`, `server/src/config/env.ts`, `src/components/admin/auth/*`, `src/pages/admin/AdminLoginPage.tsx`, `src/components/admin/profile/AdminProfilePage.tsx`, the security settings section in admin (find with `grep -rn loginOtpRequiredForAll src`), `src/services/authService.ts`.

## Design (decided)
**No TOTP library on the server.** Implement RFC 6238 with `node:crypto` in `server/src/services/totpService.ts`: 20-byte random secret (base32 encoded, own small encoder/decoder), HMAC-SHA1, 6 digits, 30 s step, accept the previous, current and next step (±1) with `crypto.timingSafeEqual`, and remember the last accepted step per user so a code cannot be replayed. Unit-test it against the RFC 6238 SHA-1 test vectors.

**QR code**: client-side only, new dependency `qrcode` (browser build) in the ROOT `package.json` only. You may install exactly this one package (`npm install qrcode`; plus `@types/qrcode` as devDependency if needed). Render the `otpauth://totp/<brand>:<email>?secret=...&issuer=<brand>` URI as a QR image and also show the secret text (grouped in 4s) with a copy button for manual entry. No server-side image generation.

**Schema** (one new migration `server/prisma/migrations/20261024000000_totp/migration.sql`, hand-written PostgreSQL SQL in the style of `20261022100000_email_verification`; never edit old ones; dev/tests keep using `prisma db push` on SQLite): on `AdminUser`: `totpSecretEnc String?` (encrypted with `secretBox`, never returned by any endpoint), `totpEnabledAt DateTime?`, `totpLastStep Int?`. New model `RecoveryCode { id, adminUserId (cascade), codeHash, usedAt?, createdAt }`, index on `adminUserId`; 10 codes generated per setup, format `XXXXX-XXXXX` from an unambiguous alphabet, shown ONCE, stored as peppered SHA-256 only.

**Server (`/api/auth/me/totp/*`, all `authenticate`)**
- `POST /me/totp/setup` `{ currentPassword }`: password re-check (reuse `rejectPasswordChangeLockout` and the same failure accounting as `/me/password/request`); generates a pending secret (stored encrypted but `totpEnabledAt` stays null) and returns `{ otpauthUri, secret }`. Calling again before confirming replaces the pending secret.
- `POST /me/totp/enable` `{ code }`: verifies against the pending secret, sets `totpEnabledAt`, creates the 10 recovery codes and returns them once: `{ recoveryCodes: string[] }`.
- `POST /me/totp/disable` `{ currentPassword, code }` (code = a TOTP code or an unused recovery code): clears secret, `totpEnabledAt`, deletes recovery codes. 403 when 2FA is required by the global setting (see below).
- `POST /me/totp/recovery-codes` `{ currentPassword, code }`: regenerates the 10 codes (invalidates the old ones), returns them once.
- `GET /me` / `serializeUser` gains `totpEnabled: boolean` and `recoveryCodesLeft: number` (only for the caller).
- Login: after the password is proven and before any session or email code: if the user has TOTP enabled, answer `200 { totpRequired: true, challengeId }`. The order in `/login` stays: lockout, password, suspended, **pending (`403 EMAIL_NOT_VERIFIED`, from task A)**, then the second factor; a pending user never reaches TOTP. `challengeId` is an `OtpChallenge` row with the new purpose `login_totp` (add it to `OTP_PURPOSES`): add two small functions to `otpService.ts` for code-less challenges (issue one with its own 5-minute TTL constant, its `codeHash` the peppered hash of 32 random bytes nobody receives; and spend one attempt / consume it), reusing the existing expiry, attempt and consumption checks. The id is a UUID, never a JWT, and is never accepted by `authenticate`. New `POST /login/verify-totp` `{ challengeId, code }` (TOTP or recovery code) issues the session exactly like `/login/verify-otp` does (lastLogin, token, serialized user). Wrong code: generic 401, counted by a per-challenge attempt cap (5) and the same per-IP rate limit as the other login endpoints; wrong codes are not charged to the per-email lockout (same reasoning as the email OTP in the existing comments). A used recovery code is marked used and the response includes `recoveryCodesLeft`.
- If a user has BOTH TOTP and emailed login code enabled, TOTP replaces the emailed code (one second factor is enough); say so in a code comment.
- Global setting: extend the existing "login code required for everyone" security setting with a second switch `totpRequiredForAll` (same storage, same settings endpoint and UI). When on, users without TOTP are forced into enrollment at their next successful password login: the server answers `{ totpEnrollmentRequired: true, enrollToken }` (a 10-minute JWT with the claim `scope: 'totp_enroll'`, accepted ONLY by `/login/enroll-totp/*`; `authenticate` in `server/src/middleware/auth.ts` must reject every token that carries any `scope` claim, and a test proves it), the client shows the enrollment screen, and only after `enable` succeeds is the normal session issued. Super admins are NOT exempt here (they are the highest-value accounts), but the setting is off by default. A super admin turning it on is warned in the UI that all admins will be asked to enroll.
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
No commits. The only allowed install is `qrcode` (+ its types) in the root project; nothing in `server/`. Never read or write any `.env*` file or `server/prisma/dev.db` in the worktree; run servers only as described in "Smoke environment". No hard-coded secrets; tests generate their own. Keep each file's existing line endings (the tree is CRLF with no `.gitattributes`; never rewrite a whole file just to change them). Free model only. Never touch a production DB; the migration is only a file.

## Tests (server/test)
`totpService.test.ts` (RFC 6238 vectors, ±1 step window, replay of the same step rejected, base32 round trip; the constant-time comparison is checked in review, not by a test that spies on internals); `totp-auth.test.ts`: setup/enable/disable/regenerate with and without the right password and code, secret never in any response except setup, recovery code single use, login flow (`totpRequired` after a correct password only, wrong code cap, expired challenge, challenge not usable as a bearer token, TOTP replaces the email code, suspended/pending user blocked), enrollment-required flow with the scope-limited token (the token must be rejected by every other route), global switch on/off, reset-totp permissions (super admin target needs super admin actor) and mail, token revocation after password change still works, `me` serialization. Existing login/OTP tests must still pass.

## Gates
`npm run lint` (no new warnings), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`. Browser smoke on the smoke servers (`:5185` / `:4015`): enable TOTP with a real code (generate it from the shown secret with a throwaway node script using your own `totpService`), sign out, sign in with password + app code, with a recovery code (second use must fail), disable, enrollment-required flow, reset by another admin. Servers, ports and cleanup exactly as in "Smoke environment"; the TOTP code comes from your own `totpService` in a throwaway script, so the login with an app code can be done in the browser.

## Report
Write `D:\projects\html\ajda\docs\prompts\task-w3-auth-b-report.md`: files changed, migration name, dependency added, gate results, browser smoke notes, decisions, not verified.

## Smoke environment (use exactly this; protects the owner's files)
The worktree's `server/.env` holds the owner's **real SMTP credentials**, and the owner's dev servers already run from this worktree on web `:5191` / API `:4011` with `server/prisma/dev.db`. **Never read, edit, copy over or delete `server/.env` or `server/prisma/dev.db`, and never stop or reuse ports 4011/5191.**
For your own servers:
1. Create a scratch folder outside the repo, e.g. `$env:TEMP\ajda-smoke-<task>`. In it, write a `.env` built from `server/.env.example` with: `PORT=4015`, `HOST=127.0.0.1`, `APP_URL=http://localhost:5185`, `CLIENT_ORIGIN=http://localhost:5185`, `DATABASE_URL="file:<scratch folder, forward slashes>/smoke.db"`, `UPLOAD_DIR=./uploads`, and **all `MAIL_*` keys empty** (mail then goes to the in-memory transport and nothing is delivered). Pitfalls found in review of A2: `.env.example` has no final newline (start your own lines with a newline); delete the `MAIL_PORT` and `MAIL_ENCRYPTION` lines instead of blanking them (an empty value fails env validation and the API exits); write `DATABASE_URL` with a Windows drive path (`file:C:/Users/.../smoke.db`), a Git-Bash `/c/...` path points at the wrong place.
2. Create the schema and seed it from `server/` with only `DATABASE_URL` overridden in the shell: `npx prisma db push --skip-generate` then `npm run db:seed`.
3. Start the API with the scratch folder as the working directory (that is where `dotenv` looks for `.env`): `node <worktree>\server\node_modules\tsx\dist\cli.mjs <worktree>\server\src\server.ts`. Check `http://localhost:4015/api/health`.
4. Start the web app from the worktree root: `VITE_API_PROXY_TARGET=http://localhost:4015` then `npx vite --port 5185 --strictPort`. Sign in with `admin@ajdaa.sa` / `password`.
5. Emailed codes and links are **not readable** from a running server (the in-memory mail log lives inside that process). Prove the emailed-secret paths with an in-process driver (the real `buildApp` with `QUEUE_DRIVER=sync`, reading `getSentMail()`), as task A did; use the browser for everything around them (screens, errors, wrong-code handling, permission-gated actions).
6. Afterwards stop both servers and delete the scratch folder. Report exactly what was verified in the browser and what only in-process.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.

## Lessons from the A2 review (apply here)
- A2's login code step shipped broken: the step component called `onVerify(email, password, code)` while the page handler took only `(code)`, so the email was sent as the code. TypeScript accepts a callback with fewer parameters. Give every new step's props the exact handler signature, and in the browser submit a **wrong** code on the new login step and check the message shown (it must be the server's bilingual error, never "Validation failed").
- Only super admins may newly grant a permission that escalates; an unchanged flag resent by the admin form must not block edits. Do not copy the old pattern if you add any permission check on `PUT /users/:id`.
- `src/i18n/admin` exists now, but auth screens are excluded from it (see `docs/ADMIN-I18N.md`); keep the inline AR/EN style of the neighbouring auth components.
