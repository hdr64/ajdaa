# AGENTS.md

## web-agent-prompt
Config for Claude's web-agent-prompt skill (set up 2026-11-13). Implementing agents: ignore this section.

```web-agent-prompt
project: ajda                   # zip name prefix
tasks_dir: docs/temp/web-tasks  # one folder per task: prompt.md, zip, result/ (git-ignored)
zip_dir: docs/temp/web-tasks    # zip goes to <zip_dir>/<task>/
gates: npm run lint | npm run build | npm --prefix server run build | npm --prefix server test
always_include: CLAUDE.md
never_include: -
```

### Web agent tasks
Statuses: open (not sent yet) · sent · returned (in review) · ignored. Finished tasks are deleted (folder and row).

| Task | Status | Folder | Zip | Created | Note |
|---|---|---|---|---|---|
| card3d-a | open | docs/temp/web-tasks/card3d-a/ | ajda-main-73c2774-card3d-a.zip | 2026-11-13 | 3D badge + button on home project cards, admin switch `projectCards.show3d` (no migration). Old OpenCode prompt deleted. |
| card3d-b | open | docs/temp/web-tasks/card3d-b/ | not packed yet | 2026-11-13 | Per-project window/new-tab display, migration `20261115100000_project_model3d_display`. Pack only after card3d-a is applied and committed (needs `Project3dModal.tsx`). Old OpenCode prompt deleted. |
