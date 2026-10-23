# Task deploy-fix — report

Follow-up to `task-deploy-report.md`. Only the five items of
`task-deploy-fix-prompt.md` were in scope. **No commits were made** (working
tree only), nothing was installed, no `.env*` / dump / `.backup` file was
read, and `server/src/**` was not touched.

> Disclosure: `server/src/config/env.ts` and `server/prisma/schema.prisma`
> were read in the sibling worktrees (`ajda-wt/sec0`, `ajda-wt/foundation`) to
> confirm the variable names, the production secret rules and the table names
> of the foundation lane. Source code only — no data, no `.env` file.

---

## 1. Files changed

| File | Change |
|---|---|
| `.github/workflows/deploy.yml` | `verify` job now checks out the deployed ref (`ref: ${{ inputs.ref \|\| github.sha }}`, `fetch-depth: 0` kept); the "Resolve deployment context" step validates the ref, validates the target and resolves the commit from the checked-out `HEAD` |
| `deploy/test.env.example` | `TRUST_PROXY=1`; the `HOST` comment rewritten (the sec0 change makes `HOST` effective); a note about the variables the server refuses to start without in `NODE_ENV=production`; `SEED_ADMIN_PASSWORD` added as a documented seed variable |
| `deploy/README-deploy.md` | new §2.1 "Required variables in production" (secret rules, `TRUST_PROXY=1`, do-not-set `HOST=0.0.0.0`); §3.2 rewritten for the same points; §3.3 documents the seed password rule and the *seed first, sanitize second* order; §3.4 documents what the script does and adds §3.4.1 "Logging in to the test instance" with the exact query; §5 describes the new gate; §9 limitations updated |
| `deploy/sanitize-test-db.sql` | new section 8 for the foundation tables, written defensively (`to_regclass` guard) so the script also runs on a database that does not have them yet |

Not touched (out of scope): `deploy/Caddyfile`, `deploy/remote-deploy.sh`,
`deploy/ssh-entry.sh`, the systemd units, `server/src/**`.

---

## 2. Gate results

All commands were run in this session on Windows (PowerShell) and, where a
Linux tool was needed, inside WSL2 (Ubuntu, kernel 6.6.87.2).

| Command | Result |
|---|---|
| `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` (WSL, PyYAML 6.0.1) | **OK** — the file parses; the parsed `verify.steps[0].with` is `{'ref': '${{ inputs.ref \|\| github.sha }}', 'fetch-depth': 0}` |
| `bash -n deploy/remote-deploy.sh deploy/ssh-entry.sh` (WSL, bash 5.2) | **OK** — no syntax error |
| `npm run lint` (oxlint) | **exit 0** — no findings |
| `npm --prefix server run build` (tsc) | **exit 0** — no output |

### 2.1 Behavioural probe of the sanitize script (real PostgreSQL 18.4)

The Windows PostgreSQL 18.4 binaries were already installed, so a **scratch
cluster** was created in the temp directory (`initdb --auth=trust`, port
55432) — nothing of the project and no existing database was touched. The
script was executed with `postgres --single` (the server's own parser, so the
SQL is parsed by PostgreSQL, not by a client library). The `\set` meta-command
was stripped for the run because it is a psql command, not SQL; everything
else is the file as committed.

Fixture: a schema built from `server/prisma/schema.prisma` with
production-like rows (real admin addresses, a lead, a subscriber, SMTP and
notification settings, an enabled listener, a note with the admin e-mail, one
job application, one past project).

| Step | Result |
|---|---|
| bootstrap | no errors |
| state before | `admins_real_addr=2`, `otp=1`, `leads_real=1`, `appsettings_keys=mail,notifications,site`, `listeners_enabled=1`, `notes_with_admin=1`, `job_applications=1`, `past_projects=1` |
| run the sanitize script (foundation table **present**) | **no errors** |
| state after | `admins_test_addr=2`, `admins_real_addr=0`, `otp=0`, `leads_test=1`, `leads_real=0`, `subs_test=1`, `appsettings_keys=site`, `listeners_enabled=0`, `notes_with_admin=0`, **`job_applications=0`**, `past_projects=1` (kept) |
| `DROP TABLE job_applications` | table dropped |
| run the sanitize script again (foundation table **absent**) | **no errors** — the `to_regclass` guard skipped the missing table, every other statement still applied |
| state after | identical to the run above (idempotent) |

