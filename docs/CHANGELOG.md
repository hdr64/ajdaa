# Ajda Real Estate Platform — Changelog

> **Format**: Reverse chronological order (newest first)  
> **Standards**: Conventional Commits & feature summary

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
