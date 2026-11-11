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

---

### Dashboard & Analytics Overhaul (`tmp/dashboard`)
- **Action Before Analysis**:
  - Added new `NeedsAttentionStrip` component at the very top of `OverviewSection`: immediately surfaces leads untouched for >24 hours with an alert badge and 1-click action ("متابعة الطلبات"), flags unpublished draft projects ("مراجعة المسودة"), and provides an "All clear" reassurance state when everything is on track.
  - Reorganized dashboard layout to place the actionable Inquiries list side-by-side with the Unit Status Chart (`7:5` column ratio on large screens): leads are front and center rather than tucked away below the fold.
  - On each inquiry row, added direct `PhoneCallLink` (`tel:`) in addition to `WhatsAppLink`, clickable project badge linking to project details, and human-readable relative time ("منذ ساعتين", "منذ 3 أيام") with full datetime tooltip. Added high-visibility warning badge for leads awaiting follow-up.
  - Moved weekly inquiries trend chart to a dedicated bottom analytics row, eliminating stretched cards and awkward empty space.
- **Unified & Clickable KPI Row**:
  - Standardized structure across all 4 KPI cards: Category label with icon container, headline metric with explicit Arabic/English units ("مشروع", "وحدة", "طلب"), secondary sub-metric, and interactive micro-visual footer.
  - Made every KPI card directly clickable with hover lift and cursor pointer (`projects`, `units`, `inquiries`).
  - **Resolved Green Meaning Conflict**: Decoupled the occupancy card theme to Indigo/Brand while implementing a multi-status segmented progress bar (Available = Emerald, Reserved = Amber, Rented = Sky, Sold = Slate). Green now exclusively and consistently represents "Available" across all cards, charts, and maps.
- **Unit Status & Vacancy Chart (`UnitStatusChart.tsx`)**:
  - **Bar Total Placement**: Placed project totals directly adjacent to the end of each bar, eliminating hundreds of pixels of blank whitespace that previously separated counts on shorter bars.
  - **Interactive Sorting**: Added sort mode switcher allowing leasing/sales teams to sort by "الأكثر شواغر (الوحدات المتاحة)" (Vacancy first), "إجمالي الوحدات", or "نسبة الإشغال".
  - **Interactive Status Filtering**: Clicking any status badge in the legend highlights that status across all project bars and dims others.
  - **Table View Enhancements**: Added `% المتاح` (Vacancy rate) and `% الإشغال` (Occupancy rate) per project row with direct click-through links to project details.
- **Legibility & Contrast**:
  - Increased font sizes and contrast for subtitles, axes, legends, and secondary text from 10px light gray to 12px/13px bold and high-contrast tokens.
  - Simplified and clarified metadata lines.
- **Header & Navigation Polish**:
  - Added live "آخر تحديث" (Last updated) relative timestamp indicator with Clock icon and full datetime tooltip in `AdminPageHeader.tsx`, automatically synchronized with data refreshes and realtime updates.
  - Added explicit tooltips and accessible labels for all 5 sidebar footer buttons (Theme, Identity Variant, Collapse/Expand, Open Live Site, Logout).
  - Clarified sidebar badge tooltips to explain draft counts vs total units vs new inquiries.
- **Unit Card Status Accent (`BuildingVisualizer.tsx`)**:
  - Reduced the unit card status accent border width from `border-s-4` (4px) to `border-s-2` (2px), halving its thickness for a cleaner, modern, and sleeker appearance that eliminates the heavy visual dominance.

### User Creation Wizard UI/UX Polish (`UserCreateWizard.tsx`, `RoleCards.tsx`, `Stepper.tsx`, `UserFormDialog.tsx`)
- **Stepper Connector Line Width Halved (`Stepper.tsx`)**:
  - Reduced the connector bar between wizard steps from `w-16` (64px) to `w-8` (32px) and added `rounded-full`, halving its width to create a proportional, balanced, and elegant stepper header.
