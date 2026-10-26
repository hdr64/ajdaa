# Task w5-inquiry-detail — open one inquiry at `/admin/inquiries/:id`

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). Independent of `task-w5-ready-a/b`; if one of those is running, wait for it, because they share the working tree.

## Goal

Owner report: "in the admin the inquiries I can not open the item. Add inquiries/id to show the inquiry." Today the inquiries list has no detail view and no per-inquiry URL. Add one: a route `/admin/inquiries/<id>` that shows a single inquiry, reachable from the list, the notification email and the desktop notification.

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply), `docs/ADMIN-I18N.md` (every new admin string needs AR and EN keys, a browser check for raw keys and `missing key` warnings is mandatory)
- `src/pages/admin/adminRoutes.ts` (routing, `parseAdminPath`, `buildAdminPath`, `navSectionOf`), `src/pages/admin/AdminDashboardPage.tsx` (`SECTION_META`, the section switch, `navigate`, the page title logic around line 254, the desktop notification at line 173), `src/pages/admin/sections/InquiriesSection.tsx` and `inquiryUi.tsx` (the list, status, notes and delete handlers to reuse), `src/services/inquiryService.ts`, `src/i18n/admin/inquiries.ts`, `src/i18n/admin/dashboard.ts`
- `server/src/routes/inquiries.routes.ts` (list at `GET /`, `PATCH`, `DELETE`), `server/src/services/notificationService.ts` (`INQUIRIES_PATH`), `server/test/` inquiry tests and `helpers.ts`

## Decided design (no open choices)

1. **Server:** add `GET /api/inquiries/:id` guarded by `authenticate` + `requirePermission('viewInquiries')`, returning the same shape as one item of the list endpoint; 404 `{ error: 'Inquiry not found' }` for an unknown id. Validate `id` as a non-empty string param like the neighbouring routes. Test: 200 with the full item for a seeded/created inquiry, 404 for an unknown id, 401 without a token, 403 for an admin without `viewInquiries`.
2. **Routing (`adminRoutes.ts`):** new section `inquiry` with `inquiryId?: string` on `AdminLocation`. `inquiries/<id>` parses to `{ section: 'inquiry', inquiryId }` (the id is a UUID string, not an integer; accept `[A-Za-z0-9-]+`); `buildAdminPath` returns `inquiries/<id>`; `navSectionOf('inquiry')` is `'inquiries'` so the sidebar keeps "Inquiries" highlighted; extra segments fall back to the list. Update the header comment table. Add `inquiry: { permission: 'viewInquiries' }` to `SECTION_META` and the section switch.
3. **Detail page:** new `src/pages/admin/sections/InquiryDetailSection.tsx` (keep it under about 250 lines; share small pieces with `inquiryUi.tsx` instead of copying). It loads the inquiry with `GET /api/inquiries/:id` through `useAsyncData` and shows loading, not-found and error states (not-found has a "Back to inquiries" link). It shows every field the list has (name, phone as a `tel:` link, email as a `mailto:` link, project and unit, interest type, message, created time, status) and the notes. Actions, reusing the existing handlers and permission checks exactly as the list does: change status, edit notes (the same editor component), delete (the same confirm dialog; after delete go back to the list), and a "Back to inquiries" button. Use logical `start`/`end` classes, no hard-coded text, and the admin i18n (`useAdminT`) with new keys in `src/i18n/admin/inquiries.ts` in both languages.
4. **List:** each row (table row and card) opens `inquiries/<id>` on click. Buttons and links inside a row (status, notes, delete, tel/mailto) must not trigger navigation (stop propagation). Rows are keyboard reachable (Enter opens).
5. **Page title:** for `inquiry` the title is the inquiry's name once loaded, else the section title; add `dashboard.section.inquiry.title` in both languages.
6. **Links:** in `notificationService.ts` make the "new inquiry" email link point to `/admin/inquiries/<inquiry id>` (keep the list link for other events); the desktop notification handler at `AdminDashboardPage.tsx:173` navigates to `{ section: 'inquiry', inquiryId }` when the payload carries an id (read the payload type first; if it has no id, add the id to the socket payload on the server and the type on the client). Update the email test expectation if one asserts the old link.
7. **Realtime:** if the open inquiry changes (status or notes updated by someone else through the existing socket events), update the detail view; if the existing events make this cheap, do it, otherwise leave the detail view loading once and say so in the report.

## Out of scope

Editing the customer's contact fields, assigning inquiries to users, new statuses, the applications section, anything in the auth, CMS or public site.

## Constraints

- No commits, no installs, no `.env*` reads or writes, no production commands. No new dependencies. Match neighbouring code, preserve line endings.
- Do not edit files under `docs/prompts/` except your report. Update `docs/api-reference.md` and the README endpoint table for the new endpoint.

## Gates (paste real output)

- `npm --prefix server run build`, `npm --prefix server test` (all green, report the count), `npm run lint`, `npm run build`
- **Browser pass (mandatory)** on a fresh scratch SQLite API as in `CLAUDE.md` (mail disabled): in Arabic and English, create two inquiries through the public contact form, open the list, click a row and confirm `/admin/inquiries/<id>` shows it; refresh on that URL and confirm it still loads; change the status and the notes and confirm they persist; open an unknown id (not-found state); delete from the detail page and land on the list; sign in as a user without `viewInquiries` and confirm the page is refused; no raw i18n keys and no `missing key` console warning.

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-inquiry-detail-report.md`: files changed, per-item result, gate output, decisions, anything not verified, and `## Guard results` as required by `docs/TODO.md` section 3.
