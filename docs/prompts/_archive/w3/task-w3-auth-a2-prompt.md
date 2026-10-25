# Task w3-auth-a2 — verification code in the email, "mark as verified" permission, "send password" checkbox

Worktree: `D:\projects\html\ajda-wt\auth` (branch `lane/auth`). This builds on task A (email verification), which is finished and **uncommitted** in this worktree: do not revert or restructure it, extend it. Read `D:\projects\html\ajda\docs\prompts\_archive\wave3\task-w3-auth-a-report.md` first.

## Goal (three owner requests)
1. The verification email for a **create-mode** account also contains a 6-digit code. A pending user who opens the admin login page can verify the account by entering that code (in addition to the existing link).
2. A user holding a **new permission** (a super admin always holds it) can mark a pending user as verified from the admin Users page.
3. The create-user form gets a checkbox "send the password in the email" (create mode only).

## Read first
- `server/src/routes/auth.routes.ts` (login, `/verify-email`, `/accept-invite`, `POST /users`, `/users/:id/resend-verification`, `PUT /users/:id`)
- `server/src/services/otpService.ts` (6-digit challenge machinery: reuse it, do not write a second one)
- `server/src/services/emailVerificationService.ts`, `server/src/services/mailTemplates.ts` (`emailVerificationEmail`, `linkBlock`), `server/src/jobs/emailJobs.ts`, `server/src/services/queueService.ts`
- `server/src/config/permissions.ts`, `server/src/types/fastify.d.ts`, `server/prisma/seed.ts` (permission wiring), `server/src/routes/roles.routes.ts` and `src/components/admin/hr/rolesModel.ts` + `RoleFormDialog.tsx` (how `manageUsers` is treated as escalating)
- Client: `src/pages/admin/AdminLoginPage.tsx`, `src/components/admin/auth/*`, `src/pages/admin/VerifyEmailPage.tsx`, `src/services/authService.ts`, `src/services/adminStorage.ts`, `src/components/admin/users/UserCreateWizard.tsx`, `usersUi.tsx`, `UsersTable/UsersList/UsersGrid.tsx`, `useUsersDirectory.ts`, `usersModel.ts`, `src/types/admin.ts`
- Tests to extend: `server/test/email-verification.test.ts`, `server/test/helpers.ts`, `server/test/escalation.test.ts`, `server/test/roles.test.ts`

## Decided design

### A. Verification code (create mode only)
- Reuse `OtpChallenge` with a **new purpose `email_verification`** (`OTP_PURPOSES`, schema comment). No new table, no migration needed for the purpose (it is a string column). The challenge is the code; the existing link token stays as is. Both are valid ways to verify; using either one verifies the account and **deletes the other** (consume the token / clear the challenge), so a leftover code or link cannot be replayed.
- `sendAccountVerificationMail` for purpose `verify` additionally issues `issueChallenge(user.id, 'email_verification')` and passes the code to the mail job payload (`sendEmailVerificationJob` gets `code` and `codeExpiresInMinutes`). Invite-mode mails are unchanged (no code: the invited user has no password to log in with and must use the link).
- `emailVerificationEmail`: shows the code in the same style as `loginOtpEmail`/`passwordChangeCodeEmail` (large, monospaced, LTR), plus a sentence: "or enter this code on the admin login page after signing in". Keep the button/link. Escape everything as the other templates do. The text version carries the code too.
- Code lifetime: `loginOtpTtlMs`/attempt cap/resend cooldown from the existing config (do not add env vars). The link keeps its 48 h. Because the code lives shorter than the link, the login page must offer **"send me a new code"** (see below).
- **New endpoint `POST /api/auth/verify-email-code`** (public, same rate-limit config as `/verify-email`): body `{ email, password, code }`.
  1. Normalise the email like login does; apply `loginFailureTracker` lockout exactly as login does (`rejectIfLocked`); a wrong password records a failure and answers the same generic `401 Invalid credentials` as login (no oracle).
  2. The account must exist, be `status === 'pending'`, have `emailVerifiedAt === null`, and a **real** password (invite accounts have an unusable one and always fail the bcrypt check, which is correct).
  3. Look up the user's live `email_verification` challenge (add a small helper in `otpService.ts` or the verification service: newest live challenge id for an admin + purpose) and call `verifyChallenge`. Wrong code: `400` with `attemptsLeft` (same shape as the login OTP endpoint). Dead/none: `400` with the existing expired-code message.
  4. Success: set `emailVerifiedAt = now`, `status = 'active'`, delete the user's `verify` link token and any other `email_verification` challenge, `recordSuccess`, and answer `{ verified: true }`. Do **not** mint a session: the UI then continues the normal login (which may require the login OTP).
