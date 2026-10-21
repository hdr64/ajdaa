# Task deploy — test instance + GitHub Actions deploy

## Goal
Add a second (test) deployment of Ajda on the same VPS and a GitHub Actions workflow that deploys to it (auto) and to production (manual, approval-gated). Files only; the owner applies server-side steps by hand.

## Read first
- `deploy/` (all files, incl. `README-deploy.md`, `Caddyfile`, `ajda-api.service`, `ajda-backup.service`, `ajda-backup.timer`), `.github/workflows/deploy.yml` (existing; replace/rework it), `server/package.json`, `package.json`, `server/src/server.ts`, `server/src/config/*`, `server/src/app.ts` (health route), `server/scripts/backup_db.sh`, `.gitignore`
- Note: `deploy/deploy.sh` was deleted by the owner on purpose. Remove references to it from `deploy/README-deploy.md`, `docs/TODO.md`, `md/ajda.md`.

## Server facts (production, verified)
- Prod: `/srv/ajda/app`, user `salah`, systemd `ajda-api`, port 4000, DB `ajda` (local Postgres 5432), Redis local, node `/home/salah/.nvm/versions/node/v24.21.0/bin/node`, frontend served by Caddy from `/srv/ajda/app/dist`, uploads `./uploads` under `server/`. Domains: `ajdaa.sa` (real), `ajda.weghetk.com`.
- Prod `.env` lives at `/srv/ajda/app/server/.env` (never in git). 7.8 GB RAM, so building on the server is fine.
- Caddy uses Cloudflare origin cert `/etc/caddy/ajda-origin.pem|key` for `ajda.weghetk.com`.

## Decided design
1. **Test instance:** dir `/home/salah/ajda/test-app`, port `4001`, DB `ajda_test` (role `ajda_test`), Redis DB index 1 with its own queue prefix if the code supports one (check `server/src/jobs`; if not, document it), systemd unit `ajda-api-test`, host `test-ajda.weghetk.com`.
2. **`deploy/ajda-api-test.service`**: copy of the prod unit with test paths and `PORT=4001`.
3. **Restore hardening** in both `ajda-api.service` and `ajda-backup.service` (the uncommitted diff stripped it): `PrivateTmp`, `PrivateDevices`, `ProtectSystem=full`, `ProtectHome=read-only`, `ProtectKernelTunables/Modules/ControlGroups`, `RestrictSUIDSGID`, `RestrictNamespaces`, `LockPersonality`, `SystemCallArchitectures=native`, `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX`. `ReadWritePaths` = the instance's `server/uploads` and its two log files (`prod.log`, `errors.log`). Backup unit: `ReadWritePaths=/var/backups/ajda`, and ONLY `EnvironmentFile=/srv/ajda/app/server/.env.backup` (not `.env`). Keep the `.timer` path fix. Under `ProtectHome=read-only` the node binary under `/home/salah/.nvm` must stay readable; note this in the report.
4. **Bind address:** handled by another task (sec0). Do NOT edit `server/src/**`. In the test `.env` template just set `HOST=127.0.0.1`, `TRUST_PROXY=false`.
5. **`deploy/remote-deploy.sh <test|prod> <git-ref>`** (bash, `set -euo pipefail`, runs on the server as `salah`, no sudo except `sudo systemctl restart <unit>` which the owner will allow via sudoers; document that line):
   - map env to dir/unit/health URL (`http://127.0.0.1:4001|4000/api/health`; verify the real health route path in `server/src/app.ts`);
   - flock to prevent concurrent runs; record previous commit to `.deploy/previous`;
   - `git fetch --prune origin`, `git checkout --detach <ref>` (ref must be a 40-hex commit or branch name matching `^[A-Za-z0-9._/-]+$`);
   - for prod only: `pg_dump` backup via `server/scripts/backup_db.sh` before migrating;
   - `npm ci` (root and `server`), `npm --prefix server run db:gen:prod`, `npm --prefix server run db:migrate`, `npm --prefix server run build`;
   - frontend: build to `dist.new` (`npx vite build --outDir dist.new` after `tsc -b`), then swap: `mv dist dist.old; mv dist.new dist; rm -rf dist.old`;
   - `sudo systemctl restart <unit>`, then poll health up to 30 s; on failure `git checkout --detach <previous>`, rebuild server, restart, exit 1;
   - structured log lines with timestamps. No secrets printed.
