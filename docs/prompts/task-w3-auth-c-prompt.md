# Task w3-auth-c — passkeys (WebAuthn) as a full sign-in alternative

Part 3 of 3. Run only after tasks A, A2 and B are reviewed and committed on `lane/auth`. Build on them; do not restructure them.

## Where
Worktree `D:\projects\html\ajda-wt\auth`, branch `lane/auth`. No commits.

## Goal
Admins can register passkeys (fingerprint, Face ID, Windows Hello, phone, or a hardware key) in their profile and then sign in with a passkey **instead of** password + code. Owner decision: a passkey with user verification is the whole login (it replaces the password and the second factor). Password login stays available.

## Read first
`docs/MASTER-PLAN.md`, `D:\projects\html\ajda\docs\prompts\_archive\wave3\task-w3-auth-a-report.md`, `D:\projects\html\ajda\docs\prompts\task-w3-auth-a2-report.md` (or under `D:\projects\html\ajda\docs\prompts\_archive\` once archived), `D:\projects\html\ajda\docs\prompts\task-w3-auth-b-report.md` (or under `D:\projects\html\ajda\docs\prompts\_archive\` once archived), `server/src/middleware/auth.ts`, `server/src/routes/auth.routes.ts` (login flow, `serializeUser`), `server/src/config/env.ts` (`CLIENT_ORIGIN`, `APP_URL`, how origins are parsed), `server/src/services/loginFailureService.ts`, `server/prisma/schema.prisma`, `src/pages/admin/AdminLoginPage.tsx`, `src/components/admin/auth/*`, `src/components/admin/profile/AdminProfilePage.tsx`, `src/services/authService.ts`, `src/services/api.ts`.

## Design (decided)
**Libraries.** You may install exactly these, nothing else: `@simplewebauthn/server` in `server/` and `@simplewebauthn/browser` in the ROOT project (use the current stable majors that are compatible with Node/TypeScript here; note the versions in the report). Do not hand-roll CBOR/attestation parsing.

**Relying party config** (`server/src/config/env.ts`, validated, documented in `server/.env.example` and `deploy/test.env.example`): `WEBAUTHN_RP_ID` (optional; default = hostname of `APP_URL`, e.g. `localhost` in dev, `ajdaa.sa` in prod, `ajda.weghetk.com` on the test instance), `WEBAUTHN_RP_NAME` (default = brand name). The expected origin list = the configured `CLIENT_ORIGIN` list (reuse the parsed `config.clientOrigins`), never taken from the request. In production `WEBAUTHN_RP_ID` must be a suffix of the `APP_URL` host (fail fast at boot otherwise). Passkeys are bound to the RP ID, so say in the report that changing the domain later invalidates them (and the README note belongs in `deploy/README-deploy.md`, section "Passkeys").

**Schema** (one new migration `server/prisma/migrations/20261025000000_passkeys/migration.sql`, hand-written PostgreSQL SQL in the style of `20261022100000_email_verification`; never edit old ones): `model Passkey { id String @id @default(uuid()); adminUserId (cascade); credentialId String @unique (base64url); publicKey String (base64url); counter Int; transports String? (JSON array); deviceType String? ('singleDevice'|'multiDevice'); backedUp Boolean; name String (user label, max 60); createdAt; lastUsedAt DateTime? }` with an index on `adminUserId`. A DB-backed `WebauthnChallenge { id, kind 'register'|'login', adminUserId?, challenge, expiresAt, createdAt }` (TTL 5 minutes, deleted on use, purged opportunistically) because the app may run several processes; no in-memory challenge store.

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
No commits. Only the two named packages may be installed. Never read or write any `.env*` file or `server/prisma/dev.db` in the worktree; run servers only as described in "Smoke environment" (WebAuthn works on `http://localhost`). Keep each file's existing line endings (the tree is CRLF with no `.gitattributes`; never rewrite a whole file just to change them). Free model only. Never touch a production DB; the migration is only a file.

## Tests (server/test)
Cover with `@simplewebauthn/server`-compatible fixtures or by generating a software authenticator in the test (a tiny helper signing with `node:crypto` EC P-256, ES256, `none` attestation is enough): register options require the password; excludeCredentials; register verify success/wrong challenge/expired challenge/wrong origin/wrong rpId/no UV rejected; max 10; login success issues a working token; counter regression rejected; unknown credential, suspended and pending users rejected with the same generic 401/403 bodies; challenge single use; list never contains key material; rename/delete ownership (another user's id -> 404) and password requirement; reset-passkeys permission rules and mail; passkey login for a super admin and for a TOTP-enabled user needs no extra step; rate limit on the public endpoints. Existing tests must still pass.

## Gates
`npm run lint` (no new warnings), `npm run build`, `npm --prefix server run build`, `npm --prefix server test`. Browser smoke on localhost with the Chrome virtual authenticator (DevTools > WebAuthn, enable a virtual authenticator with user verification): register, sign out, sign in with the passkey, rename, delete; report exactly what you could and could not verify. Servers, ports and cleanup exactly as in "Smoke environment" (`APP_URL=http://localhost:5185` gives the RP ID `localhost`).

## Report
Write `D:\projects\html\ajda\docs\prompts\task-w3-auth-c-report.md`: files changed, migration name, package versions, gate results, browser smoke notes, decisions, not verified.

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
