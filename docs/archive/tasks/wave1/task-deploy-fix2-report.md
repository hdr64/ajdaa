# Task deploy-fix2 — report

Test-only automation (owner policy change), applied on top of
`task-deploy-fix-prompt.md` / `task-deploy-fix-report.md`. **No commits were
made** (working tree only), nothing was installed, no `.env*` / dump /
`.backup` file was read, and `server/src/**` was not touched.

The policy this implements: **no automated step may ever run a command
against the production database or production files that could delete data.**
CI deploys the test instance only; production is deployed by hand.

---

## 1. Files changed

| File | Change |
|---|---|
| `deploy/remote-deploy.sh` | **test instance only.** `PROD_DIR`, the pre-migration backup function, the `/var/www/ajda` mirror and every prod branch are gone; the target `prod` (and anything else) exits 1 with "production is deployed manually, see README-deploy.md". Fixed values: dir `/srv/ajda/test`, unit `ajda-api-test`, port 4001. New **database guard** (§3) that runs before the checkout and before any npm command |
| `deploy/ssh-entry.sh` | accepts only `^test [0-9a-f]{40}$`; execs `/srv/ajda/test/deploy/remote-deploy.sh`; the comments no longer mention production |
| `.github/workflows/deploy.yml` | the `target` input is gone, one environment `test`, concurrency group `deploy-test`, the SSH command always sends `test <sha>`. The fix from `task-deploy-fix` is kept: the gate checks out `ref: ${{ inputs.ref \|\| github.sha }}` and resolves the commit from `HEAD` |
| `deploy/ajda-api-test.service` | `WorkingDirectory`, `EnvironmentFile` and `ReadWritePaths` point at `/srv/ajda/test/server/...`; the `ProtectHome` comment is shortened to the node binary under `/home/salah/.nvm` (the hardening itself is unchanged) |
| `deploy/test.env.example` | the paths point at `/srv/ajda/test`; `DATABASE_URL` documents that the name must end with `_test` (the deploy script refuses anything else) |
| `deploy/Caddyfile` | the test block serves `/srv/ajda/test/dist`; the stale comment about the `/var/www/ajda` mirror was rewritten (the mirror no longer exists) |
| `deploy/sanitize-test-db.sql` | the header comment now shows the absolute path `/srv/ajda/test/deploy/sanitize-test-db.sql` and says "Run it only against `ajda_test`, never against `ajda`" |
| `deploy/README-deploy.md` | test-only CI and the manual production runbook (§6.1) at the top; `/srv/ajda/test` everywhere; §3.1 documents `sudo mkdir -p /srv/ajda/test && sudo chown salah:salah /srv/ajda/test`; §3.4 is now the step-by-step creation of the test database from production with a bold "never run these against `ajda`" warning; §4.2/§4.3 lost the production `authorized_keys` example and the `ajda-api` sudoers rule; §5 describes the single `test` environment; §6.1 is the new production runbook; §7 no longer asks for traverse rights on `/home/salah` |
| `task-deploy-report.md` | corrected so it matches the final files (the prod target, the `/var/www/ajda` mirror, the old paths, the workflow environment, the probes and the owner checklist); the corrections are listed in the new §7 |

Not touched (out of scope): `server/src/**`, `deploy/ajda-api.service`,
`deploy/ajda-backup.service`, `deploy/ajda-backup.timer`,
`server/scripts/backup_db.sh`, the production block of the Caddyfile.

---

## 2. Gate results

All commands were run in this session on Windows (PowerShell) and in WSL2
(Ubuntu, kernel 6.6.87.2) for the Linux tools.

### 2.1 Gates

| Command | Result |
|---|---|
| `bash -n deploy/remote-deploy.sh deploy/ssh-entry.sh` | **OK** — no syntax error |
| `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` (WSL, PyYAML 6.0.1) | **OK** — the file parses; the parsed workflow is: `triggers: {'push': {'branches': ['deploy-test']}, 'workflow_dispatch': {'inputs': {'ref': {...}}}}`, `verify.outputs: {'sha': …}`, `environment: {'name': 'test'}`, `concurrency: {'group': 'deploy-test', 'cancel-in-progress': False}`, `deploy.needs: verify`, the deploy step env has no `TARGET` any more, `checkout with: {'ref': '${{ inputs.ref \|\| github.sha }}', 'fetch-depth': 0}` |
| `grep -rnE 'test-app\|prod\b' deploy .github` | **no `test-app` hit left**; the remaining `prod` hits are listed in §2.3 |

### 2.2 Behaviour probes (WSL, throwaway git repo + fake `.env`)

The probes ran against a copy of `deploy/remote-deploy.sh` whose `TEST_DIR`
was rewritten to the throwaway instance (`/tmp/ajda-probe/instance`) and a
copy of `deploy/ssh-entry.sh` whose `DEPLOY_SCRIPT` was rewritten the same
way. The `.env` files contain a **dummy** URL only
(`postgresql://dummy:dummy@127.0.0.1:5432/…`); nothing real was touched.

