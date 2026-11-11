# task-cms-draft-c — Live draft preview, part C: wire the remaining CMS panels

> You are an implementing agent (OpenCode). Skip the "FIRST ACTION" section of `CLAUDE.md`; the secrets and production rules still apply. **Never edit any `CLAUDE.md`.**
> First action: run `Get-Date -Format "yyyy-MM-dd HH:mm:ss"` and keep it as `Started:`. Last action: run it again for `Finished:`.
> Series: A (iframe receives) → B (admin sends, Home wired, reviewed) → **C (this)**. Do only C.

## 1. Goal
Publish live drafts from the other seven CMS panels, exactly as Home does after B.

## 2. Read first
`CLAUDE.md`, `docs/prompts/task-cms-draft-b-report.md`, `src/components/admin/cms/cmsDirtyContext.ts`, `src/components/admin/cms/CmsHomePanel.tsx` (the reference wiring), `src/types/cms.ts` (`CmsSectionsPayload` and each section type), and the panels below.

## 3. Decided design
Each panel passes a fourth argument to its existing `useCmsDirty(...)` call. The panel key string must equal the `CmsSectionsPayload` key (it already does for all of them).

| Panel file | Current call | Draft |
|---|---|---|
| `CmsWorksPanel.tsx` (line ~58) | `useCmsDirty('works', data, loading)` | `(v) => v` if `data` is exactly `CmsWorksPageContent` |
| `CmsPastWorksPanel.tsx` (~22) | `'pastWorks'` | `(v) => v` if `CmsPastWorksPageContent` |
| `CmsNavPanel.tsx` (~27) | `'nav', items` | `(v) => v` (`CmsNavItem[]`) |
| `CmsFooterPanel.tsx` (~49) | `'footer', data` | `(v) => v` if `CmsFooterSection` |
| `CmsClientsPanel.tsx` (~61) | `'clientsPage', pageCopy, pageCopyLoading` | `(v) => v` if `CmsClientsPageContent`; the partner list (`clients`) is NOT part of this task and is not previewed |
| `CmsCareersPanel.tsx` (~22) | `'careers', data` | `(v) => v` if `CmsCareersPageContent` |
| `CmsContactPanel.tsx` (~89) | `'contact', { data, subjectPairs, trustEnabled, trustPairs }` | a converter, see below |

Rules:
- For every panel, first check that the state really has the payload section's type and nothing extra (open the panel and the type). If it does not, build the draft with the same function the panel already uses to build its save request body, never a second copy of that logic.
- **Contact**: the state holds `subjectPairs` and `trustPairs` (editable pairs) that are converted into `subjectsAr`/`subjectsEn` and the trust fields only when saving. Extract that conversion from the save handler into a pure function (in the same file or `src/components/admin/cms/contactPayload.ts`), use it from both the save handler (behaviour unchanged) and `toDraft`. Invalid half-filled pairs must produce a draft the page can render (skip empty pairs), not throw.
- `toDraft` must be defined outside the render path or be cheap and pure; it runs on every render while the panel is dirty.
- Do not change a panel's save, discard, load or version logic.

## 4. Verification
Run the app (sign in `admin@ajdaa.sa` / `password`); if you cannot, say so, run only the gates; Claude does the browser pass. For **each of the seven panels**: change one visible field, the preview (right pane) shows it within about half a second; discard reverts it; save keeps it with no flash of the old text. Check Arabic and English preview for at least Footer, Nav and Contact (Contact: add, edit and clear a subject, toggle the trust block). For Nav: reorder, disable and add an item; the preview header follows. Report each panel with what you saw, and name any panel whose edits do not appear in the preview and why (for example the preview route does not show that content).

## 5. Out of scope
The partner list, projects/works data, A/B files (protocol, provider, pane), i18n, server, docs.

## Constraints
No commits, installs or `.env` edits; do not touch `deploy/` or `server/`. Wanted `CLAUDE.md` changes go in the report under `## CLAUDE.md proposals for Claude`.

## Gates
`npm run lint` (baseline 46 warnings, none new), `npm run build`.

## Report
`D:\projects\html\ajda\docs\prompts\task-cms-draft-c-report.md`. Top lines: `Model:` (never guessed, `unknown` if unsure), `Started:`, `Finished:`. Then: files changed, a per-panel table (shape check, draft function, what you saw), gate results, decisions, what you could not verify. Claim nothing the commands did not show.

Run with a free OpenCode model: **Beam Free**.
