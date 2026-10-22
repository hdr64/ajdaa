# Task deploy — report

Scope: add a **test** deployment of Ajda next to production and a GitHub
Actions workflow that deploys to it (automatic) and to production (manual,
approval-gated). Files only — every server-side step is documented for the
owner to apply by hand. **No commits were made** (working tree only), nothing
was installed, no `.env*` / dump / `.backup` data file was read, and
`server/src/**` was not touched.

> **Corrected (2026-10-22).** This report describes the first delivery. Two
> follow-up tasks changed the design and the files:
> `task-deploy-fix-prompt.md` (see `task-deploy-fix-report.md`) and
> `task-deploy-fix2-prompt.md` (see `task-deploy-fix2-report.md`). The final
> state is **CI deploys the test instance only**; production is deployed by
> hand. The sections that were affected are marked **[corrected]** and the
> full list of corrections is in §7.

> Disclosure: the tracked Prisma **schema DDL** files
> (`server/prisma/migrations/**/migration.sql`) were read, because the
> sanitizing SQL script had to be written against the real table and column
> names. They contain no data. No `.env` file, database dump or `.backup`
> file was opened.

---

## 1. Files changed

| File | Change |
|---|---|
| `deploy/remote-deploy.sh` | **new** — server-side deploy runner (`<test\|prod> <git-ref>`) **[corrected: test instance only — `test <git-ref>`, with a database-name guard]** |
| `deploy/ssh-entry.sh` | **new** — forced-command wrapper for the deploy SSH key **[corrected: accepts `test <sha>` only]** |
| `deploy/ajda-api-test.service` | **new** — test unit (`:4001`, test checkout, test paths) **[corrected: checkout is `/srv/ajda/test`]** |
| `deploy/ajda-api.service` | hardening restored (`PrivateTmp`, `PrivateDevices`, `ProtectSystem=full`, `ProtectHome=read-only`, kernel/protection switches, `RestrictSUIDSGID`, `RestrictNamespaces`, `LockPersonality`, `SystemCallArchitectures=native`, `RestrictAddressFamilies`, `ReadWritePaths`) |
| `deploy/ajda-backup.service` | hardening restored; `EnvironmentFile` is now **only** `/srv/ajda/app/server/.env.backup` (the app `.env` is no longer exposed); `ReadWritePaths=/var/backups/ajda` |
| `deploy/ajda-backup.timer` | unchanged — the `/srv/ajda/app/...` path fix is kept |
| `deploy/sanitize-test-db.sql` | **new** — anonymizes a copy of the production database for the test instance **[corrected: adds a guarded delete of the foundation table `job_applications`]** |
| `deploy/test.env.example` | **new** — test instance `.env` template **[corrected: `TRUST_PROXY=1`, `HOST` comment, production secret rules, `SEED_ADMIN_PASSWORD`]** |
| `deploy/Caddyfile` | **new** `test-ajda.weghetk.com` block; existing blocks untouched except one explanatory comment above the production block **[corrected: the test block serves `/srv/ajda/test/dist`]** |
| `deploy/README-deploy.md` | rewritten: `deploy.sh` removed, stale `/opt/ajda` paths replaced by the verified `/srv/ajda/app` / `/srv/ajda/test` layout, plus test-instance setup, SSH key, `authorized_keys`, sudoers, GitHub setup, backup/restore **[corrected: added the manual production runbook (§6.1) and the test-database creation steps (§3.4)]** |
| `.github/workflows/deploy.yml` | replaced (see §4) **[corrected: test-only — one `test` environment, no `target` input, concurrency `deploy-test`; the gate checks out the deployed ref]** |
| `server/scripts/backup_db.sh` | additionally mirrors `server/uploads` into `/var/backups/ajda/uploads/` with `rsync -a` (**no** `--delete`); dump retention logic unchanged |
| `docs/TODO.md` | the `deploy/deploy.sh` reference replaced |
| `.gitignore` | `*.backup`, `*.sql`, `.deploy/` added (with negations, see §3.6) |

Not touched (out of scope): `r.txt`, `review/`, `task-*.md`, `server/src/**`,
`md/ajda.md` (does not exist in the repo — `md/` is gitignored and no file is
present, so there was nothing to clean there).