- **Role Cards Polish & Layout Collision Fix (`RoleCards.tsx`)**:
  - **Clean Title Normalization**: Removed the embedded English parentheticals (e.g. `(Super Admin)`) from Arabic role names (`مدير عام النظام`) that previously caused ugly two-line wrapping like `مدير عام النظام (Super` and `(Admin`.
  - **Bilingual Descriptions**: Replaced raw seeded English descriptions with curated, professional Arabic and English descriptions for all 4 roles.
  - **Symmetrical 2-Row Highlights**: Balanced the highlights container across all 4 cards so that Super Admin and regular roles have exactly two harmonious rows, eliminating uneven heights.
  - **Footer Overlap Resolution**: Replaced the 30-character badge (`تملك كل الصلاحيات بحكم الدور`) with a concise badge (`شاملة تلقائياً` / `Full Access`), completely eliminating text collision with the permission counts.
  - **Radio Choice Indicator**: Added explicit unselected radio rings that transition to filled checkmarks upon selection for clear affordance.
- **Department Selector Redesign (`UserCreateWizard.tsx`)**:
  - Transformed the department selector from an awkward, vertically stacked bare input into a cohesive settings card with a `Briefcase` icon, clean title, helpful hint, and compact dropdown.
- **Permission Customization & Guidance State (`PermissionGrid.tsx` & `UserCreateWizard.tsx`)**:
  - Removed duplicate `<PermissionSummary>` component that previously rendered redundant summaries and chevrons.
  - Added an informative placeholder state when no role is selected (`اختر دوراً وظيفياً أعلاه لعرض الصلاحيات الممنوحة وإمكانية تخصيصها`), preventing confusing `0 من 18 صلاحية مفعلة [✓]` displays before a role is picked.
  - Deduplicated customize buttons so that the collapsed card acts as a single clean toggle.
- **Strict Wizard Submission Guard (`UserCreateWizard.tsx`)**:
  - Fixed a critical premature creation issue: previously, if the outer `<form>` triggered a submission on Step 1 or Step 2 (e.g. pressing Enter or click propagation), `handleSubmit` checked all step errors across the board; since Step 3 in invite mode required no password, all steps passed validation and immediately created the user and sent the invitation without reaching Step 3.
  - Added an explicit guard: `if (step < 3) { goNext(); return; }` in `handleSubmit` and intercepted Enter key across all elements so premature submission is impossible.
- **Account Setup Method Switcher in Step 3 (`UserCreateWizard.tsx`)**:
  - Empowered the admin to choose or switch between **"إرسال رابط دعوة" (Send Invitation Link via Email)** and **"تعيين كلمة مرور الآن" (Set Account Password Now)** directly on Step 3, rather than hiding this choice exclusively in Step 1.
  - In Password mode: renders password field, password generator, copy button, strength checklist, and optional email password checkbox.
  - In Invite mode: displays a clean informational alert explaining that the user will set their own password via the email link.
  - Updated the final action button: explicitly says `إرسال رابط الدعوة وإنشاء الحساب` (Send Invitation & Create Account) or `إنشاء الحساب بكلمة المرور` (Create Account with Password), ensuring user creation ONLY occurs upon explicitly clicking this final button.
- **Expandable Role Cards Redesign (`RoleCards.tsx`)**:
  - Redesigned role cards into compact, modern cards showing minimal data in their collapsed default state (radio selection ring, role icon, title, 1-line subtitle, permission count pill, and expand toggle chevron).
  - Reduced default card height from ~180px to ~58px, saving over 240px of vertical modal space and keeping the entire Step 2 neatly in viewport without awkward modal scrolling.
  - Full details (expanded description, symmetrical 2-row capability highlights, and scope footer) are cleanly revealed when clicking the expand chevron.
  - Added `items-start` to grid container so expanding one card does not stretch or deform its neighbor.
  - Stopped click propagation on expand toggles so admins can inspect role capabilities without inadvertently changing their selection or triggering confirmation prompts.
- **Complete Removal of `super_admin` Role from User Creation (`UserCreateWizard.tsx`, `RoleCards.tsx`, `UserFormDialog.tsx`)**:
  - Filtered out `super_admin` completely from assignable roles in the User Creation Wizard (`assignableRoles = useMemo(() => roles.filter((r) => r.key !== 'super_admin'), [roles])`).
  - Enforced `canAssignSuperAdmin={false}` and removed all dead `selectedRoleIsSuperAdmin` code paths from the creation wizard (status selectors, email overrides).
  - Added step validation and selection guards in `UserCreateWizard` so that `super_admin` cannot be selected or submitted under any circumstance.
  - Cleaned up `UserCreateWizardProps` and `UserFormDialog.tsx` to eliminate unused props and resolve all TypeScript lint/build warnings.


