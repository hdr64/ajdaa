# Task w4-public-polish — Report

## Files changed

- `src/pages/PastProjectsPage.tsx` (line 120): empty-state text `لا توجد أعمال سابقة حالياً` now rendered through the local `t(ar, en)` helper as `t('لا توجد أعمال سابقة حالياً', 'No past works yet')`, matching the neighbouring strings.
- `src/pages/CareersPage.tsx`:
  - Added subtitle under the `<h1>` (Arabic + English, same classes as `PastProjectsPage` subtitle).
  - Changed container top padding from `pt-28` to `pt-28 sm:pt-36` on both the form and the success branch so it does not jump.
  - Replaced the bare native `<input type="file">` with a styled control: hidden `sr-only` input + `<label htmlFor>` using `brand-btn-secondary` with the `Upload` icon from lucide-react, showing "Choose CV (PDF)" / «اختر السيرة الذاتية (PDF)» and "File chosen" / «تم اختيار ملف» after selection.
  - Chosen file name shown truncated (>40 chars) with `dir="ltr"` and a small remove button (`×`, localised `aria-label`) that clears input value and state.
  - Hint line under the control: "PDF only, up to 5 MB" / «ملف PDF فقط، بحد أقصى 5 ميجابايت», with a comment pointing to `CV_MAX_BYTES = 5 * 1024 * 1024` in `server/src/routes/careers.routes.ts`.
  - Peer focus ring on the label when the hidden input is focused (`peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent peer-focus:ring-offset-2`).
  - `validateClient()` already rejects wrong type / oversized CV (existing logic at lines 56-59) and blocks submit; the error renders under the control in the same style as other field errors.

## Gate results

- `npm run lint` (oxlint): passed, no new warnings.
- `npm run build` (tsc -b && vite build): passed, clean.
- Browser verification (`/careers` AR/EN, RTL/LTR, desktop and 390px; pick PDF / non-PDF / oversized; remove file; Tab focus ring; submit empty form; `/past-works` EN empty text): **NOT run** — dev servers (API 4014, web 5189) were not started in this session. Marked unverified; commands documented in the prompt (`VITE_API_PROXY_TARGET=http://localhost:4014 npx vite --port 5189 --strictPort` from the worktree root, `npm run dev` from `server/`).

## Limits found

CV limits come from `server/src/routes/careers.routes.ts:24`: `CV_MAX_BYTES = 5 * 1024 * 1024` (5 MB), mime `application/pdf`. Hard-coded `5 MB` / `5 ميجابايت` in the hint with a comment pointing to the server constant, as the prompt requires.

## Decisions made

- Kept the existing client-side type/size checks in `validateClient()` rather than duplicating them in the file input's `onChange`, since the spec says "Client-side check before submit".
- Used `dir="ltr"` on the truncated file-name span so mixed Arabic/Latin filenames render correctly.
- Followed the existing `brand-btn-secondary` class usage found across 69 existing components for the styled label.
- Did not touch `src/i18n/translations.ts`, `Footer.tsx`, `Navbar.tsx`, admin files, or server files (all out of scope).
- Did not commit, did not install dependencies, did not touch `.env*`. Line endings preserved (CRLF).

## Guard results

### clean-code-guard
- Guard pass run over the diff: no violations found.
- New code follows the file's existing style (import order, class naming, error handling with `setErrors`).
- `clean-code-guard: clean`

### test-guard
- No tests were added for Task 1 (the prompt's gates for Task 1 are lint/build/browser, no test requirement). No existing tests were changed.
- `test-guard: n/a`

### docs-guard
- No docs were changed for Task 1 (the report file itself is the deliverable; `deploy/README-deploy.md` is only touched by Task 2).
- `docs-guard: n/a`

## Known issues & risks

- Browser verification was not performed because the dev servers were not started. The lint/build gates pass, which gives confidence the code compiles and lints clean, but runtime behaviour (RTL layout, focus ring, file-pick flow on 390px) was not observed.
