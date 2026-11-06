# Ajda Real Estate Platform — Changelog

> **Format**: Reverse chronological order (newest first)  
> **Standards**: Conventional Commits & feature summary

---

## [Unreleased] — 2026-10-21 to 2026-10-26 (production deploy pending, per `salah-tasks.md`)

Package versions at this point: root 1.2.2, server 1.2.3, `/api/health` 1.2.2 (to be aligned at release). Production needs the migrations listed at the end, run by the owner after a backup.

### Added
- Readable project URLs `/projects/{slug}-{id}` (slug from `titleEn`, id suffix keeps it unique, old `/projects/{id}` URLs still work and canonicalise). No migration.
- **SEO**: the API renders the SPA shell per page (title, description, canonical, OpenGraph, Twitter, JSON-LD, `<noscript>` content, honest 404s), `/robots.txt`, `/sitemap.xml`, `SEO_INDEXING` safety flag (off by default, noindex everywhere), Caddy routing with static fallback, default share image `public/og-default.png`. See architecture section 12.
- **Favicons**: 48/96 px PNGs and a real multi-size `favicon.ico` so Google can show the site icon.
- **Past projects** ("our previous work"): admin CRUD, public `/past-works` page, gallery and publish switch.
- **Careers**: public application form with optional CV (PDF, stored privately), admin Applications page, configurable required fields, email notification to configurable recipients, floating "Jobs" button and footer item, each switchable in Settings.
- **Project page**: 3D model link, project profile PDF button, admin editing of all project fields, project duplication.
- **Users**: create wizard, invite by link or admin-set password verified by email (link or 6-digit code), `verifyUsers` permission, "send password in the email" option, avatars, profile redesign.
- **Sign-in security**: authenticator-app TOTP with recovery codes and forced enrolment; passkeys (WebAuthn) as a full sign-in alternative; two-step password change by emailed code; show/hide password button.
- **Inquiries**: detail page `/admin/inquiries/:id` linked from the list, the notification email and the desktop notification.
- **Admin i18n**: the whole admin dashboard in Arabic and English (`src/i18n/admin/`), typed toasts, translated login.
- **Admin UX**: skeleton loaders instead of spinners, error boundary, deep-link fix for `/admin/pastProjects`.
- **Deploy**: test-instance deploy by GitHub Actions (forced SSH command, test only), `reload.sh` for the manual production deploy, `scripts/deploy-*.mjs`, test-database sanitizer, `deploy/mkuser.sh` and a developer-user CLI.

### Fixed
- **Project page**: removed the hard-coded six-card "amenities" block (super deluxe finishing, smart security, shaded parking, central AC, landscaping, structural warranties) that was rendered on every project, could not be edited or hidden by the admin, and was false for logistics and commercial projects. The editable, per-project, bilingual `features` list is the only amenities source now. The dead `modal.amenities` translation arrays (Arabic and English) were deleted with it — nothing read them.
- **Project page i18n**: location highlights now use the admin's `locationHighlightsEn` when the language is English and fall back to the Arabic list only when it is empty (previously always Arabic); unit cards read `typeEn` and `featuresEn` in English with an Arabic fallback; the floors count uses proper Arabic counted forms (دور واحد / دوران / N أدوار / N دورًا) and English "1 floor" / "N floors"; the units fallback reads `unitsEn` in English ("Multiple units") before defaulting.
- **Project page honesty**: removed every unverifiable "4K" claim about the project video (tab chip, overlay badges, hover tooltip, cinema badges). The video plays at whatever resolution the admin's YouTube URL provides.
- **Works page**: dropped the hard-coded "معتمد ومجهز / Certified & Equipped" and "جاهز ومجهز / Ready & Fitted" chips from the featured banner and the project cards, and the "سعات تخزين كبرى / High-Capacity Storage" fallback that claimed a warehouse capacity no project data states. Cards with no units text now render nothing there.
- **Contact page trust bullets**: the three hard-coded bullets (including the "reply within 24 hours" promise) are now admin content — `trustEnabled` on/off plus up to 6 editable bilingual `trustItems` in the contact CMS panel. Icons stay fixed in code; the block hides when disabled or empty. Defaults reproduce today's three bullets, so the public page is unchanged until edited.
- **Footer made-in-KSA**: the line was defined in every layer but never rendered; it now renders from `madeInKsaEnabled` (default `false`, so the footer is unchanged until an admin switches it on) with the two admin-editable AR/EN texts added to the footer panel. The copyright year is now `new Date().getFullYear()` instead of the literal `2026`.
- **CMS back-compat**: rows stored before these fields existed are served with the defaults (the service merges the new fields over a stored section), and the schema keeps the fields optional so rollbacks of old versions and older admin clients still validate. No Prisma migration — the content is JSON in `CmsSection`.
- **Nav**: the "حجز معاينة / Register Interest" entry is removed from the site menu — from both nav defaults and, by the data migration `20261106214500_remove_booking_nav_item`, from the stored nav rows. The `/booking` page itself stays (hero CTA, project interest buttons and direct URLs still reach it); nothing but the menu entry was removed.

