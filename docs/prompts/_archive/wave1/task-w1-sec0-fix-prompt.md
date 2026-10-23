# Task w1-sec0-fix — small follow-ups after review

Worktree lane `sec0`. Follow-up to `task-w1-sec0-report.md`. Do exactly the items below.

## Read first
`task-w1-sec0-report.md` (sections 3 and 6), `src/components/admin/users/usersModel.ts` (around line 92), `src/components/admin/users/UserFormDialog.tsx`, `server/src/services/passwordPolicy.ts`, `src/components/admin/layout/AdminFeedbackPet.tsx` (find it with grep), `server/.env.example`.

## Decided design
1. **Users form password rule.** The client must match the server policy (≥10 characters, at least one letter and one digit). Set `MIN_PASSWORD_LENGTH = 10` and add the letter + digit check wherever the form validates the password (`usersModel.ts`, and any hint text in `UserFormDialog.tsx` that states the old rule). Reuse the existing Arabic error-message style. Add no new files.
2. **Feedback widget.** Add `maxLength` to the title (200), body (5000), solution (5000) inputs of `AdminFeedbackPet.tsx`, and show the server's validation message in the error toast when the response carries one (keep the generic text as fallback).
3. **Report correction.** In `task-w1-sec0-report.md` fix the statement that production "must set `HOST=0.0.0.0`": behind Caddy on the same host the default `127.0.0.1` is correct and should be kept. In `server/.env.example` make the `HOST` comment say this (bind `0.0.0.0` only if the proxy is on another machine), and keep the `TRUST_PROXY` comment saying production behind Caddy needs `TRUST_PROXY=1`.

## Out of scope
Anything else, including `LOGS_PUBLIC`, CSP, `adminName`, README/api-reference.

## Constraints
No commits, no installs, never touch `.env*`, no server source changes except none (item 3 touches only `.env.example`). Free model only.

## Gates
`npm run lint`, `npm run build`, `npm --prefix server run build`, `npm --prefix server test` (counts must stay 29 files / 207 tests or higher).

## Report
Write `task-w1-sec0-fix-report.md`: files changed, gate results.
