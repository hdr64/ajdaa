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
- Login translate + improve: done on `main` (2026-10-26, `src/i18n/admin/auth.ts` and `src/components/admin/auth/*`) after the auth lane merged; needs the browser pass listed in `docs/TODO.md` item 1.
- Review findings fixed by these tasks: `/admin/pastProjects` deep link, past-project dialog (Esc loses data, raw "Invalid URL", native alert, no success toast), native `window.confirm` in 3 dialogs, toast has no error kind, uneven toasts, past-works empty text hard-coded Arabic, empty dashboard chart. Public-site minor items (careers file input, title spacing, past-works empty text): `task-w4-public-polish-prompt.md`.

## Auth follow-ups (owner, 2026-10-23)
- Verification email also carries a 6-digit code; a pending user can open the admin login page and verify with the code.
- New permission: mark a user as verified from admin Users (super admin always has it).
- Create-user form: checkbox "send the password in the email".
(Prompt, done: `docs/prompts/_archive/w3/task-w3-auth-a2-prompt.md`)

## Code-quality review (owner, 2026-10-23)
- Reusable full review prompt (security, bugs, clean code, UI, perf, tests, ops, docs, i18n): `docs/prompts/code-quality-review-prompt.md`. Output `code-quality-review.md` (previous reports archived in `docs/reviews/`). Run any time and after every major update.

## Inquiry detail page (owner, 2026-10-25)
- In admin Inquiries the owner cannot open an item. Add `/admin/inquiries/:id` showing one inquiry (list rows open it; notification email and desktop notification link to it). Done; prompt and report in `docs/prompts/_archive/w5/`.

## Production readiness (Claude check, 2026-10-25)
- Done; prompts in `docs/prompts/_archive/w5/`: `task-w5-ready-a-prompt.md` (dependency security upgrades: `@fastify/jwt`/`fast-jwt`, `@fastify/static`, patches) and `task-w5-ready-b-prompt.md` (dedicated `SETTINGS_ENCRYPTION_KEY` required in production, proxy-trust warning, React error boundary, migration for the mojibake defaults and indexes). Owner checklist items found: set `TRUST_PROXY=1` and `HOST=127.0.0.1` in production `.env`; set `SETTINGS_ENCRYPTION_KEY` before anyone enrols TOTP.

## Careers visibility (owner, 2026-10-25)
- Floating "Jobs" button on the public site (label renamed from "Apply for a job" to "Jobs" / "الوظائف", owner 2026-10-25); admin can show/hide the footer item and the floating button independently (site settings `careers.showFooterLink`, `careers.showFloatingButton`). Done; prompt in `docs/prompts/_archive/w5/`.

Owner request (2026-10-25): production-grade improvements to the admin dashboard. Audit done: `docs/admin-audit.md` (P0 security/data safety, P1 reliability, P2 usefulness, P3 design/a11y, split into w6 tasks). Browser pass still to do.

## Docs cleanup (owner, 2026-10-26)
- "Review the project and clean up the docs": docs re-checked against the code; the stale deployment guide and the duplicate DB-copy note removed, README reduced to setup and gates, API route index added, finished prompts and review reports archived, TODO rewritten. See `docs/README.md` for the documentation rules.

## Nav: Past Works missing, "Book a Viewing" shown as a button (owner, 2026-10-26)
- Code defaults were already right (`DEFAULT_NAV_ITEMS`, `defaultCmsContent.ts`); the stored `nav` row in older databases overrides them. Fixed with the data migration `20261026100000_nav_past_works_booking_link` (adds the Past Works entry if missing, sets booking `isCta:false`). Run on the test instance first, then production after a backup.

## OTP email ownership verification before activation (owner, 2026-10-27)
- In the admin dashboard (Profile -> Two-Step Login OTP), activating OTP must verify email ownership before activating OTP:
  - Step 1: user enters current password to confirm the action, triggering a 6-digit verification code sent to their email address.
  - Step 2: user enters the verification code in the dialog to prove access/ownership of the email address.
  - Only after successful code verification is OTP activated (`loginOtpEnabled: true`) and `emailVerifiedAt` recorded.
  - Never enable OTP before verifying the email ownership. Disabling OTP remains password-protected without code.

## Admin Profile Page UI/UX Redesign (owner, 2026-10-27)
- Redesigned `/admin/profile` from a plain, vertically stacked layout into an executive-grade SaaS profile experience:
  - Fixed reversed/scrambled Arabic role title (`ماظنلا ماع ريدم (Super Admin)`) using bidirectional isolation `<bdi>` and clean Arabic role normalization (`getRoleLabel`).
  - Added modern ambient hero card with soft mesh gradient banner, active account pulsing indicator, squircle avatar with camera overlay, integrated photo upload/remove controls, and scannable interactive security tiles.
  - Implemented sleek segmented tab navigation:
    - **Personal Profile (البيانات الشخصية)**: 2-column layout with personal details form, verified email indicator, and structured Account & System Identity card.
    - **Security & Access (الأمان والتحقق)**: Security health banner (emerald protected status or amber recommendation), Two-Step Login OTP (with 2-step email verification modal), Authenticator App (TOTP), Passkeys (WebAuthn), and Change Password.
    - **Preferences (التفضيلات)**: Integrated confirmation dialog choices (`ConfirmChoicesCard`).

