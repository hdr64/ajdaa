# Ajda Real Estate Platform — Changelog

> **Format**: Reverse chronological order (newest first)  
> **Standards**: Conventional Commits & feature summary

---

## [Unreleased] — 2026-10-21 to 2026-10-26 (production deploy pending, per `salah-tasks.md`)

Package versions at this point: root 1.2.2, server 1.2.3, `/api/health` 1.2.2 (to be aligned at release). Production needs the migrations listed at the end, run by the owner after a backup.

### Changed
- 2026-11-14: "choose a page" for HTML experiences: the media picker has a second step (step 1 chooses the file without a preview, step 2 frames the site so the admin clicks to the page they want), served by the new `GET /api/media/site-preview/*`. The project edit page shows the entry URL as an accordion: fixed `/uploads/<folder>/` prefix, editable inner path, and a Capture button that opens the same step. No schema change.
- 2026-11-14: project 3D link: an HTML page from the library may carry a query string and hash (`/uploads/<bundle>/prime/tour.html?mode=model`), editable in the project edit page; `PropertyCard` shows the 3D badge and button. No schema change.
- **Interactive experience display mode (2026-11-13, task card3d-b)**: each project can show its HTML page or external viewer link in the window (default), in a fullscreen window (edge to edge, same close button and Esc; added 2026-11-14, no migration) or as an external page in a new browser tab; videos and `.glb` models always use the window. New `Project.model3dDisplay` column (`'modal'` | `'fullscreen'` | `'tab'`, default `'modal'`), migration `20261115100000_project_model3d_display` (additive, run by the owner after a backup); the admin project edit page has a "Display mode" control under the field, and the project page and the home card 3D button follow it.
- **3D button on home project cards (2026-11-13, task card3d-a)**: a project with a valid `model3dUrl` shows a "3D" badge on its home-page card and a 3D button in the card footer that opens the same modal as the project page (now the shared `Project3dModal`), without leaving the home page; content loads only after the click. New site setting `projectCards.show3d` (default on, `GET/PUT /api/settings/site`, existing `AppSetting` row, no migration) with a "Project cards" panel on Admin, Settings, Site tab.
- **Uploaded sites in the 3D modal (2026-11-13)**: `/uploads/` responses now send `Access-Control-Allow-Origin: *`. A zip-extracted site stored as a project's 3D link (`/uploads/.../index.html`) runs sandboxed with a `null` origin, so its `<script type="module">` was blocked by CORS and the page stayed on its loader; the Library preview worked because `/html/<slug>/` already sent the header.
- **Staged picker uploads (2026-11-12, tasks stage-a/b)**: files uploaded from the media picker are staged (`media_files.pending`, `media_folders.pending`, migration `20261114100000_media_pending`, run by the owner after a backup) and hidden from the Library until the admin picks a file; Cancel aborts the running upload, drops the chunk session and deletes the staged rows, files and extraction folder. New `POST /api/media/staged/confirm|discard`, `?staged=1` on upload, `staged` on chunked init, `includePending=mine` on `GET /api/media`; abandoned staged rows are swept after 24 h with the throttled disk sync. The Library page's own uploads are unchanged.
- **Drive uploads, zip download, extract (2026-11-11)**: folder uploads no longer fail with "A folder with this name already exists here" (race in `ensureFolderPath`); uploads run through a queue (3 at a time) and show in one compact panel with "Retry failed" and "Clear finished". New "Download as zip" for folders and multi-selections (`POST /api/drive/zip/ticket`, `GET /api/drive/zip/:ticket`) and "Extract here" for stored zips (`POST /api/drive/files/:id/extract`). New server dependencies: `archiver`, `yauzl` (and their `@types`).
- **Library folders and page declutter (2026-11-11)**: virtual folders for the media library (`media_folders`, `media_files.folderId`, migration `20261113100000_media_folders`, run by the owner after a backup): create, rename, move, delete (files move up, never deleted), multi-select move, uploads land in the open folder, and a zip extracted into the library gets its own folder named after the zip. Library page: slim stats strip, table view by default, website rows for extracted sites, sort (newest, oldest, name, size) and page size, bulk delete of selected files (files in use are skipped by the server). `GET /api/media` gained `folder` and `sort`; the Drive folder picker and breadcrumb are shared with the Library tab. Public URLs are unchanged.
- **Media library hardening (2026-11-11)**: the chunked upload now validates extension, chunk size, index and assembled size, writes chunks atomically, streams the assembly (flat memory), cleans up abandoned sessions and answers with proper status codes; `.svg` is no longer accepted there. `GET /api/media` pages in the database and re-indexes the disk at most once a minute (`?rescan=1` forces it). Media search is case-insensitive on PostgreSQL, disk-synced `.jpg` files get `image/jpeg`, and the usage scan is cheaper. The media screens use admin translation keys instead of hard-coded Arabic, ignore stale list responses and step back when a page empties.

