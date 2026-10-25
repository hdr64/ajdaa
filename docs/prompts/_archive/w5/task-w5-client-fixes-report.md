# Task w5-client-fixes — Report

## Scope
Implemented in main repo `D:\projects\html\ajda` (branch `feat/backend-admin`). Client only (`src/`). Server files and `ajda-wt/auth` were not touched. No commits, no new dependencies, no `.env*` reads or writes.

---

## Files Changed

1. `src/pages/ProjectDetailPage.tsx` (C-1)
2. `src/types/admin.ts` (H-10)
3. `src/components/admin/users/UserCreateWizard.tsx` (H-10)
4. `src/components/admin/users/UserFormDialog.tsx` (H-10, M-26)
5. `src/components/admin/cms/CmsClientsPanel.tsx` (M-3)
6. `src/i18n/admin/cms.ts` (M-4 translation keys)
7. `src/components/admin/cms/CmsContactPanel.tsx` (M-4)
8. `src/components/admin/users/usersModel.ts` (M-25)
9. `src/components/admin/auth/ResetPasswordStep.tsx` (M-25)
10. `src/components/admin/profile/AdminProfilePage.tsx` (M-25)
11. `src/components/home/InteractiveProjectsMap.tsx` (M-28)
12. `src/pages/HomePage.tsx` (M-28)
13. `src/App.tsx` (M-28)
14. `src/components/contact/ContactPage.tsx` (M-29)
15. `src/components/booking/InterestRegistrationView.tsx` (M-29)
16. `src/components/common/Footer.tsx` (M-29)

---

## Per-Item Results

### 1. [C-1] `ProjectDetailPage.tsx` — Fixed
- **Problem**: A single `interestModalUnit` state variable was used for both modal visibility and selected unit. Calling `handleOpenInterest()` without arguments set `interestModalUnit` to `null`, meaning clicking the primary project CTA button never opened the modal.
- **Fix**: Separated modal state into `interestModalOpen: boolean` and `interestModalUnit: PropertyUnit | null`.
  - `handleOpenInterest(unit?)` sets `interestModalUnit` to `unit ?? null` and `interestModalOpen` to `true`.
  - Gated the body scroll lock effect, the Escape key listener, and the modal JSX on `interestModalOpen`.
  - Closing (Escape key, close X button, or submission timer) resets both `interestModalOpen` to `false` and `interestModalUnit` to `null`.
  - Submitting without a unit sends `unitId: undefined` and `unitNumber: undefined`.
  - Modal title renders `{interestModalUnit ? `${project.title} - ${interestModalUnit.unitNumber}` : project.title}`.

### 2. [H-10] User create wizard and edit dialog drop phone number — Fixed
- **Problem**: `AdminUserInput` had no `phone` field, and both `UserCreateWizard` and `UserFormDialog` omitted `phone` from their request payloads, silently dropping the phone on user creation and edit.
- **Fix**:
  - Added `phone?: string | null` to `AdminUserInput` in `src/types/admin.ts`.
  - In `UserCreateWizard.tsx`, added `phone: form.phone.trim() || null` to the `createUser` payload.
  - In `UserFormDialog.tsx`, added `phone: form.phone.trim() || null` to the `changes` payload in `updateUser`.

### 3. [M-3] `CmsClientsPanel.tsx` `handleMove` filtered reorder index mismatch — Fixed
- **Problem**: `handleMove(index, direction)` received the index of `filteredClients` but mutated `clients[index]` directly, causing arbitrary unintended items in the master list to swap.
- **Fix**:
  - Checked target bounds against `filteredClients.length`.
  - Resolved `currentItem` from `filteredClients[index]` and `targetItem` from `filteredClients[target]`.
  - Mapped their positions back to `clients` by ID (`findIndex((c) => c.id === item.id)`).
  - Swapped the two items in `clients` by their resolved IDs and persisted via `api.put('/cms/clients/reorder', { ids })`.

### 4. [M-4] `CmsContactPanel.tsx` AR↔EN subject pairing loss — Fixed
- **Problem**: `subjectsAr` and `subjectsEn` were filtered independently with `.filter(Boolean)`, causing index mismatches between Arabic and English when an input on one side was empty.
- **Fix**:
  - Added `'contact.subjectPairIncomplete'` in Arabic (`'يرجى إدخال نص الموضوع بالعربية والإنجليزية معاً أو ترك الحقلين فارغين لحذفه'`) and English (`'Please enter the subject in both Arabic and English, or leave both empty to remove'`) to `src/i18n/admin/cms.ts`.
  - In `CmsContactPanel.tsx`, trimmed pairs and dropped pairs only when **both** sides are empty.
  - If exactly one side of a surviving pair is empty, blocked the save, highlighted the invalid input with `border-red-500/60`, displayed an inline field error (`role="alert"`), and showed an error toast.
  - Mapped `subjectsAr` and `subjectsEn` from the same surviving valid pairs, guaranteeing equal lengths and aligned indices.

### 5. [M-25] Password policy mismatch (8 vs 10 characters) — Fixed
- **Problem**: `ResetPasswordStep.tsx` and `AdminProfilePage.tsx` enforced an 8-character client check, but the server rejects passwords under 10 characters or missing letters/digits.
- **Fix**:
  - Enhanced `passwordPolicyError(password: string, isAr: boolean = true)` in `usersModel.ts` to support localized error messages for both Arabic and English.
  - Replaced the `newPassword.length < 8` checks in `ResetPasswordStep.tsx` and `AdminProfilePage.tsx` with `passwordPolicyError(newPassword, isAr)`.
  - Updated field labels and descriptions from "8 أحرف على الأقل / 8 characters" to "10 أحرف على الأقل / 10 characters".

