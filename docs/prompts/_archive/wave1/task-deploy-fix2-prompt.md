# Task deploy-fix2 — test-only automation (owner policy change)

Worktree lane `deploy`. Apply this ON TOP of `task-deploy-fix-prompt.md` (do that file's items first if `task-deploy-fix-report.md` does not exist yet). Where this file conflicts with the earlier deploy prompt or report, THIS FILE WINS.

## Owner policy (non-negotiable)
- No automated step may ever run any command against the PRODUCTION database or production files that could delete data.
- GitHub Actions deploys ONLY to the test instance. It has no production target at all.
- Test instance: directory `/srv/ajda/test` (replaces `/home/salah/ajda/test-app` everywhere), port 4001, DB `ajda_test` (a copy of the prod DB made by the owner), unit `ajda-api-test`, host `test-ajda.weghetk.com`.
- The owner deploys the site the first time by hand, and deploys production by hand after users test `test-ajda` and the owner approves. Production is never deployed by CI, never by `ssh-entry.sh`.

## Read first
`task-deploy-report.md`, `deploy/remote-deploy.sh`, `deploy/ssh-entry.sh`, `deploy/ajda-api-test.service`, `deploy/ajda-api.service`, `deploy/ajda-backup.service`, `deploy/Caddyfile`, `deploy/test.env.example`, `deploy/README-deploy.md`, `deploy/sanitize-test-db.sql`, `.github/workflows/deploy.yml`, `server/scripts/backup_db.sh`.

## Decided design
1. **`remote-deploy.sh` becomes test-only.** Accept exactly one target, `test`; any other value (including `prod`) exits 1 with "production is deployed manually, see README-deploy.md". Remove `PROD_DIR`, the pre-migration backup function, the `/var/www/ajda` mirror and all prod branches. Fixed values: dir `/srv/ajda/test`, unit `ajda-api-test`, port 4001.
2. **Database safety guard (new, runs before `git checkout` and before any npm command).** Read ONLY the database name from `DATABASE_URL` in `/srv/ajda/test/server/.env` (parse the path segment after the last `/` and before `?`; never print the URL, user or password; never read other keys). Abort with exit 1 unless the name matches `^[A-Za-z0-9_]*_test$`. Also abort if `DATABASE_URL` is missing or the name cannot be parsed. Log only `event=db.guard.ok name=<dbname>`. Add this exact behaviour to the "never reads .env" header comment as the single, documented exception.
3. **`ssh-entry.sh`:** accept only `^test [0-9a-f]{40}$`; everything else denied. Update comments (no prod).
4. **Workflow `deploy.yml`:** triggers `push` on branch `deploy-test` and `workflow_dispatch` with only an optional `ref` input (no `target`). One environment `test`. Remove the `production` mapping and any prod wording. Keep the earlier fix (verify checks out the deployed ref) and the concurrency group `deploy-test`.
5. **Paths:** replace `/home/salah/ajda/test-app` with `/srv/ajda/test` in every file under `deploy/` and in the workflow, the service unit (`WorkingDirectory`, `EnvironmentFile`, `ReadWritePaths`), `test.env.example`, the README and `sanitize-test-db.sql` comments. Remove the README text about Caddy needing traverse permission on `/home/salah` (not needed for `/srv`); instead document `sudo mkdir -p /srv/ajda/test && sudo chown salah:salah /srv/ajda/test`. Test unit hardening stays; with `/srv` the `ProtectHome` note for the test unit can be shortened (node still lives under `/home/salah/.nvm`, keep that note).
6. **Test DB creation, documented step by step in the README (owner runs these by hand):** create role and DB `ajda_test`; take a dump of prod READ-ONLY (`pg_dump -Fc ajda > ...`, state clearly that this only reads production); `pg_restore` into `ajda_test`; run `deploy/sanitize-test-db.sql` against `ajda_test` ONLY; copy uploads once with `cp -a`. Every command that writes must name `ajda_test` explicitly; put a bold warning at the top of the section: "never run these against `ajda`".
7. **Production runbook (manual, owner only) in the README, replacing the old prod deploy section:** the commands the owner runs themselves, in order: (1) verified `pg_dump` backup of `ajda` with `pg_restore --list` check and size check, plus uploads backup with `rsync -a` (no delete); (2) `git fetch` and `git checkout --detach <approved sha>`; (3) list pending migrations with `npx prisma migrate status` and READ each pending `migration.sql`; the owner must not continue if it contains `DROP`, `TRUNCATE`, `DELETE` or `ALTER ... DROP`; show a one-line `grep -nEi 'drop|truncate|delete' server/prisma/migrations/*/migration.sql` helper limited to the pending folders; (4) only then `npm --prefix server run db:migrate`; (5) build, swap `dist`, restart; (6) rollback = restore the dump with `pg_restore`, noting migrations are not auto-reversible. No script for production is added; the runbook is text.
8. **Remove the production deploy pieces that CI no longer uses:** delete the sudoers line for `ajda-api` restart from the documented sudoers rules (keep only `sudo systemctl restart ajda-api-test`), the GitHub `production` environment/required-reviewer setup text, and the `authorized_keys` examples for prod. The prod units (`ajda-api.service`, `ajda-backup.*`) and the backup script stay as they are.
9. **Report corrections:** update `task-deploy-report.md` sections that describe prod targets, the `/var/www/ajda` mirror and old paths so the report matches the final files. State in the report what could not be verified.

## Out of scope
`server/src/**`, application features, changing prod units, adding any prod deploy script.

## Constraints
No commits, no installs, do not read `.env*`, `*.sql` data or `*.backup` files. Free model only.

## Gates
`bash -n deploy/remote-deploy.sh deploy/ssh-entry.sh`; YAML parse of the workflow (WSL `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/deploy.yml'))"`); `grep -rn "test-app\|prod\b" deploy .github` listing every remaining hit with a reason (only documentation of "production is manual" and the prod unit/backup files may remain). Behaviour probes in WSL on a throwaway git repo and a fake `.env` containing a dummy URL: (a) target `prod` is rejected; (b) DB name `ajda` is rejected; (c) DB name `ajda_test` passes the guard; (d) missing `.env` is rejected; (e) `ssh-entry.sh` rejects `prod <sha>`. Paste the outputs in the report.

## Report
`task-deploy-fix2-report.md`: files changed, probe outputs, decisions, unverified items.