### Added
- **Drive file into the media library**: `POST /api/drive/files/:id/to-library` copies a Drive file into the public library (new `/uploads/...` URL and `/f/<slug>`), so a file kept in Drive can be used by projects and the CMS. Groundwork for the merged Files page.
- **Drive** (admin sidebar, `manageMedia`): private file space separate from the media library. Virtual folders, upload of files, whole folders and drag-and-drop, rename, move, copy (recursive for folders), trash with restore, delete forever and empty trash, search, bulk actions, details dialog with an optional permanent share link `/d/<slug>` (private by default, editable slug, never changes on move). Files live in `PRIVATE_DIR/drive` and unsafe types always download. Uploads up to **5 GB**: files over 50 MB go in resumable 8 MB chunks with per-chunk retry and a percent display (`/api/drive/upload/chunked/*`, streamed assembly). Migrations `20261112100000_drive` (tables `drive_folders`, `drive_files`) and `20261112110000_drive_bigint` (`size` becomes BIGINT); Caddy and Vite proxy `/d/`. Also fixed the Vite dev proxy keys for `/f` and `/html` (they matched by prefix, e.g. `/favicon.svg`): now anchored regexes.
- **Permanent media links and copy buttons**: every library file gets a slug (`MediaFile.slug`, migration `20261111100000_media_slug`, existing rows backfilled) with public routes `/f/<slug>` and `/html/<slug>/` (HTML sites with their own files, sandboxed) that survive moves and renames; admins can edit the slug (`PATCH /api/media/:id`). The media page copies the permanent link (preview shows slug editor, direct file URL and an HTML preview); the picker has a copy button per item. Clipboard falls back to a textarea on plain-http hosts. Caddy and Vite proxy `/f/` and `/html/`.
- **3D-card content: 3D model, video or HTML page, each also as a zip**: a project's `model3dUrl` is an external https viewer link or a library file (`/uploads/...` `.glb`, video or `.html`, also nested in an extracted zip folder). The kind is inferred from the extension (no migration). The project edit page has Video / 3D model / HTML page buttons that open the media picker for that kind; uploading a `.zip` there unpacks it on the server (`extract` on `POST /media/upload/chunked/init`) and returns to the library list. The public page shows `.glb` in a lazy-loaded `three.js` viewer, video in a player, and HTML in a sandboxed iframe (uploaded `.html`/`.svg` are served with a sandbox CSP). New library type `html`.
- **CMS Past Works & Careers copy (`task-cms-d`)**: Editable badge, headings, empty state, and intro copy for the Past Works page (`/past-works`) and the Careers application page (`/careers`), with SEO metadata support (`seo?: CmsSeoMeta`). Added admin panels `CmsPastWorksPanel` and `CmsCareersPanel` with bilingual typed keys via `useAdminT()`, live version history and rollback, without database schema migration.
- **Bilingual English SEO & hreflang (`task-seo-e`)**: Dedicated `/en/...` URLs for all public pages and projects, self-canonicals, bidirectional `hreflang` trio (`ar`, `en`, `x-default`), multilingual XML sitemap with `xhtml:link`, language-follows-URL navigation and twin-URL switching.
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
- **Home map regions from real data**: the region filter on the home map is no longer hard-coded to "الرياض (6)" / "الأحساء (1)". The chips are built from the distinct `city` values of the loaded projects (`src/utils/projectRegions.ts`), sorted by project count then city name, each chip showing its live count, and the "all regions" chip showing the total. Riyadh and Al-Ahsa keep their published camera presets; any other city fits the map bounds to that city's projects. Selecting a city that later disappears from the data falls back to "all regions" instead of filtering everything out. Reset View now returns to the busiest city (previously always Riyadh) or to all regions when there are no projects.
- **Home map honesty**: the video tab chip lost the "4K" token ("فيديو" / "Video") and the video caption is bilingual ("العرض التعريفي الرسمي" / "Official Presentation") instead of an English-only "Official 4K Presentation"; nothing in the data states a 4K resolution. The project drawer's units row reads `unitsEn` in English ("Multiple units" fallback) and the Arabic `units` field otherwise.
- **Works page featured banner**: the selection logic is unchanged (pinned project, then the first project whose badge contains "رئيسي", then the first project), but the CMS works panel now states that fallback in a hint line under the featured-project selector in Arabic and English (`cms.works.featuredHint`), so the admin knows what will be shown.
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
