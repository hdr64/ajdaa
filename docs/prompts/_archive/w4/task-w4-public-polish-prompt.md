# Task w4-public-polish — careers form and past-works page polish (public site)

Independent of the admin i18n tasks: touches only the two public pages below. May run in parallel with anything.

## Goal
Fix three small findings from the UI review of the public site.

## Read first
`src/pages/CareersPage.tsx` (196 lines; form, `inputClass` at ~118, heading at ~129, file input at ~174), `src/pages/PastProjectsPage.tsx` (header block at ~75-90, empty state at ~117-121; it already uses a local `t(ar, en)` helper), `src/services/careersService.ts` (CV limits the server enforces; read the matching rules in `server/src/routes/careers.routes.ts` and `server/src/config/` upload settings for the max size and allowed type).

## Decided design
1. `PastProjectsPage.tsx`: the empty-state text `لا توجد أعمال سابقة حالياً` is hard-coded Arabic. Use `t('لا توجد أعمال سابقة حالياً', 'No past works yet')`, same helper as the neighbouring strings.
2. `CareersPage.tsx` title spacing: the `<h1>` sits too close to the navbar and is visually weaker than the other public pages. Match `PastProjectsPage` header rhythm: container `pt-28 sm:pt-36`, add a short subtitle under the title (Arabic and English, via the page's existing language pattern): «نسعد بانضمامك إلى فريق أجدا. أرسل بياناتك وسيراجعها فريقنا.» / "We'd be glad to have you on the Ajda team. Send your details and our team will review them." Same classes as the subtitle on `PastProjectsPage`. Apply the same top padding to the success state (line ~108 branch) so it does not jump.
3. CV file input: replace the bare native input with a styled control: the native `<input type="file" accept="application/pdf" className="sr-only" id=...>` plus a `<label htmlFor>` styled like `brand-btn-secondary` (icon `Upload` from lucide-react) showing "Choose CV (PDF)" / «اختر السيرة الذاتية (PDF)». After a file is chosen show its name (truncated, `dir="ltr"`) with a small remove button (`X`, `aria-label` localised) that clears the input value and state. Under the control a hint line with the real limits read from the server config: "PDF only, up to N MB" / «ملف PDF فقط، بحد أقصى N ميجابايت» (hard-code N to the server value you found; add a comment pointing to the server constant). Client-side check before submit: wrong type or too large shows an inline localised error under the control (same style as the other field errors) and blocks submit. Keep keyboard access: the label must show a focus ring when the hidden input is focused (`peer` / `focus-within`).

## Out of scope
Everything else on both pages, `Footer.tsx`, `Navbar.tsx`, `src/i18n/translations.ts`, admin files, server files, form fields and validation of other fields, the submit/success flow.

## Constraints
No commits, no installs, no new dependencies, do not touch `.env*`. keep each file's existing line endings (the tree is CRLF with no `.gitattributes`; never rewrite a whole file just to change them). Match surrounding style and comment density. Use only existing CSS tokens and button classes.

## Gates
`npm run lint` (no new warnings), `npm run build`. In the browser (dev environment below: web 5189, API 4014): `/careers` in Arabic and English (RTL/LTR), desktop and 390 px wide; pick a PDF, pick a non-PDF, pick an oversized file (create a dummy file), remove the file, Tab to the control and check the focus ring; submit an empty form and check required errors still show; do NOT submit a valid application (it would create a record and send mail). `/past-works` with no data in English shows the English empty text. Stop the dev server afterwards.

## Report
Write `D:\projects\html\ajda\docs\prompts\task-w4-public-polish-report.md`: files changed, gate results, what you verified in the browser, the limits found in the server config and where, decisions made.

## Dev environment (prepared for you; use exactly this)
- Work only in the worktree `D:\projects\html\ajda-wt\small` (branch `lane/small`). Dependencies are installed, `server/.env` and the seeded SQLite `server/prisma/dev.db` are ready, mail is disabled (in-memory, nothing is delivered).
- API: from `server/`, `npm run dev` (listens on **4014**). Web: from the worktree root, set `VITE_API_PROXY_TARGET=http://localhost:4014` and run `npx vite --port 5189 --strictPort`.
- Login: `admin@ajdaa.sa` / `password` (super admin) or `dev@ajdaa.sa` / `password`.
- Do not edit `server/.env` or `.env.local`; never use ports 4000, 4011, 5173 or 5191 (other lanes and the owner). Stop your servers when done. On Windows a running API locks Prisma's engine file: stop it before `npm --prefix server test`.
- Task `w4-create-dev-user` may run in the same worktree at the same time; it touches only `server/scripts/`, `package.json` files and `deploy/README-deploy.md`. Do not touch those.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.