- 2026-11-06 (owner): Google shows a globe instead of the site icon, and wants proper SEO. Done: 48/96 px favicons and a multi-size ICO; SEO shell (per-page meta, OG, JSON-LD, sitemap, robots, `SEO_INDEXING` flag); client head hook and real `<a href>` links. See docs/architecture.md section 12.

- 2026-11-06 (owner): "fix them all" after the SEO review. Prompts written: task-seo-c (finish client links/images/headings), task-seo-d (readable project URLs, no migration), task-seo-e (English version at /en with hreflang). Run in that order. Deploy with indexing on and Search Console remain owner actions (docs/TODO.md item 7).

- 2026-11-06 (owner): CMS review: public content shown with no admin control (project-page six-card amenities block, "made in KSA" footer line, works-page "Certified/Ready" badges, contact trust bullets, hard-coded map region counts, Past Works and Careers copy). Prompts written: task-cms-a (project page, delete fake amenities, 4K/EN fixes), task-cms-b (works badges, contact trust CMS, footer madeInKsa toggle), task-cms-c (map regions from data, featured hint), task-cms-d (Past Works and Careers CMS, run after b). Deviation from the first plan: no new amenities field, the existing per-project `features` list already covers it.

- 2026-11-07 (owner): how to submit the sitemap; DNS verification not possible, so the HTML-file method is used (`public/googleeb9c61398accaddd.html`). Final production SEO review done; project pages are indexable, three have thin descriptions. Owner actions recorded in salah-tasks.md section H. Open for Claude: `/projects/<id>` returns 200 with a canonical to the slug URL instead of a 301 (minor, optional follow-up).

- 2026-11-07 (owner): Folder storage feature (Google Drive-like) in the admin website. Manage all files, upload/download, trash/recycle bin, RBAC permissions to create folders/files and organize. Reusable picker to choose a 3D model, PDF brochure, or images from the storage library or upload directly for projects and CMS. 3D models can be up to 1GB (resumable chunked upload, stream pipe to disk, byte-range delivery, interactive 3D WebGL viewer). Architectural plan written to `storage-library-plan.md`.

- 2026-11-08 (owner): Show project as a Google Search product with main image, gallery images, and more information (based on uploaded screenshot of Google search for "أجدا برايم"). Implemented both: (1) SEO structured data (JSON-LD) upgraded on server (`server/src/services/seo/jsonld.ts`) and client (`src/seo/pageMeta.ts`) to emit Google Product Schema with full gallery images array, offers, ratings, and PropertyValue specifications, alongside LocalBusiness/Place schema for Google Knowledge Panel; (2) Live interactive Google Search Product & Knowledge Panel Preview component (`src/components/admin/projects/GoogleSearchProductPreview.tsx`) embedded directly in the admin project editor (`ProjectEditSection.tsx`) with real-time editing sync, Desktop/Mobile view, Dark/Light Google SERP modes, multi-image carousel strip, AI overview preview, and Schema JSON-LD copy/test tools. Positioned at the top of the project editor, collapsible and collapsed by default into a slim summary bar, and automatically synchronized to the active website theme (Light/Dark via `useTheme`).

