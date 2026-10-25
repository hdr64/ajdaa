# Task prompts

Every task handed to an implementing agent (OpenCode, agy, ...) is a prompt file here, and every report the agent writes lands next to it.

- **Active** (written, not yet finished): `docs/prompts/task-<x>-prompt.md`. The agent writes its report to `docs/prompts/task-<x>-report.md` in the main repo (`D:\projects\html\ajda`), even when the task runs in a worktree under `D:\projects\html\ajda-wt\`.
- **Finished** (reviewed and merged): the prompt and its report move together to `docs/prompts/_archive/<wave>/` (`wave1`, `wave2`, ...; `early/` holds the first hand-offs). Review notes of a task stay beside it (`task-<x>-review.md`).
- **Reusable** prompts that are run again and again have no `task-` prefix, e.g. `code-quality-review-prompt.md` (writes `code-quality-review.md` in the repo root and archives the previous one in `docs/reviews/`).
- No prompt or report files live in the repo root or inside worktrees. The order to run them in is `docs/TODO.md` section 3.
