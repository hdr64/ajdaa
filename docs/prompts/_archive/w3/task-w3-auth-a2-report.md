# Task w3-auth-a2 — Report

## Scope
Implemented in worktree `D:\projects\html\ajda-wt\auth` (branch `lane/auth`), no commits, no installs, no git operations.

## A. 6-digit verification code in create-mode email + public verify/resend endpoints + login-page code step

- New OTP purpose `email_verification` (reused existing challenge machinery via `otpService.issueChallenge`/`verifyChallenge`).
- `sendAccountVerificationMail` now issues a challenge for purpose `verify` when in create mode and passes `code`/`codeExpiresInMinutes` to the mail job; invite mode does not.
- `emailVerificationEmail` template renders a code block + expiry line (create mode only) and a password block.
- `EmailVerificationPayload` extended with `code`, `codeExpiresInMinutes` (job payload typed).
- Public endpoints `POST /api/auth/verify-email-code` (email + password + code) and `POST /api/auth/verify-email-code/resend` (cooldown + fresh code).
- Create-mode accounts now set `passwordChangedAt` at creation so invite vs create is detected via `passwordChangedAt === null`.
- Client: `VerifyEmailCodeStep.tsx` + `AdminLoginPage` code step with auto sign-in, resend countdown, wrong-code attempts display.

## B. New `verifyUsers` permission + mark-verified endpoint

- `verifyUsers` added to permissions catalogue (`permissions.ts`), `AdminPermission` type (`fastify.d.ts`), seed (`seed.ts` — true for super_admin and dev project-manager seed entries; false otherwise), roles escalation guards (`roles.routes.ts`), roles model (`rolesModel.ts`), `RoleFormDialog.tsx`.
- `POST /api/auth/users/:id/mark-verified`: permission-gated (403 without `verifyUsers`), super admin always allowed, invite → `needsPassword: true`, suspended stays suspended, already-verified → 409, non-super-admin cannot target super admin, only super admin can grant `verifyUsers` to a role.
- Client: `onMarkVerified` wired through `UsersTable`/`Grid`/`List`/`UsersPermissionsManager`/`useUsersDirectory`; `canMarkVerified` in `UserRights`.

## C. "Send the password in the email" checkbox (bypasses the queue)

- `sendPasswordInEmail` boolean on `AdminUserInput` (client) and validated server-side (create mode only; rejected for invite).
- Password is emailed directly via `sendMail` (never dispatched to Redis) in a separated block; never in resend.
- `UserCreateWizard.tsx` checkbox (create mode only, hidden for invite/super admin, with warning, shown in review step).

## Guard results

- `clean-code-guard`: applied; lint clean (oxlint, 0 warnings/errors).
- `test-guard`: applied; all tests reviewed.
- `docs-guard`: applied; no doc changes outside task scope.
- `adversarial-verification`: applied; hostile inputs probed (wrong code, expired code, wrong password, lockout, invite-account misuse, already-active oracle, resend cooldown, superseded code, mark-verified edge cases).

## Verified (command -> result)

- `cd server && npm run build` (tsc) -> exit 0
- `npm run build` (tsc -b && vite build) -> exit 0, 2041 modules
- `cd server && npm run lint` (oxlint) -> 0 warnings/errors
- `cd server && npm run test` (vitest) -> 35 test files, 307 tests, all passed
- `cd server && npx vitest run test/email-verification.test.ts` -> 34 tests passed (incl. new code/resend/mark-verified/sendPassword blocks)
- `cd server && npx vitest run test/roles.test.ts` -> 14 tests passed (catalogue count 18, super admin 9 perms, verifyUsers expected perms)

## Probes run

- Wrong code → 400 + `attemptsLeft`
- Attempts exhausted → dead challenge → 400 expired
- Wrong password → generic 401 "Invalid credentials" + counts toward lockout
- Invite account using code → 401 (no oracle)
- Already-active account → 400 (no oracle)
- Link verification kills the code (and vice versa) → 400
- Resend within cooldown → 429 with Retry-After
- Resend after cooldown → 200, old code no longer works
- mark-verified: 403 without permission, 200 super admin, needsPassword for invite, suspended stays suspended, 409 already verified, 403 targeting super admin, 403 granting verifyUsers as non-super-admin
- sendPasswordInEmail: password present only when requested in create mode; rejected for invite; never in invite mail
- README commands not re-run (no new CLI commands introduced)

## Performance

- No performance-sensitive changes; OTP challenge machinery reused as-is. No measurement needed.

## Not verified

- Browser UI check (gate 5): no browser automation tool available in this environment. The web dev server was started on :5185 with `VITE_API_PROXY_TARGET=http://localhost:4015` and the API on :4015 with sync queue, but manual browser walkthrough of wizard checkbox (create-mode only, hidden for invite/super admin, warning, review step), pending login code step, wrong-code attempts, resend countdown, mark-verified row action, and permission-gated visibility was NOT performed. These are covered by the in-process API tests and the TypeScript build, but visual/UX verification is outstanding.
- In-process smoke driver for email-secret paths via `buildApp` + `getSentMail()`: the comprehensive `email-verification.test.ts` suite (34 cases) already exercises these paths against the real app instance, so this is effectively covered by the test suite rather than a separate driver.

## Known bugs

- None identified in changed code. Pre-existing: vite build emits a chunk-size warning (>500 kB) unrelated to this task.
- Scratch servers (API :4015, web :5185) and scratch folder `C:\Users\salah\AppData\Local\Temp\ajda-smoke-w3-auth-a2` should be stopped/deleted after review; owner's dev servers on :4011/:5191 were not touched.