- 2026-11-08 (owner): Storage Library Step 0 — Media Library Integration & SEO Permanent Image Safety:
  - **Prisma & Database Indexing**: Added `MediaFile` model with `url`, `filename`, `originalName`, `mimeType`, `fileType`, `size`, `storageKey`, `thumbnailUrl`, `metadata`, and timestamps. Generated PostgreSQL migration `20261108100000_media_library` with indexes and super admin backfill. Auto-syncs disk media from `/uploads/` recursively (including `seed/`).
  - **Permissions System**: Registered `manageMedia` across all 4 permission definitions (`server/src/config/permissions.ts`, `server/src/types/fastify.d.ts`, `src/types/admin.ts`, `src/components/admin/users/usersModel.ts`) with seamless fallback inheritance to `manageProjects || manageCms`.
  - **Usage Tracking Service (`mediaUsageService.ts`)**: Scans references across `Project` (`image`, `gallery`, `brochureUrl`, `model3dUrl`), `PastProject` (`image`, `gallery`, `pdfUrl`), `CmsClient` (`logo`), `CmsSection` (content payloads), `AdminUser` (`avatar`), `DeveloperNote` (`screenshotUrl`), and `AppSetting` (`value`).
  - **Strict SEO URL & Deletion Protection**:
    - Established `/uploads/...` URLs remain permanent and immutable.
    - Removing an image or brochure from a project form **only unlinks** the field from that project record; it never deletes the physical media file.
    - `DELETE /api/media/:id` strictly blocks deletion (HTTP 409 Conflict) whenever `usageCount > 0`, citing referencing entities and warning that active URLs must not be broken for Google Search & Google Images ranking.
    - Deletion is permitted only for orphaned files (`usageCount === 0`) directly from the Media Library.
  - **Admin UI & Reusable Modal**:
    - Created Media Library page (`/admin/media`) with stats cards, Linked/Orphaned filters, type tabs, search, lightbox, and copy URL.
    - Built reusable `<MediaPickerModal />` with dual tabs ("Choose from Library" and "Upload New").
    - Integrated `<MediaPickerModal />` and library selection into `ProjectCreateModal`, `ProjectEditSection`, `PastProjectFormDialog`, and `CmsClientsPanel`.
  - **Verification & Tests**: Added unit and integration tests in `server/test/media.test.ts` verifying `MediaFile` creation, pagination, live usage checks, and 409 Conflict SEO deletion blocking. Passed Vite build, Server TypeScript build, and Vitest suite.

- 2026-11-09 (owner): Add `/projects` as a second route to the projects page (`/works`).
  - Added `/projects` to `PAGE_BY_PATH` in `server/src/services/seo/pages.ts` mapping to `'works'`. Serves the exact same prerendered HTML shell with canonical pointing to `/works` (`/en/works` for `/en/projects`). Does not interfere with single project routes (`/projects/:id` or `/projects/:slug-:id`).
  - Added `/projects` support in client `parsePath` (`src/App.tsx`), routing cleanly to `{ page: 'works' }`. Preserved `/projects` and `/en/projects` in the browser address bar on initial load via `window.history.replaceState`.

- 2026-11-11 (owner): Project edit page, "Brochure and 3D model" card: let the admin choose the 3D model from the media library, not only paste a URL. Prompt: `docs/prompts/task-model3d-library-prompt.md`.

- 2026-11-11 (owner): 3D card = 3D model, video or HTML page, each also as a .zip that the server extracts into a folder; the picker returns to the library list of the chosen type. Done (no migration; own zip reader on zlib, no new dependency).

- 2026-11-11 (owner): permanent slug URLs for library files (/f/<slug>, /html/<slug>/), copy-URL everywhere (media page + picker), HTML page as the project 3D view. Done (step 1). Step 2 asked: a separate Drive area (folders, upload files/folders, move, copy, rename, trash) while the media library stays as is.

- 2026-11-11 (owner): Step 2: Google-Drive-like file and folder management (copy, move, trash, folders), optionally as a separate Drive area; owner delegated the choice ("chose the best recommended options"). Done as a separate **Drive** section (media library untouched): virtual folders, upload of files/folders/drag-drop, rename, move, copy, trash/restore/purge, search, optional permanent share link `/d/<slug>`; reuses `manageMedia` (no new permission). Files stored in `PRIVATE_DIR/drive`, so nothing is public unless shared, and unsafe types always download. New migration `20261112100000_drive`. Tests: `server/test/drive.test.ts` (not run, Prisma guard: owner runs `! npm --prefix server test`). Not browser-verified (Chrome extension offline).

- 2026-11-11 (owner): Drive uploads can be 5 GB. Done: `drive_files.size` BIGINT (migration `20261112110000_drive_bigint`), resumable chunked upload with retry for files over 50 MB, streamed assembly. Verified live with a 2.4 GB file (init, 308 chunks, complete, ranged read, purge); chunked tests added to `server/test/drive.test.ts` (not run, Prisma guard).

