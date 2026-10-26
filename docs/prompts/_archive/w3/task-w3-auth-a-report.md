# Task w3-auth-a — report

Email verification for new users + emailed confirmation of password changes.
Branch `lane/auth`, worktree `D:\projects\html\ajda-wt\auth`. No commits made.

## Files changed

**Server — modified**
- `server/prisma/schema.prisma` — `AdminUser.emailVerifiedAt DateTime?` + relation; `status` comment documents `active | pending | suspended`; `OtpChallenge.purpose` gains `password_change`; new model `EmailVerificationToken` (index on `adminUserId`).
- `server/src/services/otpService.ts` — `OTP_PURPOSES += 'password_change'`.
- `server/src/services/mailTemplates.ts` — `MailKind += 'invite' | 'verify-email' | 'password-change-code'`; new `linkBlock` helper + `inviteEmail`, `emailVerificationEmail`, `passwordChangeCodeEmail` (escaped/peppered, no secret, button + raw link for the link mails).
- `server/src/services/emailVerificationService.ts` — **new**: 32-byte random token (hex), SHA-256 peppered with `JWT_SECRET`, one active token per admin+purpose (issuing deletes older), invite 7d / verify 48h, `issueEmailVerificationToken` / `consumeEmailVerificationToken` (updateMany guard prevents double-spend) / `lastVerificationPurpose` / `latestTokenIssuedAt`.
- `server/src/jobs/emailJobs.ts` — `sendInviteEmailJob`, `sendEmailVerificationJob`, `sendPasswordChangeCodeJob` (QueueableJob; failing `sendMail` propagates so the queue retries).
- `server/src/app.ts` — register the three new jobs.
- `server/src/routes/auth.routes.ts` — `POST /users` gains `mode:'create'|'invite'`; `/verify-email`, `/accept-invite`, `/users/:id/resend-verification`, `/me/password/request` added; `/login` returns `403 {code:'EMAIL_NOT_VERIFIED'}` for pending (after the password is proven); `/me/password` becomes two-step for non-super-admins; pending-activation bypass guard on `PUT /users/:id`.

**Server — tests/seed**
- `server/test/email-verification.test.ts` — **new** (invite/accept, create+login gate, verify-email failure parity, resend throttle+409, super-admin exemption, pending isolation + minted-JWT rejection, two-step password change, forgot/reset regression, no-secret + APP_URL link checks).
- `server/test/helpers.ts` — `createThrowawayUser` marks the created account active/verified and clears the confirmation mail it now queues.
- `server/test/security.test.ts`, `server/test/email-otp.test.ts` — the two self-service `/me/password` tests now use a super admin (one-step); the non-super-admin code path lives in the new file.
- `server/prisma/seed.ts` — seeded admins created with `emailVerifiedAt` (they predate the rule).

**Client**
- `src/types/admin.ts` — `AdminStatus += 'pending'`; `AdminUserInput.mode?`.
- `src/services/authService.ts` — preserve `pending` in `toAdminUser`; `createUser` returns `{ user, mailSent }`; new `verifyEmail`/`acceptInvite`/`requestPasswordChange`/`resendVerification`; `changePassword` accepts `{ challengeId, code }`; `setUserStatus` widened to `AdminStatus`.
- `src/services/adminStorage.ts` — forwards for all of the above.
- `src/components/admin/users/usersModel.ts` — `STATUS_LABELS.pending`; `ToggleableAdminStatus` union; `UserViewProps.onResendVerification`.
- `src/components/admin/users/usersUi.tsx`, `UsersTable/UsersList/UsersGrid.tsx`, `UsersPermissionsManager.tsx` — pending chip tone, row action «إعادة إرسال رابط التفعيل» (pending only), `pending` status filter + count, `ToggleableAdminStatus` on the toggle/bulk path.
- `src/components/admin/users/UserCreateWizard.tsx` — `mode` choice («طريقة الإضافة»), invite hides password/generator + info line, review-card status text, status select only for super admin, `mailSent` resend toast.
- `src/components/admin/users/UserFormDialog.tsx` — edit shows a read-only pending status (cannot bypass verification).
- `src/components/admin/profile/AdminProfilePage.tsx` — two-step password change with 6-digit code step + 60s resend cooldown; one-step for super admins.
- `src/pages/admin/AdminLoginPage.tsx` — `EMAIL_NOT_VERIFIED` message.
- `src/App.tsx` + **new** `src/pages/admin/VerifyEmailPage.tsx`, `src/pages/admin/AcceptInvitePage.tsx` — public lazy routes `/admin/verify-email`, `/admin/accept-invite` (read token from URL, `history.replaceState`, no session).