### Security and hardening
- Logs and developer-notes access now needs a super admin session **and** a key in a header (`x-logs-key`, `x-dev-notes-key`); `?key=` is gone; both secrets plus `SETTINGS_ENCRYPTION_KEY` are required in production and no longer have default values.
- Dependency upgrades (server audit 12 high down to 4 accepted: zod 3, Prisma CLI chain), `TRUST_PROXY` and `HOST` guidance, production config validation at boot.
- Fixes found by reviews: dead "Register Interest" button on project pages, `manageNotifications` could re-route every lead, recovery codes rejected on disable, account-suspension enumeration at login, mojibake Arabic defaults in the init migration, raw translation keys, and others (see `docs/reviews/`).

### Tests
- Server suite grew from 146 to 428 tests in 44 files.

### Migrations to run on production (by hand, after a backup)
`20261022000000_foundation_past_projects_applications`, `20261022100000_email_verification`, `20261024000000_totp`, `20261025000000_defaults_and_indexes`, `20261025120000_passkeys`, `20261026000000_user_avatar`, `20261106214500_remove_booking_nav_item` (data fix: drops the booking entry from the stored nav JSON; the `/booking` page itself is untouched).

---

## [1.2.1] — 2026-10-01

### ⚡ Performance: Route-Level Code Splitting & Dynamic Chunking
- **Initial Bundle Reduction**: Reduced public landing page bundle from **1,083.2 kB** down to **385.7 kB** (115.4 kB gzipped) — a **64.4% reduction** in transferred JavaScript.
- **Admin Suite Isolation**: Code-split `AdminDashboardPage` (~521 kB) and `AdminLoginPage` (~18 kB) into on-demand dynamic chunks using `React.lazy()` and `<Suspense>`. Public visitors now never download administrative logic or heavy editor components.
- **Secondary Route Splitting**: Code-split `WorksPage`, `ProjectDetailPage`, `InterestRegistrationView`, `ContactPage`, and `ClientsPage` into individual on-demand chunks.
- **Branded Fallbacks**: Added zero-layout-shift `RouteLoadingFallback` and full-screen `AdminLoadingFallback` skeletons.

---

## [1.2.0] — 2026-10-01

### 🛡️ Feature: Isolated Developer Notes Table & Instant Email Notifications
- **Dedicated Database Table**: Added standalone `DeveloperNote` model mapped to `developer_notes` with status and date indexes.
- **Strict Domain Isolation**: Completely decoupled developer feedback from `CustomerInquiry` ("طلبات الاهتمام والعملاء"). Migrated and purged existing developer feedback from customer inquiries table.
- **Immediate Email Dispatch**: Integrated with `mailService` to dispatch rich HTML alert emails to `DEVELOPER_EMAIL` (`cloud.data.sa@gmail.com`) upon note creation with section, issue description, suggested solution, and full-resolution screenshot preview.
- **Developer Management API**: Added `/api/developer/notes` (listing, search, export to Markdown/JSON, status patching, deletion) guarded by `DEVELOPER_NOTES_SECRET` or `super_admin` JWT.
- **Frontend Wiring**: Refactored `AdminFeedbackPet.tsx` to submit directly to `/api/developer/notes`.

### 📊 Feature: Live Production Logs, In-Memory Ring Buffer & HTML Terminal UI
- **Dual-Tier Logging**: 2,000-event in-memory ring buffer for 0ms retrieval + simultaneous streaming persistence to `server/prod.log`.
- **Fastify HTTP Telemetry**: Automatic request/response logging capturing method, URL, status code, latency (ms), IP, and User-Agent.
- **Interactive Terminal Viewer**: Dark-mode live dashboard at `/api/logs/view` featuring 3-second live polling, level badges, debounced search, system telemetry banner, and 1-click log clearing.
- **REST Endpoints**: `/api/logs` (JSON), `/api/logs/raw` (plain text), `/api/logs/stats` (telemetry), `/api/logs/clear` (buffer purge & file truncation).
- **Security**: Accessible via `?key=<LOGS_SECRET_KEY>`, admin JWT, or optional `LOGS_PUBLIC=true`.

### 🎨 Feature: Phase 2A Frontend Wiring & Follow-ups
- **Navbar WhatsApp & Phone**: Migrated to `useCmsContact()` with graceful fallback to legacy site settings.
- **ContactPage CMS Integration**: Dynamic title, subtitle, form headings, and contact info. Implemented index-based positional tracking (`form.subjectIndex`) ensuring CMS copy edits never desynchronize CRM interest classification.
- **Hero Highlight Word**: Added two-tone gradient accent treatment with case-insensitive token matching and fallback.
- **CMS Hooks Extension**: Added `address` and `hours` to `useCmsContact()`, and index-aligned paired list zipping to `useCmsText().list()`.

---

## [1.1.0] — 2026-10-01