---

## 2. Gate results

All commands were run in this session on Windows (PowerShell) and, where a
Linux tool was needed, inside WSL2 (Ubuntu, kernel 6.6.87.2).

### 2.1 Project gates

| Command | Result |
|---|---|
| `npm run lint` | **exit 0** — oxlint, no findings |
| `npm run build` | **exit 0** — `✓ built in 390ms` (only the pre-existing >500 kB chunk warning) |
| `npm --prefix server run build` | **exit 0** — `tsc`, no output |
| `npm --prefix server test` | **exit 0** — `Test Files 20 passed (20)`, `Tests 146 passed (146)`, duration 27.98 s |

### 2.2 Shell / unit / YAML gates

| Command | Result |
|---|---|
| `bash -n deploy/remote-deploy.sh deploy/ssh-entry.sh` | **OK** (bash 5.2) |
| `bash -n server/scripts/backup_db.sh` | **OK** after stripping `\r`; the Windows working copy is CRLF (`core.autocrlf`), the committed blob is LF (verified: `git show HEAD:server/scripts/backup_db.sh` has 0 CR) and the server checkout is LF |
| `shellcheck deploy/remote-deploy.sh deploy/ssh-entry.sh` | **not run** — shellcheck is not installed on this machine and installing it was out of bounds |
| `systemd-analyze verify deploy/ajda-api.service deploy/ajda-api-test.service deploy/ajda-backup.service deploy/ajda-backup.timer` | **no unit-file syntax errors** (exit 0). Only environment warnings: the node path `/home/salah/.nvm/...` and `/srv/ajda/app/...` do not exist here, `postgresql.service` is unknown in WSL, and the files are "executable/world-writable" because of the Windows filesystem |
| `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))"` | **OK** (WSL, PyYAML 6.0.1) — top-level keys `name, on, permissions, jobs`; jobs `verify`, `deploy`; `deploy.needs: verify`; **[corrected]** `environment.name: test`; `concurrency: {group: deploy-test, cancel-in-progress: false}`; actions pinned to `actions/checkout@v4`, `actions/setup-node@v4`; `verify` checks out `ref: ${{ inputs.ref \|\| github.sha }}` |

### 2.3 Behavioural probes (WSL, throwaway git repos — nothing real was touched)

`deploy/remote-deploy.sh`:

| Probe | Outcome |
|---|---|
| no arguments | usage + `expected 2 arguments, got 0`, exit 1 |
| target `staging` | `unknown target 'staging'`, exit 1 |
| ref `abc; rm -rf /` | `invalid git ref`, exit 1 — rejected before any git call |
| ref `a b` (space) | rejected, exit 1 |
| ref `a..b` | rejected, exit 1 |
| ref `--upload-pack=evil` | rejected, exit 1 |
| ref `main.lock` | rejected, exit 1 |
| valid SHA, instance dir missing | `instance directory … does not exist`, exit 1 |
| full flow on a throwaway repo | lock acquired → `.deploy/previous` written → `git fetch --prune origin` → `git checkout --detach <sha>` → `npm ci` (failed: no package.json in the fake repo) → exit 1 |
| prod, 10-byte dump | `dump … is only 10 bytes — refusing to migrate`, exit 1, **no migration** |
| prod, 4096-byte dump | guard passes (`event=backup.ok path=… bytes=4096`) → build step reached |
| prod, backup script fails | `pre-migration backup failed — refusing to migrate`, exit 1 |

**[corrected]** The three `prod` rows above describe a code path that no
longer exists: the production target, the pre-migration backup and the
`/var/www/ajda` mirror were removed in `task-deploy-fix2`. The current
behaviour was probed again after that change — see
`task-deploy-fix2-report.md` §2 (target `prod` is rejected with "production
is deployed manually", the database guard rejects a non-`_test` database, a
missing `.env` is rejected, and `ssh-entry.sh` denies `prod <sha>`).

`deploy/ssh-entry.sh`: empty command, `prod; rm -rf /`, short SHA and unknown
target are all denied (`event=ssh.denied reason=unexpected-command`, exit 1);
a well-formed command with a missing deploy script exits 1 with
`reason=deploy-script-missing`. **[corrected]** The accepted shape is now
`^test [0-9a-f]{40}$` only.