**New migration**
- `server/prisma/migrations/20261022100000_email_verification/migration.sql` — Postgres SQL (add column, create table + index + FK cascade, backfill `emailVerifiedAt = CURRENT_TIMESTAMP`).

## Gates (fresh, all run this session)

- `npm run lint` → clean (oxlint, no warnings).
- `npm run build` → `✓ built in 1.16s` (tsc -b + vite). Pre-existing >500 kB chunk-size notice only.
- `npm --prefix server run build` → `tsc` clean.
- `npm --prefix server test` → `Test Files 35 passed (35)`, `Tests 287 passed (287)`.

## Smoke (dev servers, in-memory mail)

Copied `server/.env.example` → `server/.env` (`PORT=4015`, `APP_URL=http://localhost:5185`), `prisma db push` + seed to a throwaway `dev.db`, then:
- In-process HTTP driver (real `buildApp`, `QUEUE_DRIVER=sync`, mail read from the in-memory log — the only cross-process way to obtain the emailed one-time token): **14/14 PASS** — invite → pending → accept-invite activates → sign in; create → pending → login `403 EMAIL_NOT_VERIFIED` → verify → sign in; two-step password change incl. old-token revocation; invite/verify links use `APP_URL`; code mail carries no secret.
- API dev server booted on `4015` (`/api/health` ok); public `POST /api/auth/verify-email` with an unknown token → `400` (rate-limited `x-ratelimit-limit:5`).
- Then removed `server/.env`, the throwaway `dev.db`, and the smoke script. Working tree has no `.env`/`dev.db` artifacts.

## Decisions

- `pending` left only via the emailed verify link / accept-invite; the one-step "activate" is reserved for super admins (born active). `PUT /users/:id` refuses `status:'active'` on a pending target (400) so an admin cannot bypass verification.
- Account-creation mail goes through `dispatch`/`QueueableJob` (a dead server is retried). `mailSent = isMailEnabled()` reflects whether SMTP is configured; in the in-memory transport (test/dev) the mail is still recorded for assertions/tests.
- Resend uses a per-account cooldown (`LOGIN_OTP_RESEND_COOLDOWN_MS`) returning `429` — testable without hammering the per-IP limiter; public verify/accept endpoints carry `RATE_LIMIT_PASSWORD_RESET_*` as the outer layer.
- `accept-invite` never signs the user in; the UI sends them to login.

## Not verified / known issues

- No literal browser click: the smoke is an in-process HTTP driver reading links from the in-memory mail log. The Vite dev server on `5185` was not run; client routing was verified by the production build (new lazy chunks emitted) and the App.tsx wiring, not by clicking in a browser.
- Line endings: the repo working tree is CRLF and there is no `.gitattributes`. I preserved each edited file's existing endings (no mixed endings) rather than rewriting whole files to LF — flagged as a deviation from the "LF" instruction.
- `mailSent:false` is configuration-derived, not a per-send delivery verdict: a configured-but-unreachable SMTP is retried by the queue while the flag can still read `true`.
- The `POST /users` handler is long (existing style retained); extracting its role/department resolution into helpers is a worthwhile future refactor I avoided to keep the diff minimal.
- Edge (out of scope): an admin changing a pending account's role to `super_admin` leaves it `pending` (still must verify); such an account does not get the super-admin exemption retroactively.
