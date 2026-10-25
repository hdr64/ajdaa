# Task w4-create-dev-user — Report

## Files changed

- `server/scripts/lib/devUser.ts` (new): pure, unit-tested helpers — `parseCliArgs`, `normalizeEmail`, `validateName`, `allPermissionsObject`, `buildDevUserData`, `generatePassword`, `parseDbName`, `isLocalDatabase`.
- `server/scripts/create-dev-user.ts` (new): TTY-driven provisioning script — prompts for password (hidden input via `process.stdin.setRawMode`, no new dependency), confirms by typing the database name, enforces `--yes` restrictions, checks the `role_super_admin` role exists, creates/resets the super_admin user with all permissions, hashes with bcrypt cost 10, prints login hints.
- `server/package.json`: added `"user:create-dev": "tsx scripts/create-dev-user.ts"`.
- `package.json` (root): added `"user:create-dev": "npm --prefix server run user:create-dev --"`.
- `server/test/devUser.test.ts` (new): 26 unit tests for the pure helpers.
- `deploy/README-deploy.md`: added §3.4.2 "Create a developer user" after §3.4.1, with exact commands for test and production, `--generate` and `--reset-password` variants.

## Gate results

- `npm --prefix server run build` (tsc): passed, clean.
- `npm --prefix server run test` (vitest): **297 passed, 1 failed**. The single failure is in `test/email-otp.test.ts` ("New inquiry notifications > emails only the active admins who can view inquiries") — a pre-existing failure about a notification URL (`http://localhost:5189/admin/inquiries` vs `https://ajda.weghetk.com/...`), **unrelated** to this task. Re-running once did not change the result (same pre-existing failure). All 26 tests in `test/devUser.test.ts` pass.
- `npm run lint` (root, oxlint): passed, no new warnings. (The `server/` package has no lint script; oxlint at root covers the workspace.)

## Manual verification (dev database `server/prisma/dev.db` only)

All commands run from `server/`:

- `echo "dev.db" | npx tsx scripts/create-dev-user.ts --email dev.test@ajdaa.sa --name "Dev Test User" --generate` → created user, printed generated password once, exit 0.
- Same command again for the same email → "user already exists", exit 1 (no modification).
- `npx tsx scripts/create-dev-user.ts --email dev.test@ajdaa.sa --name "Dev Test User" --password x` → "--password is not allowed: passwords are never accepted on the command line or via environment variables.", exit 1.
- `echo "wrongname" | npx tsx scripts/create-dev-user.ts --email dev.test2@ajdaa.sa --name "Dev Test User 2" --generate` → "Confirmation aborted: typed name did not match the database name.", exit 1 (no write).
- `echo "dev.db" | npx tsx scripts/create-dev-user.ts --email dev.test@ajdaa.sa --name "Dev Test User" --reset-password --generate` → reset password succeeded, exit 0, role/permissions untouched.
- Test users `dev.test@ajdaa.sa` and `dev.test2@ajdaa.sa` deleted from `dev.db` afterwards via `prisma.adminUser.deleteMany`.

Browser sign-in verification (web 5193, API 4014, confirm every sidebar section visible): **NOT run** — dev servers not started in this session. Marked unverified.

## Decisions made

- `departmentId` is computed the same way `seed.ts` does (`dept_` + MD5 of `الإدارة التنفيذية`) so the row is consistent with the seeded super admin entry (joins on `departmentId` work).
- Password is never accepted as a CLI argument or environment variable; `--password` is explicitly rejected as an unknown/forbidden flag.
- `--yes` is only allowed when the database name ends with `_test` or the database is local (SQLite `file:` URL); never for production.
- Confirmation requires typing the exact database name (`yes` is not enough); `--yes` skips this only for test/local databases.
- `loginFailureTracker.recordSuccess(email)` is used to clear lockout on `--reset-password`, the same mechanism `loginFailureService` uses.
- `passwordChangedAt` is stamped to `now` so all previously issued tokens are revoked.
- `role_super_admin` role is read, not created; the script aborts with a clear message if it does not exist.
- `DATABASE_URL` is read via dotenv (`server/.env` when run from `server/`); `src/config/env` is not imported because it exits the process on missing production secrets.
- Errors never print secrets or the full `DATABASE_URL` — only the parsed database name.
- Did not touch `src/`, `server/prisma/seed.ts`, schema, migrations, admin UI, auth routes, or CI. Did not commit, did not install dependencies, did not touch `.env*`.

## Guard results

### clean-code-guard
- Guard pass run over the diff: no violations found.
- Functions are small (≤20 lines), names reveal intent, errors are specific and propagated, no broad catch-all swallowing.
- One exception to imperative 4 (four arguments max): `buildDevUserData` takes 5 parameters. Justification: it mirrors the Prisma `AdminUser.create` payload shape (email, name, phone, passwordHash, departmentId) — a data DTO, not a boolean-flag function. Revisit if a sixth field is ever needed.
- `clean-code-guard: clean (1 documented exception: buildDevUserData 5 params)`

### test-guard
- `server/test/devUser.test.ts`: 26 behaviour-focused tests, data-driven variants (`it.each` for emails/names), no test without a bug it catches (rejects bad emails, short names, `--password`, unknown flags, non-policy passwords).
- Mocks only at system boundaries (none needed — pure functions).
- `test-guard: clean`

### docs-guard
- `deploy/README-deploy.md` §3.4.2: every command, flag, and path checked against the code (`npm run user:create-dev --`, `--email`, `--name`, `--generate`, `--reset-password`, `server/.env`, database name ending `_test`, ports match the README's instance table).
- `docs-guard: clean`

## Anything the owner must know before running on servers

- The script reads `DATABASE_URL` from `server/.env` (Prisma loads it when run from `server/`). It prints only the database name — never the URL, host, user, or password.
- Production use: `--yes` is **not** allowed; the owner must type the database name to confirm. Run by hand only, never from CI.
- The generated password is printed once to the terminal and never written to any file or log; the owner must communicate it securely and the user must change it at first login.
- The account signs in through the normal login flow (password, plus email code if `loginOtpEnabled` is set for the account or globally).
- Before running on production, ensure `NODE_ENV=production` is set and the `role_super_admin` role exists (run migrations/seed first).
- Test instance database name must end with `_test`; local SQLite (`file:`) databases are also allowed with `--yes`.