`server/scripts/backup_db.sh` (with `pg_dump`/`pg_restore` stubbed): dump
written, `pg_restore --list` verification passed, retention pruning ran, and
uploads were mirrored (`2 file(s)`). After deleting a file from the source
uploads, a second run **kept** it in the backup → the no-`--delete` guarantee
holds.

---

## 3. Decisions made

1. **Forced command vs. prod checkout.** Item 7 asks for
   `command="/srv/ajda/deploy/ssh-entry.sh"` while item 11 requires the forced
   command to end up in `/srv/ajda/app/deploy/remote-deploy.sh` (prod
   checkout) for both targets. `ssh-entry.sh` therefore execs the **absolute**
   path `/srv/ajda/app/deploy/remote-deploy.sh` (overridable with
   `AJDA_DEPLOY_SCRIPT`), so it works from either location. The README
   documents the `/srv/ajda/deploy/ssh-entry.sh` wrapper (item 7 wording) and
   the in-checkout alternative, including the note that deploy-script updates
   arrive with the next production deploy and that the first install is a
   manual `git pull`.
   **[corrected]** The prod checkout is gone from the picture: `ssh-entry.sh`
   now execs `/srv/ajda/test/deploy/remote-deploy.sh` and accepts
   `^test [0-9a-f]{40}$` only.
2. **Rollback rebuilds the SPA too.** The brief says "rebuild server" on
   failure; the API and the SPA are served together, so leaving the new bundle
   next to the rolled-back API would be a broken site. `rollback()` rebuilds
   both and then restarts the unit.
3. **Frontend build without `npx`.** `./node_modules/.bin/tsc -b` and
   `./node_modules/.bin/vite build --outDir dist.new --emptyOutDir` instead of
   `npx …`, so `npx` can never try to fetch a package from the network.
   Equivalent to `tsc -b && vite build --outDir dist.new`; the swap is
   `mv dist dist.old; mv dist.new dist; rm -rf dist.old`.
4. **Production Caddy root.** The repository Caddyfile serves `/var/www/ajda`
   while the brief states the live server serves `/srv/ajda/app/dist`. Both
   cannot be true. The existing blocks were left unchanged (as instructed) and
   `remote-deploy.sh` mirrors every fresh build into `/var/www/ajda` when that
   directory exists and is writable, so either layout keeps serving the new
   bundle. **The owner should reconcile the live Caddyfile** — see §5.
   **[corrected]** The mirror is gone (the deploy script is test-only), so the
   two roots no longer stay in sync on their own: the owner must reconcile
   the live Caddyfile before the next production release. The production
   release is now a manual runbook (README §6.1).
5. **GitHub environment names.** Item 6 literally says `environment:
   ${{ target }}`, which would name the environment `prod`, while item 7 asks
   for environments `test` and `production`. The workflow maps
   `prod → production`, `test → test`, so the required-reviewer gate sits on
   `production` as intended.
   **[corrected]** There is a single environment now (`test`); the workflow
   has no `target` input and no production path at all.
6. **`.gitignore` needs two negations.** `*.sql` would also have hidden the
   tracked Prisma migrations, so `!server/prisma/migrations/**/migration.sql`
   and `!deploy/sanitize-test-db.sql` re-include them (verified with
   `git check-ignore`). `review/` is **not** ignored.
7. **Test admin password.** The seed supports `SEED_ADMIN_PASSWORD`
   (`server/prisma/seed.ts:140`), so the sanitize script sets every admin to
   the bcrypt hash of `AjdaTest!2026` and the README documents both the
   password and the equivalent seed command. The Caddy `basic_auth`
   placeholder is the bcrypt hash of `CHANGE_ME` — it must be replaced with
   `caddy hash-password --plaintext '…'`.
8. **Redis isolation.** `server/src/jobs` and `queueService.ts` hardcode the
   queue name `ajda-jobs` (BullMQ's `bull:` prefix is not configurable
   either). The test instance therefore uses **Redis DB index 1**
   (`redis://127.0.0.1:6379/1`) as the isolation boundary — documented in
   README §9 and in `deploy/test.env.example`.
