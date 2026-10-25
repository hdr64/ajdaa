# Task w5-careers-toggle — floating "Apply for a job" button and admin show/hide switches

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). It shares the working tree with the other `task-w5-*` prompts: run it only when none of them is running.

## Goal

Owner request (2026-10-25): add a floating "Apply for a job" button on the public site, and let an admin switch two things independently from the admin: (1) the footer "Apply for a job" item, (2) the floating button.

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply), `docs/ADMIN-I18N.md` (new admin strings need AR and EN keys; a browser check for raw keys and `missing key` warnings is mandatory)
- `server/src/services/siteSettings.ts` (the `SiteSettings` shape, `SITE_DEFAULTS`, merge and the guarded parse), `server/src/routes/settings.routes.ts` (`siteSettingsSchema`, public `GET /api/settings/site`, guarded `PUT`), `server/test/` site-settings tests and `helpers.ts`
- `src/context/siteSettingsContextDef.ts` and its provider, `src/hooks/useSiteSettings.ts`, `src/services/settingsService.ts`, `src/pages/admin/sections/SettingsSection.tsx` and the panel that edits announcement/maintenance (copy its switch style and save flow), `src/components/common/Footer.tsx` (the careers button near line 160), `src/App.tsx` (where the public shell, toast, `Footer` and the maintenance screen render), `src/i18n/admin/` settings keys

## Decided design (no open choices)

1. **Setting.** Extend `SiteSettings` with `careers: { showFooterLink: boolean; showFloatingButton: boolean }`. Defaults: both `true` (today's footer link stays; a production row saved before this change has no `careers` key, so the merge gives both `true`). Add it to `SITE_DEFAULTS`, the merge-over-defaults logic, the zod `siteSettingsSchema` in `settings.routes.ts` (both fields optional booleans in the request, merged so a client that predates the field cannot reset them), the client `SiteSettings` type, `settingsService.ts`, and the context's default value. The public `GET /api/settings/site` returns it with no other change.
2. **Admin UI.** In the same admin settings panel that holds announcement and maintenance, add a card "Careers" (AR/EN keys in `src/i18n/admin/`) with two switches: "Show the 'Apply for a job' item in the footer" and "Show the floating 'Apply for a job' button". Same save flow, same permission, same toast as the neighbouring settings; both switches work independently (all four combinations are valid). Explain in one line of helper text that the careers page itself stays reachable by URL either way.
3. **Footer.** Render the "Apply for a job" button in `Footer.tsx` only when `settings.careers.showFooterLink` is true. Nothing else in the footer changes.
4. **Floating button.** New `src/components/common/CareersFloatingButton.tsx`, rendered once by the public shell in `App.tsx` only when `settings.careers.showFloatingButton` is true. Behaviour:
   - A fixed button at the bottom, on the inline-end side (`fixed bottom-6 end-6`, logical classes only so it flips in RTL), `z-40`, with a briefcase icon from the icon library already used in the project. Icon plus the label ("قدّم على وظيفة" / "Apply for a job") from `sm` up, icon only below `sm` with an `aria-label` and a `title`.
   - Click navigates to the careers page through the existing `navigateTo('careers')`.
   - Not shown on the careers page itself, on any admin or admin-login page, or while the maintenance screen is displayed. Respect `prefers-reduced-motion` (no pulse animation when reduced); a subtle entrance only.
   - Must not cover other fixed UI: check the toast container, the cookie/consent UI if any, and the cinema/3D/interest modals (they have higher `z-index`, so the button must sit under them). Report the result of this check at 390 px and 1440 px width in both languages.
   - Use the project's existing theme tokens (accent colours) so it follows the classic and Prime themes and dark mode.
5. **Public strings** on the public site follow the existing pattern in `Footer.tsx` (language-based text), not the admin i18n.

## Tests (no mocks; real Fastify injector and throwaway SQLite)

- `GET /api/settings/site` returns `careers` with both `true` on a fresh database and for a stored row that lacks the key.
- `PUT /api/settings/site` with `careers: { showFloatingButton: false }` stores it, leaves `showFooterLink` unchanged, and a following GET returns both values; a non-boolean is rejected with 400. Each test must fail if the merge or the schema is removed.

## Out of scope

The careers page and its form, the careers email recipients, a navbar link, any redesign, other floating widgets (WhatsApp etc.), changes to maintenance or announcement behaviour.

## Constraints

- No commits, no installs, no `.env*` reads or writes, no production commands. No new dependencies. Match neighbouring code, preserve line endings. Do not edit files under `docs/prompts/` except your report. Update `docs/api-reference.md` for the new field.

## Gates (paste real output)

- `npm --prefix server run build`, `npm --prefix server test` (all green, report the count), `npm run lint`, `npm run build`
- **Browser pass (mandatory)** on a fresh scratch SQLite API as in `CLAUDE.md` (mail disabled), Arabic and English: the button appears on home, projects, contact; it is absent on the careers page, admin and the maintenance screen; click opens the careers page; in admin Settings toggle each switch and confirm the footer item and the button show/hide independently after save and after a page reload (all four combinations); a 390 px width check; no raw i18n keys and no `missing key` console warning.

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-careers-toggle-report.md`: files changed, per-item result, gate output, the overlap check results, decisions, anything not verified, and `## Guard results` as required by `docs/TODO.md` section 3.