- **New endpoint `POST /api/auth/verify-email-code/resend`** (public, same limiter): body `{ email, password }`. Same credential checks (generic 401), same pending checks, then the existing resend cooldown (`429` + `Retry-After`), then issue a fresh challenge **and** a fresh link token (issuing supersedes the old ones) and queue the verify mail. Answer `{ sent: true }`.
- `POST /login` for a pending create-mode account keeps answering `403 { code: 'EMAIL_NOT_VERIFIED' }` (unchanged). Nothing is sent at login time.
- Client (`AdminLoginPage` + a new step component in `src/components/admin/auth/`, e.g. `VerifyEmailCodeStep.tsx`, styled like `LoginOtpStep.tsx`): when login answers `EMAIL_NOT_VERIFIED`, **switch to the code step** instead of only showing an error: message "لم يتم تأكيد بريدك بعد، أدخل الرمز المرسل إلى بريدك أو افتح الرابط", a 6-digit input, "تأكيد" button, "إرسال رمز جديد" button with a 60 s cooldown countdown, "back to login". It keeps the typed email + password in component state only (never in storage or the URL) and sends them with the code. On success: show a success message and **sign the user in automatically by re-submitting the original login** (one more `POST /login`), so the user does not type credentials again; if that login needs the login OTP, the existing step continues. Reuse `PasswordInput`, the OTP input component used by `LoginOtpStep` if one exists, and the existing `isAr` pattern for AR/EN strings.
- Add `verifyEmailCode` / `resendVerificationCode` to `authService.ts` + `adminStorage.ts`.