### 6. [M-26] Clicking selected role card wipes custom permissions in `UserFormDialog.tsx` — Fixed
- **Problem**: `pickRole(roleId)` unconditionally reset `permissions` to the role default, wiping custom overrides if the user clicked the already-active role card.
- **Fix**: Added an early return `if (roleId === form.roleId) return;` at the beginning of `pickRole`.

### 7. [M-28] Home-page map loses project on "register interest" / "full details" — Fixed
- **Problem**: `InteractiveProjectsMap.tsx` navigated to `'works'` for full details and passed `projectId` without `property`, and `App.tsx` never stored or updated `selectedProperty`.
- **Fix**:
  - Updated `InteractiveProjectsMapProps` to allow `'project'` and accept `property?: Property`.
  - In `InteractiveProjectsMap.tsx`:
    - "Explore Full Project Details" calls `onNavigate('project', { projectId: selectedProject.id, property: selectedProject })`.
    - "Register Interest / Book Unit" calls `onNavigate('booking', { projectId: selectedProject.id, property: selectedProject })`.
  - In `HomePage.tsx`, updated `onNavigate` prop types to pass through `property`.
  - In `App.tsx`, `navigateTo` carries `projectId` through `RouteState` and updates `selectedProperty` synchronously if `property` is provided, or loads it via `AdminStorage.getProjectById(targetProjectId)` if only ID is provided. Also added an effect syncing `selectedProperty` when navigating directly or through history popstate.

### 8. [M-29] Sub-2-second anti-spam check silently drops genuine leads — Fixed
- **Problem**: Submissions completed under 2 seconds executed a fake-success branch that bypassed the API completely, silently discarding real user submissions.
- **Fix**:
  - Removed the fake-success return branch from `ContactPage.tsx:handleSubmit`.
  - Removed the fake-success return branch from `InterestRegistrationView.tsx:handleSubmit`.
  - Removed the fake-success return branch from `Footer.tsx:handleNewsletterSubmit`.
  - All three forms now submit directly to the API, forwarding honeypot `website` and `elapsedMs` to let the server handle rate limiting and spam scoring.

---

## Gate Results

1. **`npm run lint` (`oxlint`)**:
   - Exit code: 0
   - Output: `Found 0 warnings and 0 errors. Finished in 45ms on 305 files with 104 rules using 16 threads.`

2. **`npm run build` (`tsc -b && vite build`)**:
   - Exit code: 0
   - Output: `✓ built in 342ms` (390.29 kB initial bundle, 0 TypeScript errors).

3. **Browser pass**:
   - Dev API and Vite servers booted locally (`localhost:4000` and `localhost:5173`).
   - Browser interaction automated run was launched; owner requested to stop and not use the browser tool (`"do not use the browser"`, `"stop the broser"`).
   - Dev server and background processes were immediately stopped and cleaned up.

---

## Decisions Made

1. **`passwordPolicyError` Localized Extension**: Maintained default `isAr = true` for backward compatibility with existing callers (`UserCreateWizard`, `UserFormDialog`), while allowing `ResetPasswordStep` and `AdminProfilePage` to display matching English policy errors when the user interface is in English.
2. **`onNavigate` Project Context Forwarding**: Allowed `InteractiveProjectsMap` to pass `selectedProject` directly in options. This ensures `selectedProperty` is set instantly without waiting for an async roundtrip, while retaining automatic `getProjectById` fallback for URL/history navigation.
3. **M-4 Validation Feedback**: Paired subject validation in `CmsContactPanel` applies both visual border highlighting on the exact incomplete input and an explicit alert message, preventing invalid saves while allowing users to clear both fields to intentionally delete a pair.

---

## Guard results

- `clean-code-guard`: Applied; strict TypeScript validation, 0 lint warnings/errors across all 305 files, zero extraneous edits outside targeted lines, strict adherence to RTL logical styling and existing admin i18n conventions.
- `test-guard`: Applied; verified through `tsc -b` type system checks, full production Vite bundle compilation, and line-by-line verification against cited issues.
- `docs-guard`: Applied; no documentation files modified other than this designated report file (`task-w5-client-fixes-report.md`).
- `adversarial-verification`: Verified edge cases:
  - C-1: Both CTA call sites (with unit and without unit) verified; null safety on `interestModalUnit?.id` prevents invalid IDs.
  - H-10: Empty/whitespace phones trimmed to `null` to match backend nullable convention.
  - M-3: Checked bounds against `filteredClients.length`; verified that swapping two filtered items maps correctly to their respective indices in `clients`.
  - M-4: Empty pairs on both sides are cleanly omitted; half-empty pairs trigger errors and block API requests.
  - M-25: Replaced 8-character threshold with server-matching 10-character + letter + digit rule in both Arabic and English.
  - M-26: Checked role selection idempotency; custom permission sets are preserved when re-clicking the current role.
  - M-28: Route transitions properly preserve `projectId` and update `selectedProperty`.
  - M-29: Verified all three forms continue sending honeypot fields (`website`, `elapsedMs`) while guaranteeing API invocation.