9. **Backup unit secrets.** Per item 3 the backup unit now reads *only*
   `.env.backup` (the `-` prefix was dropped), so the file must exist and be
   mode 600 — documented in README §2. The nightly script additionally
   mirrors the uploads tree, which the new `ReadWritePaths=/var/backups/ajda`
   covers.
10. **`HOST=127.0.0.1`** is in the test template, but the current server build
    still binds `0.0.0.0` (`server/src/server.ts:7`) and `server/src/config/env.ts`
    has no `HOST` variable. The sec0 change owns that; not touched here.
    **[corrected]** The sec0 change landed: `HOST` is effective, the test
    template keeps `127.0.0.1`, and the README says explicitly that
    `HOST=0.0.0.0` must not be used.
11. **No queue/webhook settings exist to clear.** `AppSetting` keys are
    `site`, `security`, `mail`, `notifications`; there is no webhook table
    (`webhook` only appears in a comment in `notificationListeners.ts`). The
    sanitize script deletes `mail` and `notifications` and disables every
    `NotificationListener`, and the README lists this as a re-check point
    after a future schema change.

---

## 4. What the replaced workflow did

The old `.github/workflows/deploy.yml` was **"Deploy Vite App to GitHub
Pages"**: on a push to `main` it checked out the repo, set up Node 20, ran
`npm ci` and `npm run build`, then published `dist/` to GitHub Pages with
`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` and
`actions/deploy-pages@v4` under the `github-pages` environment, with
`pages: write` and `id-token: write` permissions and a `pages` concurrency
group. It never touched the VPS and was not a deployment of the API or of the
Caddy-served SPA. It has been replaced by the `verify` + `deploy` workflow
described in §2.2.

---

## 5. Not verified / known risks

**Not verified (nothing was run against the real VPS):**

* no systemd unit was installed or started; `systemd-analyze verify` ran under
  WSL without the real paths, users or `postgresql.service`;
* `caddy validate` was **not** run (Caddy is not installed here) — the
  Caddyfile was reviewed by hand only, and the `basic_auth` bcrypt hash was
  not checked by Caddy itself;
* no `authorized_keys`, sudoers rule, SSH key, database, role, `ajda_test`
  dump or sanitizing run was performed;
* the SQL in `deploy/sanitize-test-db.sql` was **not executed** against a real
  PostgreSQL. Every table and column was checked by hand against
  `server/prisma/schema.prisma` and the migration SQL (this caught one bug:
  the model `DeveloperNote` is mapped to the table `developer_notes`, not
  `DeveloperNote` — fixed);
  **[corrected]** it *was* executed later, against a scratch PostgreSQL 18.4
  cluster with a schema built by hand from `schema.prisma` — see
  `task-deploy-fix-report.md` §2.1;
* no GitHub Actions run happened: the workflow YAML parses and the expressions
  were reviewed, but the runner, the secrets, the environments and the
  approval gate are unproven;
* `npm run build` / `npm --prefix server test` ran on Windows; CI runs them on
  `ubuntu-latest`;
* the claim "Caddy serves `/srv/ajda/app/dist` in production" comes from the
  task brief, not from anything in this repository — the repository Caddyfile
  says `/var/www/ajda`. **Reconcile before replacing the live Caddyfile:**
  applying the repo file unchanged would point production at
  `/var/www/ajda`. The deploy-side mirror keeps the site serving the new
  bundle in the meantime, but the two roots should be unified deliberately;
  **[corrected]** the mirror is gone, so the reconciliation is now a
  prerequisite of the manual production release (README §6.1);
* `shellcheck` was not available, so the two shell scripts were reviewed
  manually and exercised with the hostile-input probes in §2.3 instead.

**Known risks / limitations:**

* `HOST` is ignored by the current server build → the test API listens on
  `0.0.0.0:4001` until sec0 lands. `basic_auth` + the Caddy block are the
  only barriers; keep them.
  **[corrected]** `HOST` is honoured now (sec0 landed): the test API binds
  `127.0.0.1:4001`.
* The queue prefix is not configurable; test/production isolation relies
  solely on the Redis database index.