- 2026-11-11 (owner): "review the drive and media library and improve them". Review found: media chunked upload lacks Drive's safeguards (no chunk/size/extension validation, memory-heavy assembly, `.svg` accepted, no stale cleanup); media list loads and annotates the whole library per request and re-scans the disk on every GET; media search was case-sensitive on PostgreSQL; ~31 hard-coded Arabic strings in MediaSection / MediaPickerModal / UploadManagerDrawer; list race on fast filter changes. Done by Claude: PostgreSQL-insensitive media search, path-containment `sep` check in `deleteMediaFile`, correct mime for `.jpg`/`.ogv` in disk sync, usage scan lower-cases CMS/settings text once. Prompts: `docs/prompts/task-media-a-prompt.md` (chunked hardening), `task-media-b-prompt.md` (UI i18n and list race). Still to write: media list server-side pagination and disk sync off the GET path; Drive `/move` atomicity and a folder-size/quota view.

- 2026-11-11 (owner, "do them yourself" / "go ahead"): Claude did media-a (chunked upload hardening), media-b (media UI i18n, list race, page clamp) and media-c (database pagination for `GET /api/media`, disk re-index throttled to once a minute, `?rescan=1`). Open: browser pass of media + picker in AR and EN; Drive `/move` atomicity; Drive folder-size view.

- 2026-11-11 (owner): "merge the two pages drive and media library into one page; allow choosing a media file from Drive; add the media library page features into Drive (upload progress bar in the floating panel, and layout)". Owner chose: one **Files** page with two sections (Drive private + Library public, no data migration) and the floating upload panel (the media upload drawer, shared by both). Plan, in order: files-a (server: `POST /api/drive/files/:id/to-library`, done by Claude, test in `drive.test.ts` not run), files-b (one upload manager for Library and Drive, header progress bar), files-c (merged Files page, routes `media`/`drive` become aliases, Drive grid/list layout and type filter), files-d (picker gets a Drive tab that publishes the chosen file). Prompts: `docs/prompts/task-files-b-prompt.md`, `task-files-c-prompt.md`, `task-files-d-prompt.md`.

  - Clarified: the "virtual pet" is the feedback pet (`AdminFeedbackPet`), which already shows upload progress from the upload manager; files-b routes Drive uploads through that manager, so no extra header bar is added.

- 2026-11-11 (owner): review and improve the Site CMS admin page. Done: slim toolbar (banner removed), wrapping tabs, lighter preview chrome in split view, no English parentheticals in Arabic labels, unsaved-changes tracking for all CMS panels (sticky bar with Save/Discard, confirm on tab switch, browser leave warning). Open: Clients directory CRUD is not tracked, hardcoded "(English)" labels in Home/Clients panels, preview focus-sync, shell polish.

- 2026-11-11 (owner): "how to add a realtime changes preview feature to the CMS page". Finding: a save-triggered preview (iframe + socket) already exists; missing is a draft channel for unsaved edits. Plan (reviewed once, scope corrected: all eight payload sections qualify, not only four): same-origin iframe + postMessage drafts. Prompts `docs/prompts/task-cms-draft-a|b|c-prompt.md` (A iframe receiver + read-only preview + crash fallback, B admin sender + Home, C other panels incl. Contact converter). Known existing bug folded into B: iframe ignores `?lang=` so a reload resets it to Arabic.
- 2026-11-11: CMS live draft preview (unsaved edits shown in the preview iframe) implemented outside OpenCode from the A/B/C prompts, reviewed and browser-checked on 8 panels; prompts archived in docs/prompts/_archive/cms-draft/. Open: draft badge/error strings are Arabic-only, 'Preview is read-only' is English-only.
- 2026-11-11 (owner): "do them all" on two leftovers of the CMS live preview work. Done: the ~20 hard-coded Arabic strings in `CmsLivePreviewPane.tsx` moved to `cms.preview.*` keys (ar and en); `CLAUDE.md` lint baseline corrected from 46 to 52 (measured 52 before and after the change, 0 new).

- 2026-11-11 (owner): "localization even the preview does not change to en" (admin in English, CMS preview stayed Arabic). Cause: `CmsLivePreviewPane` always started in `ar` and ignored the admin language (its own AR/EN toggle worked). Fixed: the preview starts in the admin language and follows it when the sidebar language switch changes; the toggle still overrides it. Browser-checked EN to AR to EN.

- 2026-11-11 (owner): "when I click the section accordion scroll the preview to that section". Done for the Home panel: opening an accordion dispatches `ajda:cms-focus-section`; the preview pane posts `AJDA_SCROLL_TO_SECTION` to the iframe (replayed after a reload); `HomePage` wraps each section in `PreviewAnchor` (a `data-cms-section` div, rendered only inside the preview iframe, so the public DOM is unchanged) and `usePreviewSectionScroll` scrolls to it. Browser-checked on sections 3 and 5. Not done: other panels (Footer, Contact, etc.) have no accordions wired; disabled sections are not rendered, so nothing to scroll to.