**(a) target `prod` is rejected**

```
$ remote-deploy.sh prod 0123456789abcdef0123456789abcdef01234567
Usage: remote-deploy.sh <test> <git-ref>

  test       deployment target (the only one that exists)
  git-ref    a 40-character commit SHA, or a branch name matching
             ^[A-Za-z0-9._/-]+$

Production is deployed manually - see deploy/README-deploy.md.
2026-10-21T21:00:30Z level=error production is deployed manually, see README-deploy.md
    -> exit code: 1
```

**(b) database name `ajda` is rejected**

```
$ remote-deploy.sh test <sha>      # DATABASE_URL=...5432/ajda?schema=public
2026-10-21T21:00:30Z level=info event=deploy.start target=test dir=/tmp/ajda-probe/instance unit=ajda-api-test ref=0123...4567
2026-10-21T21:00:30Z level=error database guard: the database name must end with _test (got 'ajda') - refusing to deploy
    -> exit code: 1
```

**(c) database name `ajda_test` passes the guard**

```
$ remote-deploy.sh test <sha>      # DATABASE_URL=...5432/ajda_test?schema=public
2026-10-21T21:00:30Z level=info event=deploy.start target=test dir=/tmp/ajda-probe/instance unit=ajda-api-test ref=0123...4567
2026-10-21T21:00:30Z level=info event=db.guard.ok name=ajda_test
2026-10-21T21:00:30Z level=info event=deploy.previous_commit sha=d5f09f73bb82fdc052b047a424ba33d0b8d3f5d2
fatal: 'origin' does not appear to be a git repository
...
2026-10-21T21:00:30Z level=error aborted at line 292
    -> exit code: 1
```

The guard log line comes **before** the checkout (`deploy.previous_commit` →
`git fetch`), which is the ordering the policy requires. The run then stops
because the throwaway repo has no `origin` — the deploy itself was not
exercised.

**(d) a missing `.env` is rejected**

```
$ rm server/.env && remote-deploy.sh test <sha>
2026-10-21T21:00:30Z level=info event=deploy.start target=test dir=/tmp/ajda-probe/instance unit=ajda-api-test ref=0123...4567
2026-10-21T21:00:30Z level=error database guard: /tmp/ajda-probe/instance/server/.env is missing - refusing to deploy
    -> exit code: 1
```

**(e) `ssh-entry.sh` rejects `prod <sha>`**

```
SSH_ORIGINAL_COMMAND='prod 0123456789abcdef0123456789abcdef01234567'
2026-10-21T21:00:30Z level=error event=ssh.denied reason=unexpected-command
    -> exit code: 1

SSH_ORIGINAL_COMMAND='test deadbeef'          # too short
2026-10-21T21:00:30Z level=error event=ssh.denied reason=unexpected-command
    -> exit code: 1

SSH_ORIGINAL_COMMAND='prod'
2026-10-21T21:00:30Z level=error event=ssh.denied reason=unexpected-command
    -> exit code: 1

SSH_ORIGINAL_COMMAND='test 0123456789abcdef0123456789abcdef01234567'
2026-10-21T21:00:30Z level=info event=ssh.accept target=test ref=0123456789abcdef0123456789abcdef01234567
2026-10-21T21:00:30Z level=info event=deploy.start target=test dir=/tmp/ajda-probe/instance unit=ajda-api-test ref=0123...4567
2026-10-21T21:00:30Z level=error database guard: /tmp/ajda-probe/instance/server/.env is missing - refusing to deploy
    -> exit code: 1
```

### 2.3 Every remaining `prod` hit (`grep -rnE 'test-app|prod\b' deploy .github`)

| Hit | Why it stays |
|---|---|
| `deploy/ajda-api-test.service:48` | `prod.log` / `errors.log` are the names of the log files |
| `deploy/ajda-api.service:24,48` | the production unit and its `db:gen:prod` script — the prod unit stays as it is |
| `deploy/README-deploy.md:52` | the names of the two log files |
| `deploy/README-deploy.md:151,383,509` | `npm --prefix server run db:gen:prod` — the name of a package script |
| `deploy/README-deploy.md:190,199,200` | §3.4: the **read-only** dump of `ajda` and the restore into `ajda_test` |
| `deploy/README-deploy.md:374` | the documentation that the `prod` target is rejected |
| `deploy/remote-deploy.sh:100` | the `prod)` branch that rejects the target |
| `deploy/remote-deploy.sh:266,304` | `db:gen:prod` — the name of a package script |
| `deploy/test.env.example:61` | `LOG_FILE_PATH="./prod.log"` — the name of the log file |

No `test-app` hit remains anywhere under `deploy/` or `.github/`.

