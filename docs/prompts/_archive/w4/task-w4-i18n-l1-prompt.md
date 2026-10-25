# Task w4-i18n-l1 — translate admin section pages (+ applications, past projects)

Start only after `task-w4-i18n-core` is merged (`useAdminT`, `defineStrings`, typed `showToast`, the empty area files exist). Read `D:\projects\html\ajda\docs\prompts\_archive\wave4\task-w4-i18n-core-report.md` first for key conventions. Worktree `D:\projects\html\ajda-wt\i18n-l1`, branch `lane/i18n-l1`; touch only the files under "Files owned".

## Goal
Complete AR+EN translation and feedback polish for the admin section pages and the components of the applications and past-projects screens.

## Read first
`docs/ADMIN-I18N.md` (spec, rules, glossary, lane procedure: follow it exactly), `D:\projects\html\ajda\docs\prompts\_archive\wave4\task-w4-i18n-core-report.md`, `src/i18n/admin/core.ts`, `src/pages/admin/AdminDashboardPage.tsx` (how sections mount), every owned file.

## Files owned
`src/pages/admin/sections/*` EXCEPT `OverviewSection.tsx` (core): ApplicationsSection, CategoriesSection, CmsSection (shell only; panels belong to l2), DepartmentsSection, InquiriesSection, MailSettingsSection, NewsletterSection, PastProjectsSection, ProjectEditSection, ProjectShowSection, ProjectUnitsPanel, ProjectsSection, RolesSection (shell only), SettingsSection (shell only), UnitsSection, `inquiryUi.tsx`, `useDuplicateProject.ts`, `usePublishProject.ts`; `src/components/admin/applications/*`; `src/components/admin/pastProjects/*`.

Area files you fill: `projects`, `projectEdit`, `inquiries`, `applications`, `categories`, `pastProjects`, `departments`, `mail`, `newsletter`. For the three shell files only, use the key prefixes `roles.section.*`, `settings.section.*`, `cms.section.*` (other keys in those areas belong to l2/l3). In `projects`, lane l3 uses the prefix `projects.components.*`; you use every other `projects.*` key.

## Specific fixes in this lane (from the UI review)
1. `PastProjectFormDialog.tsx`: Esc, backdrop mouse-down and the close button all go through a dirty check (`confirm`, danger) when any field changed; replace the four `alert(...)` with `showToast(..., 'error')`; add `noValidate`, localised inline errors for required title and main image checked client-side before submit; map server `fieldErrors` to localised text per field (never show a raw English server message such as "Invalid URL": fall back to a localised generic message for that field); success toast after create/update; block double submit.
2. `PastProjectsSection.tsx`: toasts for delete, publish toggle and reorder (if present); delete through `confirmDelete`.
3. Applications screen: toasts for status changes and deletes; an empty state per filter ("No applications match this filter"); save feedback on the settings tab.
4. `ProjectsSection` / `ProjectEditSection`: every save, duplicate, publish, hide, delete ends in a toast of the right kind; the existing dirty-guard dialog text is translated.
5. `ProjectEditSection` / `ProjectShowSection`: labels for the 3D model link and brochure PDF in both languages.

## Browser checks specific to this lane
Past-project dialog (empty submit, title only, Esc with data), applications list incl. empty and filter states, project list cards, project editor (invalid 3D URL error, dirty cancel), categories, inquiries, newsletter, mail settings, departments, units, all in AR and EN. Use the dev environment below (web 5186, API 4013).

## Gates, constraints, report
As in the lane procedure of `docs/ADMIN-I18N.md`; report file `D:\projects\html\ajda\docs\prompts\task-w4-i18n-l1-report.md`.

## Dev environment (prepared for you; use exactly this)
- Work only in the worktree `D:\projects\html\ajda-wt\i18n-l1` (branch `lane/i18n-l1`). Dependencies are installed, `server/.env` and the seeded SQLite `server/prisma/dev.db` are ready, mail is disabled (in-memory, nothing is delivered).
- API: from `server/`, `npm run dev` (listens on **4013**). Web: from the worktree root, set `VITE_API_PROXY_TARGET=http://localhost:4013` and run `npx vite --port 5186 --strictPort`.
- Login: `admin@ajdaa.sa` / `password` (super admin) or `dev@ajdaa.sa` / `password`.
- Do not edit `server/.env` or `.env.local`; never use ports 4000, 4011, 5173 or 5191 (other lanes and the owner). Stop your servers when done. On Windows a running API locks Prisma's engine file: stop it before `npm --prefix server test`.
- Where `docs/ADMIN-I18N.md` says "API on 4000", use 4013.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.
