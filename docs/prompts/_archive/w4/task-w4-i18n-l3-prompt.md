# Task w4-i18n-l3 — translate users, roles, project components, floor plan, root admin components

Start only after `task-w4-i18n-core` is merged. **Also start only after the auth lane (`lane/auth`: tasks A, A2, B, C) is merged into `feat/backend-admin`**: tasks A2, B and C change the users list, the create wizard and the edit dialog, which this lane owns. Read `D:\projects\html\ajda\docs\prompts\_archive\wave4\task-w4-i18n-core-report.md` first. Own worktree and branch; touch only the files under "Files owned".

## Goal
Complete AR+EN translation and feedback polish for the users and roles UI, the project editing components, the floor-plan editor and the root-level admin components.

## Read first
`docs/ADMIN-I18N.md` (spec, rules, glossary, lane procedure: follow it exactly), `D:\projects\html\ajda\docs\prompts\_archive\wave4\task-w4-i18n-core-report.md`, `src/i18n/admin/core.ts`, every owned file.

## Files owned
`src/components/admin/users/*` (UserCreateWizard, UserFormDialog, `usersModel.ts`, `useUsersDirectory.ts`, table and cards), `src/components/admin/hr/*` (RoleFormDialog, `rolesModel.ts`, the rest), `src/components/admin/projects/*`, `src/components/admin/floorplan/*`, and the files directly inside `src/components/admin/` (`ProjectCreateModal.tsx`, `BuildingVisualizer.tsx`, `UsersPermissionsManager.tsx`).

Area files you fill: `users`, `roles`, `floorplan`, and in `projects` only keys prefixed `projects.components.` (every other `projects.*` key belongs to l1).

## Specific fixes in this lane (from the UI review)
1. Replace the three native `window.confirm` dirty-close prompts (`UserCreateWizard.tsx`, `UserFormDialog.tsx`, `ProjectCreateModal.tsx`) with the styled `confirm({ ..., danger: true })`, triggered by Esc, backdrop and close button alike; Esc closes only the topmost layer (the confirm), never both.
2. Everything coming from `usersModel.ts` / `rolesModel.ts` (permission names, role names, status labels, validation messages) becomes functions of `t`; the permissions matrix shows localised permission labels with short localised descriptions.
3. Users table: "last active" shows a localised relative text and a date through `adminFormat`; the "never signed in" state is localised.
4. `useUsersDirectory.ts` toasts: classify success/error; delete, deactivate, password reset and invite resend each end in one toast.
5. Floor-plan editor: every tool name, tooltip, status and validation message localised; save/publish feedback via toast.

## Browser checks specific to this lane
User list, create wizard (3 steps, validation, Esc with data), edit dialog (tabs, dirty close), roles list and role dialog, project create modal, floor-plan editor and visualizer, all in AR and EN. Use dev port 5188.

## Gates, constraints, report
As in the lane procedure of `docs/ADMIN-I18N.md`; report file `D:\projects\html\ajda\docs\prompts\task-w4-i18n-l3-report.md`.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.
