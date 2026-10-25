# Task w5-ready-a — dependency security upgrades (production readiness)

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). Run this **before** `task-w5-ready-b-prompt.md`; both edit the main working tree.

## Goal

`npm audit --omit=dev` in `server/` reports 2 critical and 6 high findings, and the client has 2 high (Vite). Upgrade to patched versions without changing behaviour. The one that matters most is `fast-jwt` (used by `@fastify/jwt` 9.x, our admin token signing and verification): ten advisories, among them an expired-token cache bypass and claim-validator bypasses. Our tokens are HS256 with a 32+ character secret, so several do not apply, but the library must still be current before production.

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply)
- `server/package.json`, `package.json`, `server/src/app.ts` (jwt and static registration, upload serving), `server/src/middleware/auth.ts`, `server/src/sockets/index.ts` (both call `jwt.verify`), `server/src/services/imageService.ts` or wherever `sharp` is used (`grep -rn "sharp" server/src`), `server/test/helpers.ts`

## Decided design

Upgrade, in this order, running `npm --prefix server run build` and `npm --prefix server test` after each step. Roll a step back and report it if it cannot be made green without changing behaviour.

1. `@fastify/jwt` 9.x → `10.2.5` (pulls patched `fast-jwt`). Check its release notes for API changes: `request.jwtVerify()`, `fastify.jwt.sign/verify` and the `request.user` typing in `server/src/types/fastify.d.ts` must keep working. Keep the explicit `algorithm: 'HS256'` behaviour (set it explicitly in the `sign` and `verify` options if the new version no longer pins it) so a token with `alg: none` or another algorithm is rejected.
2. `@fastify/static` 8.x → `10.1.7`. The `/uploads/` serving behaviour must not change (headers, PDF `Content-Disposition: attachment`, no directory listing, a traversal path returns 404).
3. Patch/minor bumps that `npm audit` marks fixable without a major: `fastify`, `nodemailer`, `prisma` and `@prisma/client` (same version for both; run `npx prisma generate` afterwards), and the transitive `fast-uri`, `ip-address`, `deepmerge-ts`, `@prisma/config`. Use `npm audit fix` in `server/` **without** `--force`.
4. `sharp` 0.33 → the audit's fixed version (0.35.x) **only if** every image-upload test passes unchanged and a real WebP re-encode of a sample JPEG and PNG still works; otherwise leave it and report why. It processes admin-uploaded images only.
5. Client: `npm audit fix` in the repo root (Vite patch; dev-server only, but cheap). No `--force`.
6. `zod` 3 → 4 is a **major** change touching every schema: do **not** upgrade it. Report the advisory (memory exhaustion on oversized constrained collections) as accepted risk.

Add focused tests only where behaviour could silently change: a token signed with another algorithm or with `alg: none` is rejected by `authenticate`; an expired token is rejected; `GET /uploads/..%2f..%2fpackage.json` and a directory path return 404. Each test must fail if you temporarily break the guarded behaviour.

## Out of scope

Everything not listed. No schema or migration changes. No behaviour changes to auth, uploads or mail. No `zod` upgrade.

## Constraints

- No commits, no `.env*` reads or writes, no production commands. Installs are allowed here because upgrading is the task; touch only `package.json`/`package-lock.json` in the root and `server/`, and the source lines an API change forces.
- Preserve each file's line endings.

## Gates (paste real output)

- `npm --prefix server run build`, `npm --prefix server test` (all green, same or higher test count), `npm run lint`, `npm run build`
- `npm audit --omit=dev` before and after for `server/` and the root (counts by severity, and which packages remain with why)

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-ready-a-report.md`: versions before and after, gate and audit output, any step rolled back and why, tests added with the assertion that fails without the guard, accepted risks, and `## Guard results` as required by `docs/TODO.md` section 3.