---

## 3. The database guard

`deploy/remote-deploy.sh` → `check_database_target()`:

* reads **only** the `DATABASE_URL` line of `<instance>/server/.env` (the
  first match; the value is stripped of its quotes and of the surrounding
  whitespace with shell parameter expansion, never with a subprocess);
* drops the query string, then takes the path segment after the last `/`;
* requires the name to be a plain identifier (`^[A-Za-z0-9_.-]+$`) — otherwise
  the URL was not parsed the way it was meant to be;
* requires the name to match `^[A-Za-z0-9_]*_test$` — otherwise it aborts;
* logs **only** `event=db.guard.ok name=<dbname>`;
* aborts (exit 1) when the file is missing, when the line is missing, or when
  the name cannot be parsed.

The URL, the user and the password are never printed, never logged and never
handed to another command. The guard runs **after** the instance directory
check but **before** `acquire_lock`, before `git checkout` and before any
`npm` command.

Extra probes (same harness): no `DATABASE_URL` line → rejected; a URL
without a database name → rejected; a URL with a trailing slash → rejected;
an unquoted value → accepted; an upper-case `AJDA_TEST` → rejected (the
pattern is lower-case); a `mysql://…/ajda_test` URL → **accepted** (the guard
looks at the name only, not at the scheme) — that limitation is documented in
README §9.

---

## 4. Decisions

1. **The `prod` target has its own branch** instead of falling into the
   generic "unknown target" error, so the operator gets the actionable
   message ("production is deployed manually, see README-deploy.md") instead
   of a syntax error.
2. **The deploy script comes from the test checkout**
   (`/srv/ajda/test/deploy/remote-deploy.sh`), not from the production one:
   CI is test-only, so the production checkout must not be able to influence
   what CI runs. The forced-command wrapper stays installed at
   `/srv/ajda/deploy/ssh-entry.sh`.
3. **The guard checks the database *name*, not the host.** A `DATABASE_URL`
   that points at a remote host with a `_test` database would pass. Checking
   the host would need a second rule the policy did not ask for; the
   limitation is documented instead.
4. **The production pre-migration backup was removed with the production
   branch.** The manual runbook (§6.1) takes a verified dump instead, with
   `pg_restore --list` and a size check, and mirrors the uploads with
   `rsync -a` (no `--delete`).
5. **The `/var/www/ajda` mirror was removed.** With the mirror gone, the two
   production Caddy roots (`/var/www/ajda` in the repository file vs
   `/srv/ajda/app/dist` in the verified layout) no longer stay in sync on
   their own — the owner has to reconcile the live Caddyfile before the next
   production release. The repository file was **not** changed (out of scope),
   only the stale comment about the mirror was corrected.
6. **The production runbook is text, not a script.** It walks the owner
   through: verified dump → checkout the approved SHA → read every pending
   migration (with the `grep -nEi 'drop|truncate|delete'` helper and the
   explicit "do not continue if a pending migration contains DROP, TRUNCATE,
   DELETE or ALTER … DROP" rule) → migrate → build, swap, restart → restore
   the dump on rollback.
7. **The sudoers rule for `ajda-api` was deleted**, so CI cannot even
   restart the production API. The `authorized_keys` entry and the GitHub
   `production` environment were removed for the same reason.

---

## 5. Not verified / known risks

* **Nothing was run against the real VPS.** No unit was installed or
  started, no `authorized_keys`/sudoers rule was applied, no Caddyfile was
  validated, no database was created, no dump was taken and no deploy was
  executed — production or test.
* **No GitHub Actions run happened.** The YAML parses and the expressions
  were reviewed; the runner, the secrets and the `test` environment are
  unproven.
* **The deploy itself was not exercised end to end.** The probes stop at the
  guard, because the throwaway repo has no `origin`. `npm ci`,
  `db:migrate`, the dist swap, the restart and the health check are
  unchanged code, but they were not re-run in this session.
* **The database guard was not tested against a real PostgreSQL URL.** The
  probes use a dummy URL in a fake `.env`; the parsing is pure shell and was
  exercised with eight different URL shapes (§3).
* `shellcheck` is still not available on this machine; the two scripts were
  reviewed by hand and exercised with the probes above.
* The `remote-deploy.sh` copies used by the probes had `TEST_DIR` /
  `DEPLOY_SCRIPT` rewritten — the shipped files keep the fixed
  `/srv/ajda/test` values.
* The `TRUST_PROXY=1` / `HOST=127.0.0.1` recommendations (from
  `task-deploy-fix`) were not exercised against a running server; they come
  from the Caddyfile (one proxy hop) and the sec0 config.
* The production Caddy root is still unreconciled (`/var/www/ajda` in the
  repository file vs `/srv/ajda/app/dist` in the verified layout). It is now
  an owner action before the next production release.
