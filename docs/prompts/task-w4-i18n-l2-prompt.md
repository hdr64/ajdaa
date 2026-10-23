# Task w4-i18n-l2 — translate CMS, settings, profile, feedback assistant

Start only after `task-w4-i18n-core` is merged. **Also start only after the auth lane (`lane/auth`: tasks A, A2, B, C) is merged into `feat/backend-admin`**: tasks B and C add the 2FA and passkey cards to the profile page and a switch to the security settings panel, which this lane owns. Read `D:\projects\html\ajda\docs\prompts\_archive\wave4\task-w4-i18n-core-report.md` first. Own worktree and branch; touch only the files under "Files owned".

## Goal
Complete AR+EN translation and feedback polish for the CMS panels, the settings panels, the admin profile page and the feedback assistant.

## Read first
`docs/ADMIN-I18N.md` (spec, rules, glossary, lane procedure: follow it exactly), `D:\projects\html\ajda\docs\prompts\_archive\wave4\task-w4-i18n-core-report.md`, `src/i18n/admin/core.ts`, every owned file.

## Files owned
`src/components/admin/cms/*` (CmsClientsPanel, CmsHomePanel, CmsFooterPanel, CmsWorksPanel, CmsContactPanel, CmsNavPanel, CmsVersionModal, CmsLivePreviewPane and the rest of the folder), `src/components/admin/settings/*` (AnnouncementPanel, NotificationListenersPanel, SecurityPanel and the rest, including the careers form-settings panel), `src/components/admin/profile/*`, `src/components/admin/feedback/*`.

Area files you fill: `cms` (all keys except the prefix `cms.section.`, owned by l1), `settings` (except `settings.section.`), `profile`, `feedback`.

## Specific points in this lane
1. CMS fields are bilingual content editors (AR/EN inputs): translate only the admin chrome (labels, hints, buttons), never stored content; keep the content-language labels explicit in both UI languages ("Arabic title" / "English title").
2. `CmsLivePreviewPane`, `AdminProfilePage`, `ConfirmChoicesCard`, `AdminFeedbackPet` already use `isAr ? ... : ...` ternaries: move all of them into the dictionary and remove the ternaries.
3. Every CMS save, publish, restore-version and delete ends in a toast of the right kind; version restore asks the styled confirm. Settings panels: save feedback in the panel plus a toast; test-email and test-connection buttons show a pending state and a result toast.
4. Notification-listener and security panels: event names, channel names, descriptions and role labels via keys (map the stored enum value to a key; never show the raw value).

## Browser checks specific to this lane
Each CMS tab (home, clients, works, footer, contact, nav) incl. version modal and live preview; each settings panel; profile page; feedback assistant open/close; all in AR and EN. Use dev port 5187.

## Gates, constraints, report
As in the lane procedure of `docs/ADMIN-I18N.md`; report file `D:\projects\html\ajda\docs\prompts\task-w4-i18n-l2-report.md`.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.