### 🚀 Major Feature: Full Content Management System (CMS) & Versioning Engine
- **Database Architecture**: Added dedicated Prisma models `CmsSection`, `CmsSectionVersion`, and `CmsClient` for relational partners.
- **In-Memory Cache & Deterministic ETags**: Implemented high-throughput in-memory caching with deterministic ETags (`W/"sec-..."` and `W/"cms-agg-..."`) supporting instant HTTP 304 responses.
- **Version History & 1-Click Rollback**: Automated archiving of up to 10 historical snapshots per section with point-in-time restoration.
- **Admin CMS Dashboard Suite**:
  - `CmsNavPanel`: Reorderable navigation items, custom URLs, CTA button toggle, and instant visibility switches.
  - `CmsFooterPanel`: Brand identity text, toggles for contact info (phone, WhatsApp, email, address, hours), and dynamic social media manager.
  - `CmsWorksPanel`: Header copy, featured project banner dropdown picker from real DB projects, and empty search state customizer.
  - `CmsClientsPanel`: Full relational CRUD for partners, logo uploader, search filter, selection checkboxes, and bulk visibility/delete actions.
  - `CmsHomePanel`: Accordion manager for all 9 sections with instant enable/disable toggles.
  - `CmsContactPanel`: Header copy, form titles, and paired inquiry subjects dropdown manager.
  - `CmsSection`: Top-level tabbed management container with full JSON backup export.
  - `CmsVersionModal`: Visual history inspector with side-by-side diff preview and 1-click rollback.
- **Public Frontend Integration**:
  - `CmsProvider` with instant 0ms first-paint from `localStorage` (`ajda_cms_cache_v2`).
  - SWR background revalidation and Socket.io push invalidation on `cms:updated`.
  - Wired public components: `Navbar`, `Footer`, `ClientsPage`, `ClientsSection`, `HeroSection`, `Marquee`, `InteractiveProjectsMap`, `AboutSection`, `ServicesSection`, `ProcessSection`, `ProjectsSection`, `CtaSection`, `WorksPage`.
- **Granular Action-Level Permissions**:
  - Introduced fine-grained permission keys: `createProject`, `editProject`, `deleteProject`, `publishProject`, `viewProjects`, `manageCms`, `manageClients`, `rollbackCms`.
  - Implemented direct per-user overrides with backward-compatible role inheritance.

---

## [1.0.0] — 2026-09-30

### Features
- **Email OTP** — Login verification (per-admin toggle or global) + forgot/reset password via 6-digit code (10 min expiry, 5 attempts, 60s resend).
- **Notification Listeners** — Settings tab to configure event + channel + recipients for new inquiries; `manageNotifications` permission.
- **In-App Notifications** — Toast, header bell with unread count, desktop notifications for new inquiries.
- **Mail Settings Page** — Admin UI for SMTP config; AES-256-GCM encrypted password storage; test email with real error reporting.
- **Universal Delete Confirmation** — Every delete action requires explicit confirmation (red dialog, "cannot be undone").
- **Toggle Confirmations** — Activate/deactivate, publish/hide, status changes show confirmation with "don't ask again" per admin/action type.
- **Project Duplicate** — "نسخ المشروع" on cards, table, list, and project page (copy with floors/units as new draft).
- **Maintenance Mode** — Settings tab for announcement banner + maintenance mode.

### Bug Fixes
- **CLIENT_ORIGIN parsing** — Properly splits comma-separated origins.
- **Dev origins in production** — localhost:5173 excluded when NODE_ENV=production.

---

## 2026-09-29

### Features
- **Unit Status Select** — Admin can set any unit directly to available/reserved/rented/sold from dropdown.
- **Cities List** — 42 Saudi cities across 13 regions with AR/EN names, region, coordinates (`src/data/saudiCities.ts`).
- **CitySelect Component** — Popular chips + WAI-ARIA combobox for project forms and public filters.
- **Map Location Picker** — Click/drag pin on Google Maps in project editor; search box to jump to city/place.
- **Developer Feedback Box** — Floating pet assistant with minimize, page context, screenshot upload, submission to developer.

---

## 2026-09-28

### Features
- **Publishing Status** — Projects: draft/published/hidden toggle; unpublished hidden from public site.
- **View Switcher** — Table/list/grid control on projects, inquiries, users, categories, units, newsletter.
- **DataTable Component** — Sorting, filtering, search, bulk actions, sticky header, column show/hide, density, pagination.
- **Drafts** — "Save as draft" for projects; status filter chips with counts; dismissible draft banner.
- **Newsletter Admin** — List, search, delete, CSV export for subscribers.

### Bug Fixes
- **Inquiry data integrity** — projectTitle/unitNumber resolved from DB, not client-supplied.
- **Media upload security** — Magic-byte detection instead of declared mimetype; images always re-encoded through Sharp.
- **Upload size limit** — Clean 413 response instead of connection drop for oversized files.
- **WorksPage crash** — Featured banner no longer dereferences undefined on first paint.