The scratch cluster was stopped and deleted afterwards.

---

## 3. Decisions

1. **The gate checks out the deployed ref, and the SHA comes from `HEAD`.**
   The checkout step now takes `ref: ${{ inputs.ref || github.sha }}`, so the
   working tree of the `verify` job *is* the tree that will be deployed. The
   "Resolve deployment context" step therefore does **not** re-resolve
   `origin/<ref>`: it validates the ref format and the target, then reads the
   commit from `git rev-parse --verify "HEAD^{commit}"` and checks that it is
   a 40-hex SHA. This is the "simplest correct form" the task allows, and it
   is the safer one: re-resolving `origin/<ref>` after the checkout could
   pick a *newer* commit than the one the gate just tested, which is exactly
   the bug the task asked to remove. The `origin/<ref>` → `<ref>` → error
   fallback chain was therefore not needed and is not implemented.
2. **The ref is still validated** (`^[A-Za-z0-9._/-]+$`, the same character
   class the server-side `remote-deploy.sh` accepts) even though the checkout
   would reject a bad ref first: the explicit message ("Invalid ref …") is
   the one the operator sees in the Actions log.
3. **`TRUST_PROXY=1`, not `true`.** The number is the number of proxy hops:
   exactly one (Caddy) sits in front of the API. `1` and `true` behave the
   same in the sec0 config, but the number is the honest value.
4. **`HOST=127.0.0.1` stays.** With the sec0 bind-address change the
   variable is effective, and the loopback address is the correct one behind
   Caddy on the same host. The template now says so instead of describing a
   pending change.
5. **The production rules are documented in both places.** §2.1 of the README
   covers production, §3.2 the test instance; the same three secrets and the
   same `TRUST_PROXY=1` / no-`0.0.0.0` warning appear in both, because the
   test instance also runs with `NODE_ENV=production` and would refuse to
   boot without them.
6. **`SEED_ADMIN_PASSWORD` is documented as a seed variable, not a server
   variable.** The seed reads it from the process environment
   (`server/prisma/seed.ts:140`) and does not load `.env` itself, so the
   template shows how to export it before running the seed. The length rule
   (≥ 10 characters, one letter, one digit) is the one the application
   enforces on password change (`server/src/services/passwordPolicy.ts`).
7. **The sanitize script deletes, it does not anonymize, the job
   applications.** Name, e-mail, phone, cover letter and CV path are personal
   data; there is no useful test data in them. `past_projects` (portfolio
   entries, no personal data) is deliberately left untouched.
8. **The CV files are not covered by the script.** The rows are deleted, the
   uploaded files are not; the README now says so in §3.4 and §3.5, because
   the uploads copy brings them along.

---

## 4. Not verified

* The workflow was **not executed** by GitHub Actions. The YAML parses and
  the shell fragment was reviewed line by line; the runner, the secrets, the
  environment and the approval gate are unproven.
* The `verify` job was **not** run on `ubuntu-latest` (the gates above ran
  on Windows).
* The sanitize script was executed against a **scratch schema** built by hand
  from `server/prisma/schema.prisma`, not against a database created by
  `prisma migrate`. The column names and the table names match the schema
  (the `developer_notes` mapping is respected), but a real migrated
  database was not used.
* The single-user execution mode was used (`postgres --single`), which
  ignores the file's `BEGIN`/`COMMIT` and prints a warning for the `COMMIT`
  ("there is no transaction in progress"); in a normal `psql -f` run the
  script runs in one transaction. The statements themselves are identical.
* `caddy validate` was **not** run (Caddy is not installed here) and no
  Caddyfile change was made.
* The `TRUST_PROXY=1` recommendation was derived from the Caddyfile
  (`reverse_proxy 127.0.0.1:4001` — one hop) and the sec0 config, and was
  not measured against a running instance.
* `server/src/**` was not changed, so the behaviour of the server with
  `TRUST_PROXY=1` and `HOST=127.0.0.1` was not exercised.
