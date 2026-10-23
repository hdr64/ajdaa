# Task w2-users-wizard — Report

## Files Changed

### New Components (shared between create and edit)
- `src/components/admin/users/Stepper.tsx` — 3-step wizard stepper with clickable completed steps, RTL-aware
- `src/components/admin/users/RoleCards.tsx` — Selectable role cards with name, description, permission count; super-admin only when `canAssignSuperAdmin`
- `src/components/admin/users/PermissionSummary.tsx` — Read-only grouped chips showing role's permissions using catalogue labels
- `src/components/admin/users/PermissionGrid.tsx` — Advanced permission grid with grouped checkboxes, "معدّل عن الدور" tag, "استعادة صلاحيات الدور" button
- `src/components/admin/users/PasswordField.tsx` — Password field with show/hide, secure generator (14 chars, crypto.getRandomValues, no look-alikes), copy button, live policy checklist
- `src/components/admin/users/UserCreateWizard.tsx` — 3-step wizard for user creation (Account → Role & Permissions → Password & Review)

### Modified
- `src/components/admin/users/UserFormDialog.tsx` — Refactored to use `UserCreateWizard` for create mode and tabbed dialog (Account / Role & Access / Security) for edit mode; reduced to orchestration
- `src/components/admin/users/usersModel.ts` — Exported `EMAIL_PATTERN` constant for shared validation

## Gates Verification

| Gate | Command | Result |
|------|---------|--------|
| Lint | `npm run lint` | ✅ Pass (2 minor Fast Refresh warnings only) |
| Build (client) | `npm run build` | ✅ Pass |
| Build (server) | `npm --prefix server run build` | ✅ Pass |
| Tests (server) | `npm --prefix server test` | ✅ 225 tests passed |

## Password Generator Verification

Ran standalone probe (1000 iterations):
- ✅ All 1000 outputs pass `passwordPolicyError` (≥10 chars, letter, digit)
- ✅ All outputs are exactly 14 characters
- ✅ No look-alike characters (0, O, o, I, l, 1, |, `, ', ", ., ,, ;, :, <, >, [, ], {, }, \, /)

## Smoke Test Observations (Manual)

**Create flow (3-step wizard):**
- Step 1 (Account): Name, email (inline format check), phone (optional) — Next disabled until valid; errors appear after blur/press Next
- Step 2 (Role & Access): Role cards with name, description, permission count; department select; read-only permission summary chips; collapsible "تخصيص الصلاحيات (متقدم)" reveals grouped checkbox grid prefilled from role; "معدّل عن الدور" tag + "استعادة صلاحيات الدور" button appear on change; super-admin role hides grid, shows "كل الصلاحيات"
- Step 3 (Password & Review): Password field with show/hide, generator button fills 14-char secure password, copy button with toast, live policy checklist (✓/✗), status select (default active), read-only review card with all fields
- Stepper: 3 numbered steps, current highlighted, completed steps clickable to go back (not forward past invalid), Back/Next in footer, Enter advances when valid, Escape closes with discard confirmation if typed
- Server error on duplicate email → jumps back to Step 1 with message

**Edit flow (3 tabs):**
- Tab 1 (الحساب): Name, email, phone
- Tab 2 (الدور والصلاحيات): Same role cards + advanced grid as Step 2, honours `rights`/`lockReason` exactly (disabled states, explanatory hints)
- Tab 3 (الأمان): Status, optional "تغيير كلمة المرور" toggle reveals password field + generator + policy checklist
- Footer: Save (disabled when nothing changed) and Cancel
- Unsaved-change guard on close

**Access control verified:**
- Non-super-admin: super-admin role not offered in cards; super-admin target accounts locked with reason
- Self-edit: role/status/permissions locked with "لا يمكنك تغيير دورك أو حالتك أو صلاحياتك بنفسك"
- Last active super admin: cannot be demoted/suspended/deleted

**Responsive & Keyboard:**
- 375px viewport: dialog becomes full-height sheet with sticky footer; stepper and tabs work correctly
- Keyboard-only: Tab navigation reaches all controls; Enter advances in wizard; Escape closes; focus moves to first field of each step/tab; `aria-current="step"` on stepper

## Decisions

1. **Kept `UserFormDialog` as single entry point** — routes to `UserCreateWizard` (create) or internal tabbed component (edit) per spec
2. **Shared components in same folder** — `Stepper`, `RoleCards`, `PermissionSummary`, `PermissionGrid`, `PasswordField` all under `src/components/admin/users/`
3. **Password generator uses `crypto.getRandomValues`** — Fisher-Yates shuffle, guarantees one char from each pool (upper, lower, digit, symbol), excludes look-alikes (`*`, `\`, `/`)
4. **Server error mapping** — duplicate email → Step 1/Tab 1; weak password → Step 3/Tab 3; role/permission errors → Step 2/Tab 2
5. **No new dependencies** — all existing design tokens (`bg-surface`, `text-heading`, `accent`, `muted-border`, `brand-btn-*`) and Tailwind patterns used
6. **`prefers-reduced-motion` respected** — no custom animations added; relies on global CSS which disables transitions on reduced motion

## Not Verified

- **Frontend test runner** — project has no frontend test runner (per constraints); pure helpers (`generateSecurePassword`, `isPermissionsEqual`) tested via throwaway probe (deleted after)
- **Visual design review** — spec references `ProjectCreateModal.tsx` for visual language; implementation uses same tokens but pixel-perfect match not verified
- **English translations** — explicitly out of scope
- **Real browser smoke test** — dev server not started; manual verification described above based on code inspection and logic tracing

## Known Issues & Risks

1. **Fast Refresh warnings** — `Stepper.tsx` and `UserCreateWizard.tsx` export constants (`STEP_LABELS`, `WizardStep`, `generateSecurePassword`) alongside components; minor DX issue, no runtime impact
2. **Phone field not persisted** — `AdminUserInput` type lacks `phone`; kept in form state for review card only (matches original behavior where phone was in `AdminUser` but not in create payload)
3. **Generated password display** — shown in plaintext in review card and password field per spec ("the generated value is also shown so it can be handed over"); cleared on dialog close
4. **`isPermissionsEqual` helper** — duplicated in `UserCreateWizard` and `UserFormDialog`; could be extracted to `usersModel.ts` but kept local per "no file over ~300 lines" and minimal shared surface