### B. New permission: `verifyUsers` ("تأكيد حسابات المستخدمين")
- Add `verifyUsers` to: `PERMISSION_CATALOGUE` (group `users`, labelAr `تأكيد حسابات المستخدمين`, labelEn `Verify User Accounts`, description: marks a pending user's email as verified without the emailed link or code), the `AdminPermission` type, `seed.ts` (true for `super_admin` and the dev/project-manager seed entries only if `manageUsers` is true for them; false otherwise), `src/types/admin.ts`, and every place that enumerates permission keys (find them with `grep -rn "manageUsers" server/src src server/prisma server/test`). Use the same wiring as `managePastProjects`/`viewApplications`, which were added the same way recently.
- **Escalation rule**: like `manageUsers`, only a super admin may grant `verifyUsers` to a role or user (it bypasses the email proof). Mirror exactly how `manageUsers` is guarded in `roles.routes.ts`, `auth.routes.ts` and `rolesModel.ts`/`RoleFormDialog.tsx`, including the tests in `escalation.test.ts`/`roles.test.ts`.
- **New endpoint `POST /api/auth/users/:id/mark-verified`**, `authenticate` + `requirePermission('verifyUsers')`:
  - 404 unknown user. `409` if the account is already verified (`emailVerifiedAt !== null`).
  - A non-super-admin caller may not act on a `super_admin` target (same rule as other user mutations).
  - Sets `emailVerifiedAt = now`; sets `status = 'active'` **only if** the status is `pending` (a `suspended` account stays suspended); deletes the user's verification tokens and `email_verification` challenges.
  - For an **invite-mode** account the stored password is unusable. After marking it verified, the response includes `{ needsPassword: true }` and the UI tells the admin "the user must use 'Forgot password' on the login page to choose a password". (Do not set a password here.)
  - Records an audit entry the same way other admin user actions are logged, if such a mechanism exists (check how `loggerService`/request logging is used for user changes; do not invent a new audit table).
- Client: users list row action «تأكيد الحساب يدويًا» for pending/unverified users, shown only when the signed-in user has `verifyUsers`; a confirm dialog explaining that this skips the email check; the success toast; the row updates to `active`. Add it to table, list and grid views the same way «إعادة إرسال رابط التفعيل» was added. The edit dialog keeps showing a read-only pending status.
- The existing `PUT /users/:id` guard stays: no status change can verify an account. Only `mark-verified` and the two user-owned flows (link, code) can.

### C. "Send the password in the email" checkbox
- `POST /users` body gains `sendPasswordInEmail?: boolean` (default false). Valid **only** for `mode: 'create'` (reject with 400 when combined with `invite`, with the existing INVITE-style bilingual error pattern) and not for a super-admin target (no mail is sent for them).
- When true, the verification mail for that account includes the plain password the admin typed (a clearly separated block "كلمة المرور المؤقتة" + "يُنصح بتغييرها بعد أول دخول"). **The password must never be written to the queue or any log:** the normal `dispatch` payload goes to Redis in production, so for this one mail do **not** use `dispatch`. Build the content with a new optional `password` option in `emailVerificationEmail` and call `sendMail` directly in the request handler (await it; a failure must not fail account creation: catch, set `mailSent = false`, and the admin sees the existing "mail not sent, use resend" toast). Resend (`/users/:id/resend-verification` and the public resend) **never** includes a password (it is not stored anywhere).
- Make sure `mailService`/`loggerService`/request logging do not persist the mail body or the request body of `POST /users` (check and, if a body is logged, redact `password`); add a test that asserts the password does not appear in the logger output or in any queue payload.
- Client (`UserCreateWizard.tsx`): the checkbox appears only in create mode when the role is not super admin, default **unchecked**, label «إرسال كلمة المرور في البريد الإلكتروني», with a one-line warning under it (email is not a secure channel; the user should change the password after first login). Show it in the review step. Pass `sendPasswordInEmail` through `authService.createUser`.

## Out of scope
- Authenticator 2FA, recovery codes, passkeys (tasks B and C), the i18n lanes, PostgreSQL migration, any change to the invite flow other than what is listed, any change to `accept-invite`.
- Do not add env vars. Do not change the existing verification link behaviour or its 48 h TTL.

## Constraints
- No commits, no installs, no git operations. Keep each file's existing line endings (the tree is CRLF): do not rewrite whole files.
- Do not touch `server/.env` or `server/prisma/dev.db` (see "Smoke environment"). In-memory mail is used in tests.
- Files not to touch: anything under `src/i18n/`, `deploy/`, `docs/archive/`.
- No migration is needed for this task (the new OTP purpose is a string, the permission lives in JSON). If you find you need one, stop and report why instead of adding it.

## Tests (add to `server/test/email-verification.test.ts` and the escalation/roles tests)
- create-mode mail contains a 6-digit code and the link; invite-mode mail has no code.
- `verify-email-code`: success activates and clears the link token and challenges; wrong code → `400` + `attemptsLeft`; attempts exhausted → dead; wrong password → generic 401 and counts toward the lockout; invite account cannot use it; already-verified/active account answers like a failure (no oracle); link verification kills the code and vice versa.
- `verify-email-code/resend`: cooldown `429`, new code works and the old one does not.
- `mark-verified`: permission required (403 without), super admin always allowed, invite account returns `needsPassword`, suspended account stays suspended, already verified → 409, non-super-admin cannot target a super admin, only a super admin can grant `verifyUsers` to a role.
- `sendPasswordInEmail`: mail contains the password only when requested, never with `invite`, never in resend, never in logger output or queue payload; `POST /users` still succeeds when `sendMail` throws.
- Update existing tests/fixtures that enumerate all permission keys.

## Gates (run all, paste results)
1. `npm run lint`
2. `npm run build`; `npm --prefix server run build`
3. `npm --prefix server test` (all green)
4. In-process driver (see "Smoke environment" step 5): create-mode user with the checkbox on (mail holds code, link and password); verify through `verify-email-code`; public resend (new code works, old one does not); invite user gets no code; `mark-verified` for create, invite (`needsPassword`) and suspended accounts.
5. Browser check on your own smoke servers (`http://localhost:5185`, never the owner's :5191): create-user wizard with the checkbox (create mode only, hidden for invite and super admin, warning shown, shown in the review step); a pending user's login switches to the code step; a wrong code shows the error and attempts left; the resend countdown; "mark as verified" on a pending user; a role with `verifyUsers` given to a non-super-admin shows them the row action while a user without it does not see it. If a browser is unavailable, say so explicitly; do not claim it.

## Report
Write `D:\projects\html\ajda\docs\prompts\task-w3-auth-a2-report.md`: files changed, gate output (trimmed), how the code and link invalidate each other, where the password mail bypasses the queue and the proof it is not logged, decisions made, what was not verified.

## Smoke environment (use exactly this; protects the owner's files)
The worktree's `server/.env` holds the owner's **real SMTP credentials**, and the owner's dev servers already run from this worktree on web `:5191` / API `:4011` with `server/prisma/dev.db`. **Never read, edit, copy over or delete `server/.env` or `server/prisma/dev.db`, and never stop or reuse ports 4011/5191.**
For your own servers:
1. Create a scratch folder outside the repo, e.g. `$env:TEMP\ajda-smoke-<task>`. In it, write a `.env` built from `server/.env.example` with: `PORT=4015`, `HOST=127.0.0.1`, `APP_URL=http://localhost:5185`, `CLIENT_ORIGIN=http://localhost:5185`, `DATABASE_URL="file:<scratch folder, forward slashes>/smoke.db"`, `UPLOAD_DIR=./uploads`, and **all `MAIL_*` keys empty** (mail then goes to the in-memory transport and nothing is delivered).
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