## Automatic Project Booking Detection & Lightweight Data Upload (owner, 2026-10-27)
- **Automatic "محجوز" / "محجوز بالكامل" Detection**:
  - The booking and availability status under a project is now detected automatically from the live state of its units across all floors, eliminating manual entry of "محجوز" in the project edit form:
    - If `totalUnits === 1` and the unit is `reserved` -> status is automatically `محجوز` (Reserved) with `isBooked: true`. If `rented` -> `مؤجر`, if `sold` -> `مباع`.
    - If `totalUnits > 1` and all units are unavailable (`available === 0`) -> status is automatically `محجوز بالكامل` (Fully Booked) with `isBooked: true` (or `مؤجر بالكامل` / `مباع بالكامل` when all rented / sold).
    - If units are available -> status reflects availability (`متاح للتأجير`, `متاح للبيع`, or `متاح للتأجير والاستثمار`).
    - Fallback: when a project has no unit breakdown in the database, `detectProjectStatus` and `isPropertyBooked` recognize `'محجوز'` as `isBooked: true` (previously only checked `'محجوز بالكامل'`).
  - Implemented and wired across:
    - Server: `server/src/services/serializers.ts` (`detectProjectStatus` and `serializeProject`).
    - Server routes: `server/src/routes/units.routes.ts` (`syncParentProjectStatus` auto-updates `Project.status` & `statusEn` on unit patch, create, put, and delete).
    - Client data layer: `src/data/properties.ts` (`detectProjectStatus`, `isPropertyBooked`, and `getPropertyDisplay`).
    - Client realtime: `src/hooks/useRealtimeUnits.ts` (`applyUnitStatus` and `removeUnit` recalculate project status live on WebSocket updates).
    - Admin UI:
      - `src/pages/admin/sections/ProjectUnitsPanel.tsx`: optimistic status update recalculates project status immediately.
      - `src/pages/admin/sections/ProjectShowSection.tsx`: displays auto-detected status with `(تلقائي من الوحدات)` indicator.
      - `src/pages/admin/sections/ProjectEditSection.tsx`: displays auto-detected status banner, placeholders, and a button to reset/empty manual status to rely on automatic detection.
    - Public UI: `src/components/common/PropertyCard.tsx`, `src/pages/ProjectDetailPage.tsx`, and `src/components/home/InteractiveProjectsMap.tsx`.
- **Minimal Data Upload Optimization ("Upload less data as possible")**:
  - In `src/services/mediaService.ts`, added in-browser canvas-based image optimization (`compressImageBeforeUpload`):
    - Oversized raster images (> 400KB) are resized to max 2048px dimension and converted to WebP (0.82 quality) before transmission, reducing 10MB-20MB camera uploads down to ~200KB-300KB (up to 98% bandwidth reduction).
    - GIFs, SVGs, and PDFs remain unaltered.
  - Status updates (`PATCH /api/units/:id/status`) transfer only the minimal payload `{ status }` (< 30 bytes) while automatically synchronizing the parent project's state.

## Admin User & Role Management UI/UX Redesign (from tmp/user, 2026-10-27)
- **Role Cards (`RoleCards.tsx`)**:
  - Converted the layout to a balanced 2×2 grid (`grid-cols-1 sm:grid-cols-2`), eliminating orphan cards.
  - Replaced the repetitive "م" avatar with distinctive, role-specific icons:
    - Super Admin: gold `ShieldCheck`.
    - Project & Development Manager: blue `Building2`.
    - Sales & Leasing Agent: emerald `TrendingUp`.
    - Investment Analyst / Viewer: purple `BarChart3`.
  - Allowed role names to wrap naturally over up to 2 lines without truncation ellipsis.
  - Super Admin counter now accurately shows "كل الـ 18 صلاحية" ("All 18 permissions") on one line.
  - Added integrated capability previews ("✓ Can / ✕ Cannot") directly on each role card so admins don't need to open advanced permissions to understand a role.
  - Added confirmation guard when selecting the Super Admin role.
- **Permissions Grid (`PermissionGrid.tsx`)**:
  - Moved the expand/collapse toggle from a floating pill at the bottom into the section header, eliminating card overlap and bottom clipping.
  - Replaced the large collapsed-state blank space with a clean, informative summary card displaying active count and category breakdown (e.g. `4 من 18: المشاريع (3) · طلبات الاهتمام (1)`).
  - Added group-level checkboxes with indeterminate states and `(x/y)` counts for instant group selection.
  - Added parent-child cascading logic (`manageProjects` automatically selects and enforces all project sub-permissions; edit implies view).
  - Added `حساس` (`Sensitive`) indicator badges for critical actions (`deleteProject`, `manageUsers`, `exportData`, etc.).
  - Added detailed diff tags showing `+X مضافة` and `-Y مستبعدة عن الدور` with a direct "استعادة الافتراضي" (Reset to role defaults) action.
- **Creation Wizard (`UserCreateWizard.tsx` & `Stepper.tsx`)**:
  - Defaulted creation mode to `invite` (safer security posture: users set their own password via emailed link).
  - Added dynamic Step 3 label: "مراجعة وإرسال الدعوة" ("Review & Invite") when in invite mode.
  - Added instant duplicate email validation on field blur (`handleEmailBlur`), warning admins immediately instead of waiting for final submit.
  - Added dynamic footer helper text (`stepHint`) that clearly explains why the "Next" button is disabled on each step.
- **Edit Dialog (`UserFormDialog.tsx`)**:
  - Replaced two rows of role cards in edit mode with a compact current role card and a "تغيير الدور" (Change Role) toggle, preventing Department and Permissions from being pushed off-screen.
  - Added confirmation guard when switching roles if custom permissions exist, warning how many modifications will be reset.
  - Updated footer copy to accurately state that changes take effect when saved and are recorded in the audit log.

