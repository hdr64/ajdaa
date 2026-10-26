# Deep Bug Hunter Review: Ajda Real Estate Platform

**Date:** 2026-10-26  
**Auditor:** Deep Bug Hunter (Automated Engineering & Security Audit)  
**Target:** Ajda Real Estate Platform (Frontend React/TypeScript + Backend Fastify/Prisma)

---

## 1. Scope & Methodology

### 1.1 In-Scope Components
- **WebAuthn Passkeys & Authentication Lane**: `@simplewebauthn` integration, registration options & verification, passkey login without passwords, challenge management, user permissions.
- **Page Loading & Skeleton System**: Transition from circular spinner progress indicators to responsive Skeleton loaders (`SectionState.tsx`, past projects, projects, categories, inquiries, settings panels, careers page, project detail page).
- **User Avatar & Profile Redesign**: Backend avatar endpoints (`POST /api/auth/me/avatar`, `DELETE /api/auth/me/avatar`), schema migrations, avatar rendering across admin layout (`AdminSidebar`, `UserAvatar`, `UsersTable`), and `/admin/profile` Hero Card.

### 1.2 Verification Gates Run
1. **Frontend Compilation**: `tsc -b && vite build` (Strict TypeScript, Vite bundle production build).
2. **Backend Compilation**: `tsc` via `npm --prefix server run build`.
3. **Frontend Linter**: `npm run lint` across 324 files.
4. **Backend Test Suite**: Vitest suite of 44 test files and 427 unit/integration tests (`npx vitest run`).
5. **Database Sync**: Prisma SQLite dev sync and PostgreSQL production schema alignment.

---

## 2. Summary & Verdict

- **Overall Health**: Healthy & Production-Ready.
- **Defects Discovered & Remediated**:
  - `[Resolved] [H-1]`: Avatar endpoint accepted arbitrary filetypes (including PDF brochures) via generic `processAndSaveFile`. Fixed by introducing `detectMediaType(buffer) !== 'image'` check, returning HTTP 400 for non-image payloads.
  - `[Resolved] [M-1]`: Type comparison mismatch in `ProjectsSection.tsx` between `ViewMode` and string literal `'cards'`. Fixed to compare `view === 'grid' ? 'cards' : 'table'`.
  - `[Resolved] [M-2]`: Missing import of `UserRights` and `ToggleableAdminStatus` in `UsersTable.tsx` during avatar component inclusion. Restored.
- **Defect Counts**:
  - **Critical**: 0
  - **High**: 0 (1 fixed)
  - **Medium**: 0 (2 fixed)
  - **Low / Informational**: 2 (documented below)

---

## 3. Detailed Audit Passes

### Pass 1: Compile & Type Safety
- **Frontend**: `tsc -b && vite build` completed in 363ms with 0 errors. All TypeScript interfaces (`AdminUser`, `AdminUserInput`, `UserDto`) synchronized with backend DTOs.
- **Backend**: `tsc` built with 0 errors. Prisma client regenerated to include `avatar String?`.

### Pass 2: Logic & Branching
- **Skeletons**: `SectionState.tsx` cleanly handles 4 variants:
  - `table`: Simulates search bar, action buttons, table header, and data rows.
  - `cards`: Simulates 3-column project card grid with 16:10 image ratio placeholders and tags.
  - `form`: Simulates settings / edit panel fields and action buttons.
  - `detail`: Simulates project show / inquiry show detail layouts.
- **Profile Flow**:
  - `handleAvatarChange`: Validates client-side file type and 5MB size limit before transmission.
  - Clears `fileInputRef.current.value` in `finally` to allow re-uploading the same file after modification.
  - Disables interactive triggers during upload (`avatarUploading`).

### Pass 3: Boundary & Input Validation
- **Size Limits**: Enforced at Fastify multipart level and buffer length (`5 * 1024 * 1024` bytes) with HTTP 413.
- **File Signatures**: Content-Type header from client is ignored. Magic byte inspection via `detectMediaType` ensures true JPEG, PNG, WebP, GIF, TIFF, or AVIF image bytes.
- **Re-encoding**: `sharp(fileBuffer).rotate().resize().webp({ quality: 82 })` sanitizes EXIF tags and discards executable or polyglot payloads.
- **Filenames**: Saved as `crypto.randomUUID().webp`. User-supplied filenames are never concatenated into the file path, preventing directory traversal.

### Pass 4: Security & Authentication
- **Access Control**: `/api/auth/me/avatar` protected by `onRequest: [authenticate]` JWT middleware. Users can only modify their own avatar.
- **WebAuthn Passkeys**: Rely on cryptographic challenge verification, origin checks matching `config.appUrl`, and user presence/verification flags.

### Pass 5: Concurrency & State Management
- `AdminProfilePage`: Updating user profile triggers both `setCurrentUser(updatedUser)` in React state and `refreshUser()` to sync localStorage / session state.
- `AdminSidebar`: Listens to `currentUser` from admin context and dynamically displays the new avatar image with initials fallback.

---

## 4. Observations & Low/Informational Notes

### [L-1] Previous Custom Avatar Cleanup on File Replace
- **Where**: `server/src/routes/auth.routes.ts`
- **Observation**: When an admin uploads a new avatar to replace an existing one, the old webp file in `uploads/` is orphaned rather than deleted.
- **Risk**: Very low storage impact for admin profiles (< 100KB per image). Can be addressed in a background garbage collection job or explicit unlink in future cleanup.

### [L-2] React Compiler Lint Warnings on `setState` in Effects
- **Where**: `DataTable.tsx`, `MailSettingsSection.tsx`, `ApplicationsSection.tsx`, `AdminProfilePage.tsx`
- **Observation**: 43 warnings regarding `react(set-state-in-effect)`. These are synchronization patterns for initial form values when `currentUser` loads asynchronously.
- **Remediation**: Functional and safe; can be refactored with key-based resets or initial value derivation during upcoming code quality refactor.

---

## 5. Test Evidence
- **Vitest**: `44 passed (44)`, `427 passed (427)`.
- **Avatar Test Suite**: `server/test/avatar.test.ts` (3/3 tests passed in 169ms):
  1. Rejects unauthenticated requests with HTTP 401.
  2. Uploads valid image, updates user, verifies `GET /api/auth/me`, and deletes avatar.
  3. Rejects non-image files (e.g. PDF) with HTTP 400.
