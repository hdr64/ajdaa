# Task prompts

Every task handed to an implementing agent (OpenCode, agy, ...) is a prompt file here, and every report the agent writes lands next to it.

- **Active** (written, not yet finished): `docs/prompts/task-<x>-prompt.md`. The agent writes its report to `docs/prompts/task-<x>-report.md` in the main repo (`D:\projects\html\ajda`), even when the task runs in a worktree under `D:\projects\html\ajda-wt\`.
- **Finished** (reviewed and merged): the prompt and its report move together to `docs/prompts/_archive/<wave>/` (`w3`, `w4`, `w5`, ...; `early/` and `wave1/`, `wave2/` hold the older ones; new tasks use the `w<N>` form). Review notes of a task stay beside it (`task-<x>-review.md`).
- **Reusable** prompts that are run again and again have no `task-` prefix:
  - `code-quality-review-prompt.md` writes `code-quality-review.md` in the repo root; move the previous report to `docs/reviews/` first.
  - `master-review-brief.md` is the broader product + QA + architecture review brief (review folder `/review`).
- Review reports (findings lists, audits) live in `docs/reviews/`, named `<date>-<topic>.md`.
- No prompt or report files live in the repo root or inside worktrees. The order to run them in is `docs/TODO.md` section 3.

## Active now

| Prompt | State |
|---|---|
| `task-w4-i18n-server-prompt.md` | Not started. API messages are still English-only; check that this is still wanted before running. |
| `task-w2-monitoring-prompt.md` | Blocked on the owner's `MONITOR_ALLOWED_IPS` and `MONITOR_EXTERNAL_UNTIL`. |
| `task-w4-postgres-dev-prompt.md` | Dropped for now; revisit before the first production deploy. |
