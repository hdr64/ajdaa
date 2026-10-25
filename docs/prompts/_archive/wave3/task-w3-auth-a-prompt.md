# Task w3-auth-a — email verification for new users + emailed confirmation of password changes

Part 1 of 3 (A email verification, B authenticator 2FA, C passkeys). Run A first, then B, then C, one after the other on the same worktree.

## Where
Worktree `D:\projects\html\ajda-wt\auth`, branch `lane/auth` (from `feat/backend-admin`, node_modules installed). No commits.

## Goal
1. New admin users must prove they own their email address before they can sign in. Two ways to add a user (owner decision):
   - **Invite user**: admin enters name, email, role/permissions, department only. The user gets an email with a one-time link, opens it, and chooses their own password. The admin never sees or sets a password. The link verifies the email and activates the account in one step.
   - **Create user** (today's flow): admin sets a password. The account is created **pending**; the user gets an email with a verification link and cannot sign in until they open it. The admin can resend.
2. Changing your own password (`POST /api/auth/me/password`) additionally requires a code emailed to the account address (confirm step), so a stolen session or a known password alone cannot change it.
3. **Super admins are exempt from both** (no email verification when a super admin account is created or invited, no email confirmation on their password change). Check the role of the TARGET account, not of the actor.
4. Verify the existing forgot-password flow (`/password/forgot`, `/password/reset`, `ForgotPasswordStep`, `ResetPasswordStep`) works end to end, still never reveals whether an address has an account, and is covered by tests. Fix gaps only; do not redesign it.

## Read first
`docs/MASTER-PLAN.md`, `refactor.md`, `server/prisma/schema.prisma` (AdminUser, OtpChallenge), the migration `server/prisma/migrations/20261022000000_foundation_past_projects_applications/` (follow its pattern, SQLite dev + Postgres prod notes in `server/prisma`), `server/src/routes/auth.routes.ts`, `server/src/services/otpService.ts`, `server/src/services/mailTemplates.ts`, `server/src/services/notificationService.ts` (`notifyPasswordChanged`), `server/src/jobs/emailJobs.ts` + `queueService.ts`, `server/src/services/passwordPolicy.ts`, `server/src/config/env.ts`, `server/test/helpers.ts`, `server/test/email-otp.test.ts`, `src/components/admin/auth/*`, `src/pages/admin/AdminLoginPage.tsx`, `src/components/admin/profile/AdminProfilePage.tsx`, `src/components/admin/users/UserCreateWizard.tsx`, `UserFormDialog.tsx`, `src/services/authService.ts`, `src/services/adminStorage.ts`.

## Design (decided)
**Schema** (one new migration; never edit old ones):
- `AdminUser.emailVerifiedAt DateTime?`. The migration backfills every existing row with `CURRENT_TIMESTAMP` so nobody is locked out.
- New model `EmailVerificationToken { id, adminUserId (cascade), purpose 'invite' | 'verify', tokenHash, expiresAt, consumedAt?, createdAt }`, index on `adminUserId`. Store only the SHA-256 of a 32-byte random token (peppered with `JWT_SECRET`, same idea as `otpService`). Invite links live 7 days, verify links 48 hours; one active token per user + purpose (issuing deletes older ones).
- `AdminUser.status` gets the new value `pending` (document it in the schema comment and wherever statuses are enumerated: server constants/zod, `AdminStatus` type, serializers, users table badge labels, status filters). A `pending` user cannot sign in, cannot use any token, and is excluded from "active admin" recipient lists.
- OtpChallenge purpose `password_change` (add to `OTP_PURPOSES`).

**Server**
- `POST /api/auth/users` (create): body gains `mode: 'create' | 'invite'` (default `create`). Target role `super_admin` forces `emailVerifiedAt = now`, status as requested, no mail (invite mode for a super admin is rejected with 400 "super admins are created with a password").
  - `invite`: password forbidden; stores a random unusable `passwordHash` (never a known value); status `pending`; issues an `invite` token; queues the invite mail (link `${config.appUrl}/admin/accept-invite?token=...`).
  - `create`: password required and policy-checked as today; status `pending` unless the requested role is super admin; issues a `verify` token; queues the verify mail (link `.../admin/verify-email?token=...`).
  - Mail failure must not lose the user: the user is created and the response carries `mailSent: false` so the UI can offer "resend".
- `POST /api/auth/users/:id/resend-verification` (`manageUsers`): re-issues the right token type for a pending user (invite if the user never had a usable password, i.e. an invite user; verify otherwise); rate limited; 409 if already verified.
- Public `POST /api/auth/verify-email` `{ token }`: for `verify` tokens: marks `emailVerifiedAt`, sets status `active`, consumes the token, returns `{ verified: true }`. Wrong, expired, consumed or unknown tokens all answer the same 400 text (no oracle). Rate limited per IP.
- Public `POST /api/auth/accept-invite` `{ token, password }`: for `invite` tokens: checks the password policy first (a policy failure must not burn the token), sets the password hash + `passwordChangedAt`, `emailVerifiedAt`, status `active`, consumes the token. Never signs the user in automatically; the UI sends them to the login page.
- `POST /api/auth/login`: a `pending` user gets 403 with a distinct code `{ error, code: 'EMAIL_NOT_VERIFIED' }` (only after the password is proven correct, so it is not an oracle; an invite user has no usable password and simply fails with 401 as any wrong password).
- Password change confirmation: `POST /api/auth/me/password` becomes two steps for non-super-admin accounts.
  - Step 1, `POST /api/auth/me/password/request` `{ currentPassword, newPassword }`: validates current password (same lockout rules) and policy, issues a `password_change` challenge, emails the 6-digit code, stores nothing about the new password server-side, returns `{ challengeId, emailHint }`.
  - Step 2, existing `POST /api/auth/me/password` gains `{ challengeId, code }` for non-super-admins; it re-validates current password + policy, verifies the code, then changes the password as today. Super admins keep the one-step call (no `challengeId`). A non-super-admin sending no `challengeId` gets 400 `CODE_REQUIRED`.
- An admin changing ANOTHER user's password through `PUT /api/auth/users/:id` is unchanged (it already notifies the owner by mail); do not add a code step there.
- Mail templates in `mailTemplates.ts` (Arabic first, plain, same layout as the others, `MailKind` extended): `invite`, `verify-email` (button + the raw link as text), `password-change-code`. No password or secret in any mail.
- All new queue work goes through the existing `dispatch`/`QueueableJob` pattern like `sendInquiryNotificationJob`; a mail failure must propagate to the queue so it retries.

**Client**
- Users wizard (`UserCreateWizard.tsx`): step 1 gets a first choice "طريقة الإضافة": «دعوة مستخدم» (invite) / «إنشاء مستخدم بكلمة مرور» (create). In invite mode step 3 loses the password field and the generator and shows an info line "سيصل المستخدم رابط دعوة على بريده ليختار كلمة مروره"; the review card says "حالة الحساب: بانتظار التفعيل". In create mode step 3 is unchanged but the review card says "سيُفعَّل الحساب بعد أن يؤكد المستخدم بريده". The status select is hidden for both (accounts start pending; super admin role = active immediately, so keep the select only when the selected role is super admin).
- Users table/detail: status badge «بانتظار التفعيل» for `pending`, and a row action «إعادة إرسال رابط التفعيل» (needs `manageUsers`). After creating, if `mailSent === false` show a toast with the failure and keep the user in the list.
- New public pages (lazy routes in `App.tsx`, same visual style as the admin login card): `/admin/accept-invite?token=` (new password + confirm, live policy checklist, submit, success state with a link to the login) and `/admin/verify-email?token=` (verifies on load, shows success or the generic failure). The token is read from the URL, sent in the POST body, then removed from the address bar with `history.replaceState`. These pages must not need a session.
- Login page: when the server answers `EMAIL_NOT_VERIFIED` show an Arabic message «لم يتم تأكيد بريدك الإلكتروني بعد. افتح رابط التفعيل المرسل إلى بريدك أو اطلب من المسؤول إعادة إرساله.».
- Profile page (`AdminProfilePage.tsx`) password card: after the first submit show an inline code step (6 digits, resend using the existing cooldown pattern from `LoginOtpStep`), then complete the change. Super admins see no code step.
- Arabic UI text first; follow each file's current language handling (the auth components also carry English strings: keep both there).

## Out of scope
TOTP, passkeys (tasks B and C), the forgot-password redesign, role/permission changes, the careers/past-projects code, deploy files.

## Constraints
No commits, no installs, no new dependencies, never read or write `.env*` except a smoke-test copy of `server/.env.example` to `server/.env` in this worktree (delete it afterwards; API `PORT=4015`, Vite `--port 5185` with `VITE_API_PROXY_TARGET=http://localhost:4015`). No hard-coded credentials anywhere. Keep LF line endings. Free model only. Do not touch the production database in any way; the migration is only a file.

## Tests (server/test)
New `email-verification.test.ts` and additions to existing auth tests covering: invite creates pending + token + mail with link; accept-invite policy failure keeps the token usable, success activates, second use fails; create mode pending + login blocked with `EMAIL_NOT_VERIFIED` only after a correct password; verify-email success/expired/consumed/unknown (same body); resend rate limit and 409 when verified; super admin create and invite behaviour; pending users excluded from active recipient lists and unusable tokens (JWT of a pending user rejected); password change two-step for a normal admin (no `challengeId` → 400, wrong code → 400, right code → changed, tokens issued before are revoked, a policy failure does not burn the code) and one-step for a super admin; forgot/reset flow regression (no account oracle, expired code, success revokes old tokens); mails contain no secret and the links use `APP_URL`. Update every existing test and seed that creates users so it still passes (`createThrowawayUser` should still produce usable accounts: have the helper mark them verified/active).

## Gates
`npm run lint` (no new warnings), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`. Then smoke test in the browser (dev servers on the ports above, mail in-memory transport): invite a user, read the link from the sent-mail log or helper, accept the invite, sign in; create a user with a password, see the login blocked, verify, sign in; change a password as a normal admin with the code; stop servers and delete `server/.env` and the dev DB after.

## Report
Write `task-w3-auth-a-report.md`: files changed, migration name, gate results, browser smoke notes, decisions, anything not verified.
