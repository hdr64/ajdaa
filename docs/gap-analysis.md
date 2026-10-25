# Ajda Real Estate Platform — Gap Analysis

> **Last Updated**: 2026-10-01  
> **Purpose**: Track platform capabilities, identify feature gaps against enterprise real estate & content management standards, and outline the upcoming product roadmap.

---

## A. Security & Accounts

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Rate limiting | ✅ Done | — | Per-route limits on login, OTP, public forms, and CMS writes (60/min burst) |
| Email OTP | ✅ Done | — | Login verification & password reset via 6-digit codes |
| Forgot/reset password | ✅ Done | — | Secure email delivery with TTL verification |
| Login failure lockout | ✅ Done | — | Automatic temporary lockout after consecutive failed attempts |
| Granular Role & Action Permissions | ✅ Done | — | `manage_cms`, `manage_cms_content`, `manage_cms_clients`, plus core admin permissions |
| 2FA (TOTP) | 📋 Planned | High | Authenticator app QR code setup & emergency recovery codes |
| Passkeys (WebAuthn) | 📋 Planned | Medium | Passwordless biometric sign-in |
| Session management | 📋 Planned | Medium | Active sessions viewer with remote revocation |
| Password complexity policy | 📋 Planned | Low | Enforce character variety and entropy rules |
| Comprehensive Audit Log | 📋 Planned | High | System-wide admin activity trail (CMS versions already tracked) |

---

## B. Shell & Navigation

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Sidebar navigation | ✅ Done | — | Grouped, collapsible, permission-aware navigation |
| Dynamic CMS Menu Management | ✅ Done | — | Reorder, enable/disable, and customize public navbar items |
| Notifications bell | ✅ Done | — | Real-time WebSocket notifications with unread counter |
| User profile menu | ✅ Done | — | Profile viewing, settings, and secure sign-out |
| Bilingual Admin Interface | 📋 Planned | Medium | English toggle (currently Arabic-first admin) |
| Command palette | 📋 Planned | Low | `Ctrl+K` quick search and shortcut actions |
| Admin breadcrumbs | 📋 Planned | Low | Deep nested route navigation |
| Keyboard shortcuts | 📋 Planned | Low | Power-user navigation bindings |

---

## C. Content & Data Management (CMS)

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Full Content Management System (CMS) | ✅ Done | — | Dynamic control of Nav, Footer, Works, Clients, Home, Contact |
| Section Versioning & Rollback | ✅ Done | — | Up to 10 automated snapshots per section with modal diff & rollback |
| Multi-tier CMS Cache & Invalidation | ✅ Done | — | In-memory `Map`, deterministic ETags (`W/"sec-..."`), Socket.io broadcasts |
| Client & Partner Management | ✅ Done | — | Logo uploading, sector categorization, display order, bulk actions |
| Referential Integrity Guards | ✅ Done | — | Prevents referencing non-existent project IDs in CMS Works |
| CMS Backup Export | ✅ Done | — | Instant full JSON snapshot export in Admin CMS Suite |
| DataTable component | ✅ Done | — | Sorting, filtering, bulk operations |
| View switcher | ✅ Done | — | Table, list, and grid view toggles |
| Server-side pagination | 📋 Planned | High | Infinite scroll/pagination for massive unit datasets |
| Central Media Library | 📋 Planned | High | Unified asset browser, deduplication, and cleanup tools |
| Rich text / WYSIWYG editor | 📋 Planned | Medium | Rich formatting for project narratives and blog posts |
| Soft delete / trash bin | 📋 Planned | Medium | Recover deleted properties and inquiries |
| CSV import | 📋 Planned | Medium | Bulk ingest properties and units |
| CSV export | ✅ Partial | — | Export for inquiries and newsletter subscribers shipped |

---

## D. CRM for Inquiries

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Core Inquiry CRM | ✅ Done | — | Pipeline tracking, status changes, and inquiry notes |
| Real-time lead notifications | ✅ Done | — | Instant alert sound, badge counter, and toast notifications |
| Assign inquiry to sales agent | 📋 Planned | Medium | "My leads" filter and agent assignment |
| Follow-up reminders & tasks | 📋 Planned | Medium | Due dates, notifications, and scheduled check-ins |
| Sales Pipeline Kanban | 📋 Planned | Low | Drag-and-drop opportunity board |
| Consolidated customer cards | 📋 Planned | Low | Group all inquiries and units by phone/email |
| Lead source attribution | 📋 Planned | Low | UTM tracking, ad campaign source tagging |
| WhatsApp & Email templates | 📋 Planned | Low | 1-click canned responses for quick inquiry follow-up |

---

## E. Dashboard & Insights

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| KPI Overview Cards | ✅ Done | — | Inquiry counts, unit status distribution, active projects |
| Visual trend charts | ✅ Done | — | Inquiry volume over time, unit types breakdown |
| Date range filters | 📋 Planned | Medium | 7d, 30d, 90d, custom calendar selector |
| Conversion funnel metrics | 📋 Planned | Low | Views → Inquiries → Visits → Completed sales |
| Privacy-focused analytics | 📋 Planned | Low | Self-hosted Umami or Plausible integration |
| Scheduled email digests | 📋 Planned | Low | Weekly executive summary reports |

---

## F. Operations & Reliability

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Automated Maintenance Mode | ✅ Done | — | Controlled via settings with public announcement banner |
| Zero-Downtime Socket Reconnect | ✅ Done | — | Automatic socket revalidation on reconnect with ETag checks |
| Production deployment architecture | ✅ Done | — | Native PostgreSQL 16 + Caddy 2 reverse proxy + systemd (No Docker) |
| Health check endpoint | ✅ Done | — | `/health` route with database connectivity probe |
| Uploads automated backup | 📋 Planned | High | Daily rsync/rclone for `/uploads` media directory |
| Sentry error monitoring | 📋 Planned | High | Frontend exception tracker and backend unhandled error reporting |
| System status dashboard | 📋 Planned | Low | CPU, RAM, disk space, and DB connection pool metrics |
| Broken link (404) monitor | 📋 Planned | Low | Track and log broken asset and page requests |

---

## Roadmap by Priority

### High Priority
1. **Central Media Library**: Unified media picker for CMS, projects, and units.
2. **Server-Side Pagination**: Scalable querying for large unit/project inventories.
3. **Automated Uploads Backup**: Cron-based backup for user uploads directory.
4. **Error Monitoring**: Sentry or similar observability tool.
5. **Two-Factor Authentication (TOTP)**: Admin account protection with authenticator apps.

### Medium Priority
6. **Agent Lead Assignment**: Route incoming inquiries to specific sales team members.
7. **Bilingual Admin UI**: Add English locale to administrative views.
8. **Rich Text Editor**: Enhanced styling for project descriptions and article bodies.
9. **CSV Bulk Import**: Bulk upload property inventories via spreadsheet.
10. **Soft Delete**: Archive items to trash with 30-day restore guarantee.

### Low Priority
11. **Command Palette (`Ctrl+K`)**: Rapid navigation across projects, units, and CMS panels.
12. **Sales Pipeline Kanban**: Visual inquiry stage management.
13. **WhatsApp Canned Messages**: 1-click customer outreach templates.
14. **Custom Date Range Analytics**: Historical performance comparison.
