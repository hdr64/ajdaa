# Task w4-i18n-server — localised API messages (Arabic / English)

Server files only. **Start only after the auth lane (`lane/auth`: tasks A, A2, B, C) is merged into `feat/backend-admin`**: those tasks add and change many messages in `auth.routes.ts`. Independent of the frontend translation lanes.

## Goal
User-facing messages returned by the API (validation errors, auth errors, "not found", etc.) follow the language the admin UI is using, so English mode does not show Arabic errors in toasts. About 300 lines of Arabic live in `server/src`.

## Read first
`server/src/routes/*.routes.ts` (auth, careers, inquiries, newsletter, projects, developerNotes), `server/src/config/constants.ts`, `server/src/config/permissions.ts`, the error-handling middleware and `ApiError`-style helpers (find them with grep), `src/services/api.ts` (client request wrapper and `toApiError`), `docs/api-reference.md`.

## Decided design
- Client sends `Accept-Language: ar` or `en` (derived from `useLanguage()` through the language stored in localStorage key `LANG_STORAGE_KEY` from `src/context/languageContextDef.ts`; read it inside `api.ts` per request, default `ar`). One change in `src/services/api.ts` only (the single fetch wrapper); no other frontend file.
- Server: `server/src/i18n/messages.ts` exports `type Lang = 'ar' | 'en'`, `langOf(req)` (parses `Accept-Language`, first tag starting with `en` -> `'en'`, anything else `'ar'`), and `msg(req, { ar: '...', en: '...' })` returning the right string. Routes and services that return a message for a human replace the literal with `msg(req, {...})`. For code with no `req` (services), pass `lang` down from the route or return an error code and let the route call `msg`.
- Message text: keep the Arabic byte for byte; English is short and plain.
- Do not translate: logs, thrown internal errors that never reach the client, enum/permission keys, stored CMS default content in `defaultCmsContent.ts` (that is content, not a message), validation `field` names.
- Zod/validation field errors keep their structure (`fieldErrors`); only the message text is localised.
- Email templates (`mailTemplates.ts`) and notification listener texts are NOT changed in this task (they go to staff by email, separate decision); list them in the report with their current language.

## Out of scope
Any file outside `server/` except the single edit in `src/services/api.ts`; schema changes; changing status codes or response shapes; the rate-limit and lockout logic itself (only their message text).

## Constraints
No commits, no installs, no new dependencies, do not touch `.env*`, no database changes. keep each file's existing line endings (the tree is CRLF with no `.gitattributes`; never rewrite a whole file just to change them). Match surrounding style and comment density.

## Gates
`npm --prefix server run build`, `npm --prefix server run test` (all existing tests pass; the flaky pre-existing mail-settings "tampered box" test may fail alone: re-run it once and say so). Add tests: `langOf` parsing (missing header, `en-US,en;q=0.9`, `ar`, `fr`), and for three representative routes (login with a wrong password, a validation error on inquiries, a not-found project) the same request with `Accept-Language: en` and `ar` returns the matching language and the same status and shape. Leftover scan: `LC_ALL=C.UTF-8 grep -rnP "[\x{0600}-\x{06FF}]" server/src --include=*.ts` lists only: `server/src/i18n/messages.ts` and the `msg(...)` ar sides inside the calls, `defaultCmsContent.ts`, `mailTemplates.ts`, `notificationListeners.ts`; report any other hit.

## Report
Write `D:\projects\html\ajda\docs\prompts\task-w4-i18n-server-report.md`: files changed, count of messages localised per file, gate results, the leftover-scan output, the list of email/notification texts left as is, decisions made.

## Quality guards (mandatory skills)
These three skills must be followed. Load each with your skill tool by name; if the tool does not offer it, read the file directly:
- **`clean-code-guard`** (`C:\Users\salah\.claude\skills\clean-code-guard\SKILL.md`). Read its `references/ai-failure-modes.md` before you write code. Use **live mode** while writing production code, then run the **guard pass** and its "Self-check before delivery" over your whole diff before you write the report. Fix every violation you find.
- **`test-guard`** (`C:\Users\salah\.claude\skills\test-guard\SKILL.md`, plus `references/jest.md` for Vitest) for every test you add or change: behaviour not implementation, mocks only at system boundaries, data-driven variants instead of copy-pasted tests, no test without a bug it catches.
- **`docs-guard`** (`C:\Users\salah\.claude\skills\docs-guard\SKILL.md`) for every doc, README section, `.env.example` line and behaviour-describing comment you add or change: every name, flag, path and command you mention must be checked against the code.

When a skill conflicts with this prompt or with the existing code style, this prompt and the existing style win; say so in the report.
The report **must** contain a section `## Guard results` with, for each of the three guards: what you checked, the violations you found and fixed, and anything you left with the reason. A report without it is incomplete and will be sent back.
