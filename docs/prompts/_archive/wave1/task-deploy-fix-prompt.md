# Task deploy-fix — fixes after review

Worktree lane `deploy`. Follow-up to `task-deploy-report.md`. Do exactly the items below.

## Read first
`task-deploy-report.md`, `.github/workflows/deploy.yml`, `deploy/test.env.example`, `deploy/README-deploy.md`, `deploy/sanitize-test-db.sql`, `server/prisma/schema.prisma`.

## Decided design
1. **Test gate must test what is deployed.** In job `verify`, the `actions/checkout@v4` step gets `ref: ${{ inputs.ref || github.sha }}`, so lint/build/tests run on the commit that is deployed. Keep `fetch-depth: 0`.
2. **Branch input.** In the "Resolve deployment context" step, resolve `DISPATCH_REF` robustly: try `git rev-parse --verify "origin/${DISPATCH_REF}^{commit}"`, fall back to `"${DISPATCH_REF}^{commit}"`; fail with a clear message if neither works. Validate `DISPATCH_REF` against `^[A-Za-z0-9._/-]+$` first. Because step 1 checks out the input ref, the plain `git rev-parse HEAD` is then enough, so you may simplify: after checkout, `sha=$(git rev-parse HEAD)` for both cases. Choose the simplest correct form and say which in the report.
3. **`deploy/test.env.example`:** set `TRUST_PROXY=1` (test sits behind Caddy; `false` would make all visitors share one IP for rate limiting). Rewrite the `HOST` comment: the sec0 change makes `HOST` effective; `127.0.0.1` is correct behind Caddy on the same host. Add a note that with `NODE_ENV=production` the server refuses to boot unless `JWT_SECRET` (≥32 chars, no placeholder), `LOGS_SECRET_KEY` and `DEVELOPER_NOTES_SECRET` (≥24 chars) are set, and add `SEED_ADMIN_PASSWORD` as a documented variable for the seed (≥10 chars, letter + digit). Add the same required-variables note for production to `deploy/README-deploy.md`, with `TRUST_PROXY=1` and a warning NOT to set `HOST=0.0.0.0`.
4. **README test login.** In `deploy/README-deploy.md` section about sanitizing, state that after the script admin emails are `test-admin-<uuid>@example.test` and give the exact query to list them: `sudo -u postgres psql -d ajda_test -c "SELECT email, role FROM \"AdminUser\";"`; password is the documented test password. Say explicitly: run the seed first, then the sanitize script, never the reverse.
5. **Sanitize script.** Add a clearly marked section for the new foundation tables, written defensively so the script works on a database that does not have them yet: wrap in a `DO $$ BEGIN IF to_regclass('public.job_applications') IS NOT NULL THEN DELETE FROM job_applications; END IF; END $$;`. (Applications are PII and should not be copied to test.)

## Out of scope
Caddyfile root reconciliation (owner action), `server/src/**`, anything else.

## Constraints
No commits, no installs, do not read `.env*`, `*.sql` data or `*.backup`. Free model only.

## Gates
`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` (WSL), `bash -n deploy/remote-deploy.sh deploy/ssh-entry.sh`, `npm run lint`, `npm --prefix server run build`.

## Report
Write `task-deploy-fix-report.md`: files changed, gate results, decisions.
