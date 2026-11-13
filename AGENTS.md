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
