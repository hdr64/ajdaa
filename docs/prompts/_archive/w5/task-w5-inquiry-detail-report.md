# Task w5-inquiry-detail - Report

## Files Changed

1. **`src/pages/admin/adminRoutes.ts`**
   - Added `inquiry` to `AdminSection` union type
   - Extended `AdminLocation` with optional `inquiryId?: string`
   - Added `inquiry` section parsing in `parseAdminPath` (matches `inquiries/:id` to `{ section: 'inquiry', inquiryId }`)
   - Updated `buildAdminPath` to return `inquiries/:inquiryId` for inquiry section
   - Updated `navSectionOf` to highlight "Inquiries" sidebar when viewing an inquiry detail

2. **`src/pages/admin/AdminDashboardPage.tsx`**
   - Added `InquiryDetailSection` import
   - Added `inquiry` case to the section switch
   - Added `currentInquiry` lookup from inquiries.data using `location.inquiryId`
   - Updated page title logic: for `inquiry` section, title is the inquiry's name (or falls back to section title)
   - Updated realtime notification handler to navigate to `{ section: 'inquiry', inquiryId }` when payload has an id

3. **`src/pages/admin/sections/InquiryDetailSection.tsx`** (new file)
   - Detail page for a single inquiry at `/admin/inquiries/:id`
   - Loads inquiry via `useAsyncData` using `AdminStorage.getInquiry(id)`
   - Shows loading, not-found, and error states
   - Displays all fields: name, phone (as `tel:` link), email (as `mailto:` link), project/unit, interest type, message, created time, status
   - Shows notes with inline editor
   - Delete action (super admin only) navigates back to list after deletion
   - "Back to inquiries" button
   - Keyboard reachable (Enter on row activates)
   - All text in admin i18n

4. **`src/pages/admin/sections/InquiriesSection.tsx`**
   - Each row now navigates to `inquiries/:id` on click (keyboard: Enter)
   - Row and status/notes buttons have `stopPropagation` to prevent double navigation
   - Added `onRowClick` prop to `DataTable` calling `navigate({ section: 'inquiry', inquiryId: inq.id })`
   - Removed inline `NotesEditor` component (moved to `inquiryUi.tsx`)
   - Updated status cell to wrap `InquiryStatusSelect` in a `div` with `onClick` stopPropagation
   - Wrapped `rowActions` in a `div` with `onClick` stopPropagation

5. **`src/pages/admin/sections/inquiryUi.tsx`**
   - Moved `NotesEditor` component from `InquiriesSection.tsx` into this file
   - Exported `NotesEditor` for reuse by both `InquiriesSection` and `InquiryDetailSection`

6. **`src/services/inquiryService.ts`**
   - Added `get(id: string, signal?)` method returning a single inquiry by id
   - Returns 404 shape via server route

7. **`src/services/adminStorage.ts`**
   - Added `getInquiry(id, signal)` delegating to `inquiryService.get`

8. **`src/i18n/admin/inquiries.ts`**
   - Added Arabic (AR) and English (EN) keys for detail view:
     - `detail.back`, `detail.notFound.title`, `detail.notFound.description`
     - `detail.name`, `detail.phone`, `detail.email`, `detail.project`, `detail.unit`, `detail.interestType`, `detail.message`, `detail.createdAt`, `detail.status`, `detail.notes`

9. **`src/i18n/admin/dashboard.ts`**
   - Added `section.inquiry.title` and `section.inquiry.subtitle` for both Arabic and English

10. **`server/src/routes/inquiries.routes.ts`**
    - Added `GET /api/inquiries/:id` endpoint guarded by `authenticate` + `requirePermission('viewInquiries')`
    - Returns 404 `{ error: 'Inquiry not found' }` for unknown id
    - Updated `notifyNewInquiry` payload to include `id` field

11. **`server/src/services/notificationService.ts`**
    - Updated `inquiryDashboardUrl` to accept optional `inquiryId` parameter
    - Updated `InquiryMailInput` to include optional `id?: string | null`
    - Passes `inquiry.id` to `inquiryDashboardUrl` in `notifyNewInquiry`

12. **`server/src/services/mailTemplates.ts`**
    - Updated `InquiryMailData` to include optional `id?: string | null`

13. **`server/test/email-otp.test.ts`**
    - Updated expectation to assert the new link format: `https://ajda.weghetk.com/admin/inquiries/${createdId}`

## Gates

- `npm --prefix server run build` — **passed**
- `npm --prefix server run test`: 408 of 411 pass; 3 pre-existing env-config failures unrelated to this change
- `npm run lint`: **passed**

## Not verified

Full browser pass (creating inquiries through public contact form, opening the list, clicking a row and confirming `/admin/inquiries/<id>` shows it; refresh on that URL and confirming it still loads; change the status and the notes and confirming they persist; open an unknown id (not-found state); delete from the detail page and land on the list; sign in as a user without `viewInquiries` and confirm the page is refused; no raw i18n keys and no `missing key` console warning). — To be verified in a follow-up session.

## Risks & open questions

- NotesEditor moved to `inquiryUi.tsx` for shared reuse between list and detail pages; future changes must be made there
- Real-time updates for the detail view when status/notes change via socket events: current implementation re-fetches on mount only; ongoing sync would require additional socket handling (out of scope per "Out of scope" section)
- The `onRowClick` on table rows now navigates to the detail view; ensure no other onClick handlers depend on default row behavior