- 2026-11-11 (owner): "add zip features to the drive and improve the upload ... make them all in one window and implement a queue upload". Root cause of the screenshot (every file red, "A folder with this name already exists here"): all files of a folder upload start at once and race in `ensureFolderPath`. Prompts written, run in order: `docs/prompts/task-drive-a-prompt.md` (race fix + queue of 3 + one upload panel), `task-drive-b-prompt.md` (download folder/selection as zip, ticket + streaming, archiver), `task-drive-c-prompt.md` (extract zip on server, yauzl, zip-slip/bomb guards). B and C touch DriveView/drive.routes, so sequential.

- 2026-11-11 (owner): index.html picked as a project HTML page rendered unstyled (screenshot). Cause: a loose .html is stored flat in /uploads, so its relative styles.css/script.js/imgs/ do not resolve; only a zip extracted by the HTML picker is served at /html/<slug>/ with its siblings. Owner asks: after a zip upload show the file so it can be chosen, and a preview inside the picker. Done in `MediaPickerModal.tsx`: a one-item zip extract is preselected in the library list (notice `media.picker.extractedOne`), and the chosen library item shows an inline preview (HTML via /html/<slug>/, video, PDF, image). Selection is no longer cleared on search change. Not browser-checked yet. Open: hint when a single .html is chosen; Drive folder as HTML site.
- 2026-11-11 (owner): Library files are messy; wants folders, or a way to organise after a zip upload; then "how to improve this page even with virtual folders, to keep it clean". Plan: virtual Library folders (no URL changes), uploads and zip extractions land in a folder (a zip gets its own folder), move/rename/delete folders, multi-select move; page declutter (slim stats strip, table default, website rows, sort, bulk delete of unused). Prompts ready: docs/prompts/task-libfolders-a..e-prompt.md (order a, b+c, d, e). 2026-11-11: delivered as a zip by GLM, applied and reviewed by Claude (all gates green except the server tests, owner-run; migration verified on the local PostgreSQL; API checked end to end; one fix: stable `id` tie-breaker in the list sort). Browser pass and archive still open.
- 2026-11-11 (owner): UI/UX review of the Library page, then "do them yourself", then "the wasted vertical space; in select mode a click anywhere on the card selects; add a Select button at the top". Done by Claude in `LibraryView.tsx`, new `library/FileActionsMenu.tsx`, `FolderTile.tsx` (compact chip), i18n `media.ts` / `files.ts`: bidi-safe numbers and units (`<bdi dir="ltr">`), disk meter coloured by percent used (80% amber, 90% red) and labelled as server storage, page-only "linked/unused" chips removed, one slim info line instead of a chip box, selection bar moved after the list (no layout shift) with count + size and a separate delete, indeterminate select-all, explicit Select mode (toolbar button; whole card or row toggles), badge only on unused files, card kebab menu with locked delete when in use, real file extension label, "used in" line for non-image files, one segmented style for both filters, per-page options labelled, drag-and-drop upload onto the page, unified terms (used / unused). Gates: tsc, `npm run build` green, lint 0 errors (54 warnings, none in new files; baseline 52 predates the uncommitted libfolders work). Not browser-checked (Chrome extension not connected). Not done: dragging files onto folder chips, header wifi/refresh icon labels (admin shell).

- **2026-11-11, file-detail modal and info dialogs (owner):** Library file-detail modal rebuilt as `files/library/MediaPreviewDialog.tsx` (header with type icon, mime, size, date, open-in-tab; preview fills the panel; links and slug editor beside it when wide, below when narrow via container queries). Resizable from every edge and corner through the new shared `common/ResizableFrame.tsx` (also used by `FilePreviewModal`). Info-only dialogs (delete-blocked usage list, Google-preview photo lightbox, file detail) now close on outside mouse-down; `common/useEscapeKey.ts` adds Escape. Gates: tsc and build green, lint adds no warning in these files. Not browser-checked (Chrome extension not connected). Other info-only dialogs were not found; form/confirm dialogs intentionally keep their current behaviour.