6. **Workflow `.github/workflows/deploy.yml`** (replace the old content; first read it and mention in the report what it did before):
   - triggers: `push` to branch `deploy-test` (deploys test), and `workflow_dispatch` with inputs `target` (choice: test, prod) and `ref` (default: the triggering ref);
   - job `verify`: checkout, node 24 setup with npm cache, `npm ci`, `npm run lint`, `npm run build`, `npm --prefix server ci`, `npm --prefix server run build`, `npm --prefix server test`. Gate: deploy job `needs: verify`;
   - job `deploy`: `environment: ${{ target }}` (so `production` can require approval), `concurrency` group per target with `cancel-in-progress: false`, SSH using secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_KNOWN_HOSTS` (write key to a 600 file, `StrictHostKeyChecking=yes`, `UserKnownHostsFile` from secret), run `ssh ... "<target> <full-commit-sha>"` (the forced command on the server ignores everything except those two args; see 7);
   - pin all actions to major versions (`actions/checkout@v4`, `actions/setup-node@v4`); `permissions: contents: read`.
7. **Document in `deploy/README-deploy.md`** (short, exact commands, replacing outdated deploy.sh text): creating the deploy SSH key; the `authorized_keys` line `command="/srv/ajda/deploy/ssh-entry.sh",restrict ssh-ed25519 ...`; `deploy/ssh-entry.sh` (create it) which reads `$SSH_ORIGINAL_COMMAND`, validates `^(test|prod) [0-9a-f]{40}$`, and execs `remote-deploy.sh`; sudoers line; creating DB `ajda_test` and role; copying the prod dump into `ajda_test` then a **sanitizing SQL script** `deploy/sanitize-test-db.sql` that anonymizes user emails/names/phones/password hashes (read `server/prisma/schema.prisma` for the models; set a known test admin password hash only if the seed script provides one, otherwise leave it as a TODO note), and clears any stored tokens/webhook/mail settings; test `.env` template listing variables with placeholder values (`MAIL_*` empty so no real mail is sent, `QUEUE_DRIVER` as appropriate, `CLIENT_ORIGIN=https://test-ajda.weghetk.com`, `PORT=4001`, `HOST=127.0.0.1`); GitHub setup (environments `test`, `production` with required reviewer; secrets; branch `deploy-test`).
8. **`deploy/Caddyfile`:** add the `test-ajda.weghetk.com` block mirroring `ajda.weghetk.com`, with port 4001, root `/home/salah/ajda/test-app/dist`, header `X-Robots-Tag "noindex, nofollow"`, and `basic_auth` with a placeholder bcrypt hash and a comment on generating it (`caddy hash-password`). Keep existing blocks unchanged. Put a comment that the cert must cover the hostname (use `weghetk.com.pem` if it is a wildcard).
9. **`.gitignore`:** add `*.backup`, `*.sql` (except `deploy/sanitize-test-db.sql` via negation), `.deploy/`, `review/` is NOT ignored.

10. **Data preservation (owner requirement: production data and uploads must never be lost):**
   - `remote-deploy.sh` must never run `git clean`, `rm -rf` on `server/uploads`, or touch `.env*`. For prod, abort if the pre-migration dump is missing or smaller than 1 KB; keep the dump path in the log.
   - `server/scripts/backup_db.sh`: after the dump, also `rsync -a --delete-after` is FORBIDDEN; use `rsync -a` (no delete) of `server/uploads` to `/var/backups/ajda/uploads/` so deleted files are retained. Keep existing retention logic for dumps.
   - Test instance uploads are seeded by a one-time `cp -a` from a backup tarball (document the command), never a symlink or shared path with prod.
   - README-deploy.md: add manual restore steps (`pg_restore` for custom-format dumps, `psql` for plain), noting that migrations are not auto-reversible and rollback restores code only.

11. **Path decision (owner):** prod = `/srv/ajda/app`, test = `/home/salah/ajda/test-app` (use these exact paths everywhere; the earlier `/srv/ajda-test` text is superseded). `remote-deploy.sh` and `ssh-entry.sh` live in the repo under `deploy/`; the forced command must point at the PROD checkout copy `/srv/ajda/app/deploy/remote-deploy.sh` for both targets (document: deploy script updates arrive with the next prod deploy, so the first install is a manual `git pull` of the branch containing it). Test unit uses `ReadWritePaths` under `/home/salah/ajda/test-app/server` (works with `ProtectHome=read-only`). Document that Caddy's user needs traverse (`x`) permission on `/home/salah`, `/home/salah/ajda`, `/home/salah/ajda/test-app` (`chmod o+x` on the dirs only, or `setfacl -m u:caddy:x`); the existing `weghetk.com` site already lives under `/home/salah`, so check with `namei -l /home/salah/ajda/test-app/dist`.

## Out of scope
Release-symlink scheme, Docker, CI for the frontend tests (none exist), any app feature change beyond the `HOST` setting, touching `r.txt`, `review/`, `task-*.md`.

## Constraints
- No commits, no installs, do not read `.env*`, `*.sql`, `*.backup` data files. Do not touch the staged deletion of `deploy/deploy.sh`.
- Free model only.

## Gates (run all, paste results)
- `npm run lint`, `npm run build` (root); `npm --prefix server run build`, `npm --prefix server test` (no server source edits expected, so just confirm they still pass)
- `bash -n deploy/remote-deploy.sh deploy/ssh-entry.sh`; `shellcheck` on both if available
- `systemd-analyze verify` on the units if available (otherwise say not run)
- YAML parses: `node -e "require('yaml')"`-style check or `python -c "import yaml,sys;yaml.safe_load(open('.github/workflows/deploy.yml'))"`

## Report
Write `task-deploy-report.md`: files changed, gate results, decisions made, anything you could not verify.
