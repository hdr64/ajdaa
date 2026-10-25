# Task w5-client-fixes — client bugs from the whole-project review

Worktree: the **main repo** `D:\projects\html\ajda` (branch `feat/backend-admin`). Client only (`src/`). Do not touch `server/` and do not touch `ajda-wt/auth`.

## Goal

Fix eight confirmed client defects found in `docs/prompts/review-ajda-project.md` (read the entries C-1, H-10, M-3, M-4, M-25, M-26, M-28, M-29 first; each has the file, lines, trigger and fix).

## Read first

- `CLAUDE.md` (skip "FIRST ACTION"; the secrets and production rules apply), `docs/ADMIN-I18N.md`
- `docs/prompts/review-ajda-project.md` (the eight entries above)
- `src/pages/ProjectDetailPage.tsx`, `src/types/admin.ts`, `src/components/admin/users/UserCreateWizard.tsx`, `UserFormDialog.tsx`, `usersModel.ts`, `src/components/admin/cms/CmsClientsPanel.tsx`, `CmsContactPanel.tsx`, `src/components/admin/auth/ResetPasswordStep.tsx`, `src/components/admin/profile/AdminProfilePage.tsx`, `src/App.tsx`, `src/components/home/InteractiveProjectsMap.tsx`, `src/components/contact/ContactPage.tsx`, `src/components/booking/InterestRegistrationView.tsx`, `src/components/common/Footer.tsx`

## Decided design (no open choices)

For each item, **first re-read the cited lines. If the claim is false or already fixed, skip it and say so in the report.**

1. **C-1** `ProjectDetailPage.tsx`: split into `interestModalOpen: boolean` and `interestModalUnit: PropertyUnit | null`. `handleOpenInterest(unit?)` sets the unit to `unit ?? null` and open to `true`. Gate the modal, the body-scroll-lock effect (`:111-119`) and the title (`:1025`) accordingly. Closing resets both. Submitting with no unit sends `unitId: undefined`.
2. **H-10** add `phone?: string | null` to `AdminUserInput`; send `phone: form.phone.trim() || null` in the wizard payload (`UserCreateWizard.tsx:237`) and in the edit dialog payload. Server already accepts it; do not change the server.
3. **M-3** `CmsClientsPanel.tsx` `handleMove`: resolve the item from `filteredClients[index]`, find its index in `clients` by id, swap with the neighbour **in the filtered list**, mapped back to `clients` by id. Bounds are checked against the filtered list. Keep the existing persist call.
4. **M-4** `CmsContactPanel.tsx`: build the subject pairs once, drop a pair only when **both** sides are empty, and map `subjectsAr`/`subjectsEn` from the same surviving pairs. If exactly one side of a pair is empty, block the save with a field error in the panel's existing error style (use the existing `t()` mechanism; add AR and EN keys).
5. **M-25** replace the 8-character checks in `ResetPasswordStep.tsx` and `AdminProfilePage.tsx` with `passwordPolicyError()` from `usersModel.ts`, shown the same way the existing messages are.
6. **M-26** `UserFormDialog.tsx` `pickRole`: return early when the picked role equals the current role.
7. **M-28** `App.tsx` + `InteractiveProjectsMap.tsx`: make `navigateTo` carry `projectId` through route state and set the selected project so the "register interest" and "full details" targets open that project (read `App.tsx:265-284, 415-450` and follow how `selectedProperty` is used by the destination page).
8. **M-29** the three forms (`ContactPage.tsx`, `InterestRegistrationView.tsx`, `Footer.tsx`): a submit under 2 s no longer silently skips the API. Send it, with the existing honeypot/flag field if one exists; if none exists, send it as a normal submit. Remove the fake-success path.

## Out of scope

Everything else in the review (all server items, the other client items, SEO, tests for the client — there is no client test runner and you must not add one). No new dependencies. No refactors outside the lines you must change.

## Constraints

- No commits, no installs, no `.env*` reads or writes, no production commands.
- Match neighbouring code: naming, comment density, RTL (logical `start`/`end` classes), AR/EN keys through the existing admin i18n for admin screens.
- Do not edit files under `docs/prompts/` except your report.

## Gates (run them all, paste results)

- `npm run lint`
- `npm run build`
- Browser pass (mandatory; lint and build do not prove this): start the dev servers as described in `CLAUDE.md` for a fresh local API on SQLite, then verify in Arabic and English:
  - `/projects/206`: the main CTA and the cinema-modal CTA open the modal; submit once without a unit (expect 201, `unitId` null) and once from a unit card.
  - Admin → Users: create a user with a phone, confirm it is stored; edit the phone, confirm the `PUT` body carries it; click the already-selected role card and confirm permissions are unchanged.
  - Admin → CMS → Clients: filter, move an item, confirm the same pair moves as unfiltered. CMS → Contact: clear one EN subject, confirm save is blocked with a message.
  - Forgot-password and profile password change: a 8-character password is refused client-side with the policy message.
  - Home map: "register interest" and "full details" land on the chosen project.
  - A form submitted in under 2 s reaches the API.
  - No raw i18n keys and no `missing key` console warning on the admin screens you touched.

## Report

Write your report to `D:\projects\html\ajda\docs\prompts\task-w5-client-fixes-report.md`: files changed, per-item result (fixed / skipped with the reason), gate and browser results, decisions made, and `## Guard results` as required by `docs/TODO.md` section 3.