* The Windows working copy of `server/scripts/backup_db.sh` is CRLF because of
  `core.autocrlf`. The committed blob and the Linux checkout are LF, so the
  server is unaffected. A `.gitattributes` with `*.sh text eol=lf` would make
  that explicit — deliberately **not** added (outside this task's scope).
* Git does not preserve the executable bit, so
  `chmod 755 deploy/remote-deploy.sh deploy/ssh-entry.sh` is needed after any
  checkout that changed them (documented).
* `git fetch --prune origin` inside the deploy requires the `salah` account to
  have read access to the origin repository (documented, not configured).
* `npm ci` runs while the previous API process is still serving; a lazy
  `require()` at runtime could hit the half-replaced `node_modules`. This is
  the same behaviour as the previous manual flow.
* Migrations are not reversible: the rollback restores code only, the data has
  to be restored from the dump (documented in README §6).
* The sanitize script covers the tables in the current schema; a future table
  with personal data needs a new statement.

---

## 6. Owner checklist (server side, by hand)

1. Create the test checkout (`/srv/ajda/test`), `.env` (from
   `deploy/test.env.example`), the `ajda_test` role/database, migrate + seed —
   README §3.
2. **[corrected]** Fill `ajda_test` from production (read-only dump, restore,
   sanitize) — README §3.4. **Never run those commands against `ajda`.**
3. Copy the uploads once (`cp -a`, never a symlink) — README §3.5.
4. Install `deploy/ajda-api-test.service`, `chmod 755` the deploy scripts,
   add the `authorized_keys` line and **the one** sudoers rule
   (`systemctl restart ajda-api-test`) — README §3.6, §4.2, §4.3.
5. Install the Caddyfile, generate a real `basic_auth` hash, make sure Caddy
   can read `/srv/ajda/test/dist`, reload — README §7.
6. GitHub: branch `deploy-test`, environment `test`, secrets `SSH_HOST`,
   `SSH_USER`, `SSH_KEY`, `SSH_KNOWN_HOSTS` — README §5.
7. Run one test deploy by hand before trusting the workflow.
8. **[corrected]** Production is deployed by hand with the runbook in
   README §6.1 — CI cannot deploy it and no `authorized_keys` entry or
   sudoers rule for `ajda-api` exists any more.

---

## 7. Corrections (2026-10-22)

Two follow-up tasks changed this delivery. The full reports are
`task-deploy-fix-report.md` and `task-deploy-fix2-report.md`; the summary:

| What | Before | Now |
|---|---|---|
| CI target | `test` or `prod` (manual approval) | **`test` only** — no production target in the workflow, the deploy script or the SSH wrapper |
| Deploy script | `<test\|prod> <ref>`, prod backup + `/var/www/ajda` mirror | `test <ref>` only; the prod branch, the pre-migration backup and the mirror are gone; a database-name guard refuses any database that does not end with `_test` |
| SSH wrapper | `^(test\|prod) [0-9a-f]{40}$` | `^test [0-9a-f]{40}$` |
| Test checkout | `/home/salah/ajda/test-app` | `/srv/ajda/test` (unit, Caddy root, README, template, script) |
| Test database | optional clone of production | documented step by step (README §3.4), with a bold "never run these against `ajda`" warning |
| Production release | partly automated (approval-gated CI) | a manual runbook (README §6.1): verified dump, read every pending migration, migrate, build, restart, restore-on-rollback |
| Gate | could test a different commit than the one deployed | the gate checks out the ref that is deployed (`ref: ${{ inputs.ref \|\| github.sha }}`) |
| `TRUST_PROXY` / `HOST` | `false` / "not honoured yet" | `1` (one Caddy hop) / honoured, with a warning against `0.0.0.0` |
| Sanitize script | the tables of the old schema | plus a guarded delete of the foundation table `job_applications` (personal data) |

**Could not be verified (still true):** nothing was run against the real VPS
— no unit installed, no Caddyfile validated, no `authorized_keys`/sudoers
rule applied, no database created, no GitHub Actions run, and no production
or test deploy executed. The scripts were exercised against throwaway repos
and a scratch PostgreSQL cluster only.
