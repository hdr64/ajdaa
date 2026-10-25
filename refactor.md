# Owner requests (recorded 2026-10-21)

Must-have, ASAP (all "simple"): notes 1-5. Then 6-8.

1. New page "our old projects": admin adds a project (title, category, image, gallery, description, ...).
2. 3D model: add a model URL from the admin page.
3. Public project page: "download project profile PDF" button, wired to admin (`brochureUrl`).
   - Bug reported by admin: PDF uploaded when creating a project is not shown on the project page or card. Verified: no public component reads `brochureUrl`.
4. Some project properties are not editable in the admin dashboard.
5. Employee/jobs:
   - 5.1 Footer link "apply to a job". Form: name, phone, email required; description and CV (PDF) optional. Which fields are required is configurable in admin.
   - 5.2 Admin "employee applications" page listing all applications; email notification to admin on new application; recipient emails configurable.
6. Full review of admin UI design and functionality (missing or poor domain features).
7. Finish missing / unimplemented features.
8. Production-ready checkup.

Decisions (owner): no hard-coded data may stay in `src/data/properties.ts` (everything from Postgres). SEO is a separate task after notes 1-5. Admin dashboard: Arabic first, English later. Deploys happen at midnight; a few seconds of downtime is fine. 1-5 admin users.

Deployment policy (owner, 2026-10-21): no automated command may ever touch the production database or its data. GitHub Actions deploys ONLY to the test instance (`/srv/ajda/test`, DB `ajda_test`, a copy of the prod DB). The owner deploys production by hand, once, after users test `test-ajda` and the owner approves. The first deployment of the site is also done by the owner by hand.

Owner request (2026-10-22): improve the admin UI design; simplify the user creation dialog (wizard or a better idea).
- Users wizard: separate task (`task-w2-users-wizard-prompt.md`), files `src/components/admin/users/*` only.
- Wider admin design pass belongs to note 6 (wave 3): start with a read-only audit of the admin screens before prescribing changes.

Owner request (2026-10-22): admin login convenience and security.
- Show/hide password eye button on the admin login: `task-w3-login-eye-prompt.md` (run in the main repo).
- Auth hardening, three sequential tasks on worktree `ajda-wt/auth` (branch `lane/auth`): A `task-w3-auth-a-prompt.md` email verification (invite user by link where the user sets their own password, or create user with a password that must be verified by email; emailed code to confirm password changes; super admin exempt; forgot-password flow verified), B `task-w3-auth-b-prompt.md` authenticator-app 2FA (TOTP) with recovery codes, C `task-w3-auth-c-prompt.md` passkeys as a full sign-in alternative to password + code (owner decision). Email-code login and forgot-password by email already existed.

Owner request (2026-10-22): UI review of the admin (details, dialogs, toasts, feedback) plus: translate the whole admin dashboard to English, translate and improve the login.
- Spec: `docs/ADMIN-I18N.md`. Order: `task-w4-i18n-core-prompt.md` (infrastructure, shell, typed toasts, deep-link fix) -> then lanes `task-w4-i18n-l1/l2/l3-prompt.md` in parallel. `task-w4-i18n-server-prompt.md` (localised API messages) can run in parallel with core.
- Login translate + improve: NOT started on purpose; it rewrites the same files as the auth lane (`ajda-wt/auth`, tasks A/B/C: email verification, TOTP, passkeys). Write its prompt after the auth lane merges.
- Review findings fixed by these tasks: `/admin/pastProjects` deep link, past-project dialog (Esc loses data, raw "Invalid URL", native alert, no success toast), native `window.confirm` in 3 dialogs, toast has no error kind, uneven toasts, past-works empty text hard-coded Arabic, empty dashboard chart. Public-site minor items (careers file input, title spacing, past-works empty text): `task-w4-public-polish-prompt.md`.

## Auth follow-ups (owner, 2026-10-23)
- Verification email also carries a 6-digit code; a pending user can open the admin login page and verify with the code.
- New permission: mark a user as verified from admin Users (super admin always has it).
- Create-user form: checkbox "send the password in the email".
(Prompt: `docs/prompts/task-w3-auth-a2-prompt.md`)

## Code-quality review (owner, 2026-10-23)
- Reusable full review prompt (security, bugs, clean code, UI, perf, tests, ops, docs, i18n): `docs/prompts/code-quality-review-prompt.md`. Output `code-quality-review.md` (previous reports archived in `docs/reviews/`). Run any time and after every major update.

## Inquiry detail page (owner, 2026-10-25)
- In admin Inquiries the owner cannot open an item. Add `/admin/inquiries/:id` showing one inquiry (list rows open it; notification email and desktop notification link to it). Prompt: `docs/prompts/task-w5-inquiry-detail-prompt.md`.

## Production readiness (Claude check, 2026-10-25)
- Prompts `docs/prompts/task-w5-ready-a-prompt.md` (dependency security upgrades: `@fastify/jwt`/`fast-jwt`, `@fastify/static`, patches) and `task-w5-ready-b-prompt.md` (dedicated `SETTINGS_ENCRYPTION_KEY` required in production, proxy-trust warning, React error boundary, migration for the mojibake defaults and indexes). Owner checklist items found: set `TRUST_PROXY=1` and `HOST=127.0.0.1` in production `.env`; set `SETTINGS_ENCRYPTION_KEY` before anyone enrols TOTP.

## Careers visibility (owner, 2026-10-25)
- Floating "Jobs" button on the public site (label renamed from "Apply for a job" to "Jobs" / "الوظائف", owner 2026-10-25); admin can show/hide the footer item and the floating button independently (site settings `careers.showFooterLink`, `careers.showFloatingButton`). Prompt: `docs/prompts/task-w5-careers-toggle-prompt.md`.
