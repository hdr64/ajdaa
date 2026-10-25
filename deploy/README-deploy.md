# Deployment — Ajda (production + test instance)

Bare-metal deployment: Ubuntu + PostgreSQL + Redis + Node 24 (nvm) + Caddy.
The API runs as a systemd service, the SPA is served as static files by Caddy.

> `deploy/deploy.sh` was removed. The supported entry points are
> `deploy/remote-deploy.sh` (server-side, **test instance only**) and the
> GitHub Actions workflow `.github/workflows/deploy.yml`, which calls it over
> SSH.
>
> **CI deploys the test instance only.** It has no production target at all:
> `remote-deploy.sh` rejects every target except `test`, `ssh-entry.sh`
> accepts only `test <sha>`, and the workflow has a single `test`
> environment. **Production is deployed by hand**, with the runbook in §6.1.

## 1. Instances at a glance

| | production | test |
|---|---|---|
| checkout | `/srv/ajda/app` | `/srv/ajda/test` |
| systemd unit | `ajda-api` | `ajda-api-test` |
| port | `4000` | `4001` |
| health | `http://127.0.0.1:4000/api/health` | `http://127.0.0.1:4001/api/health` |
| database | `ajda` (role `ajda`) | `ajda_test` (role `ajda_test`) |
| Redis | DB 0 | DB 1 (`redis://127.0.0.1:6379/1`) |
| env file | `/srv/ajda/app/server/.env` | `/srv/ajda/test/server/.env` |
| hostname | `ajdaa.sa` | `ajda.weghetk.com` (no password, noindex) |
| Caddy root | `/srv/ajda/app/dist` (see §7) | `/srv/ajda/test/dist` |
| uploads | `/srv/ajda/app/server/uploads` | `/srv/ajda/test/server/uploads` |
| deployed by | **a human**, with the runbook in §6.1 | **GitHub Actions** (push to `deploy-test`) |

Both instances run as the unprivileged user `salah`, use the node binary at
`/home/salah/.nvm/versions/node/v24.21.0/bin/node`, and never share files.
Production data and production uploads are never touched by a test deploy.

## 2. Production (already running — reference only)

Production is **never** deployed by CI. The runbook for a manual production
release is §6.1.

```bash
sudo cp deploy/ajda-api.service deploy/ajda-backup.service deploy/ajda-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ajda-api ajda-backup.timer
curl -fsS http://127.0.0.1:4000/api/health
```

The API unit hardens the service (`ProtectSystem=full`, `ProtectHome=read-only`,
`PrivateTmp`, `PrivateDevices`, kernel/protection switches,
`SystemCallArchitectures=native`, `RestrictAddressFamilies=AF_INET AF_INET6
AF_UNIX`) and re-opens exactly two writable paths: the instance's
`server/uploads` and its two log files (`prod.log`, `errors.log`).

`ProtectHome=read-only` keeps `/home/salah` readable, so the nvm node binary
under `/home/salah/.nvm` stays executable — it only forbids writes there.

The backup unit reads **only** `/srv/ajda/app/server/.env.backup` (mode 600,
owner `salah`); the application's `.env` is not exposed to it.

```bash
sudo install -o salah -g salah -m 600 /dev/null /srv/ajda/app/server/.env.backup
sudo tee /srv/ajda/app/server/.env.backup >/dev/null <<'EOF'
DATABASE_URL="postgresql://ajda:<password>@localhost:5432/ajda?schema=public"
BACKUP_DIR=/var/backups/ajda
BACKUP_RETENTION_DAYS=14
EOF
```

### 2.1 Required variables in production

`/srv/ajda/app/server/.env` runs with `NODE_ENV=production`, and the server
**refuses to boot** unless these are set:

| Variable | Rule |
|---|---|
| `JWT_SECRET` | at least 32 characters, and not a placeholder (`change me`, `secret`, `password`, … are refused) |
| `LOGS_SECRET_KEY` | at least 24 characters |
| `DEVELOPER_NOTES_SECRET` | at least 24 characters |

```bash
openssl rand -base64 32    # a different value for each of the three
```

`TRUST_PROXY=1` is required as well. The API sits behind Caddy, which sets
`X-Forwarded-For`; with `TRUST_PROXY=false` every visitor would arrive with
the same IP (`127.0.0.1`) and the rate limiter would lock out the whole site
at once. Set it to the real number of proxy hops in front of the API — one,
here.

> **Do not set `HOST=0.0.0.0`.** The API must only be reachable through
> Caddy, on the loopback interface (`HOST=127.0.0.1`). `0.0.0.0` would expose
> the API directly to the whole VPS network, bypassing Caddy's TLS and its
> security headers.

## 3. Test instance (one-time, manual)

### 3.1 Checkout and dependencies

```bash
sudo mkdir -p /srv/ajda/test
sudo chown salah:salah /srv/ajda/test
git clone <your-repo-url> /srv/ajda/test
cd /srv/ajda/test
npm ci
npm --prefix server ci
```

The test instance lives under `/srv`, next to the production checkout
(`/srv/ajda/app`), so Caddy needs no special traverse rights on `/home/salah`
(§7) and the deploy scripts do not depend on the home directory.

### 3.2 Environment file

```bash
cp deploy/test.env.example server/.env
chmod 600 server/.env
openssl rand -base64 32     # JWT_SECRET, LOGS_SECRET_KEY, DEVELOPER_NOTES_SECRET
```

`deploy/test.env.example` is the full template. It pins `PORT=4001`,
`HOST=127.0.0.1`, `TRUST_PROXY=1`,
`CLIENT_ORIGIN=https://ajda.weghetk.com`, Redis DB `1`, and leaves every
`MAIL_*` value empty so no real mail can ever be sent from the test instance.

The same production rules as §2.1 apply to the test instance
(`NODE_ENV=production`): `JWT_SECRET` (≥ 32 characters, no placeholder),
`LOGS_SECRET_KEY` (≥ 24) and `DEVELOPER_NOTES_SECRET` (≥ 24) must all be set
or the server refuses to boot.

> `HOST` is honoured by the current server build (the sec0 bind-address
> change): the API listens on `127.0.0.1:4001` and Caddy is the only public
> entry point. **Do not set `HOST=0.0.0.0`** — the test port would be
> reachable from the whole VPS network, bypassing Caddy.
>
> `TRUST_PROXY=1` (one trusted hop, Caddy) is required: with `TRUST_PROXY=false`
> every visitor would look like the same IP to the rate limiter.

### 3.3 Database and role

The role and the database of the test instance (the same two commands are
step 1 of §3.4, which fills the test database with production data):

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE ajda_test LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
CREATE DATABASE ajda_test OWNER ajda_test ENCODING 'UTF8';
SQL
```

Migrate and seed the empty database:

```bash
cd /srv/ajda/test
npm --prefix server run db:gen:prod
npm --prefix server run db:migrate
SEED_ADMIN_PASSWORD='AjdaTest!2026' npm --prefix server run db:seed
```

`SEED_ADMIN_PASSWORD` is the shared password of every seeded admin account:
at least 10 characters with at least one letter and one digit — the same rule
the admin UI applies when an admin changes their own password. The seed reads
it from the process environment (it does not load `.env` itself), so pass it
inline as above or export it first:

```bash
set -a; . server/.env; set +a
npm --prefix server run db:seed
```

> **Order matters: seed first, then the sanitize script — never the reverse.**
> The seed rewrites the admin e-mails and passwords to their real values, so a
> sanitize run that happened *before* the seed would be undone by it.

### 3.4 Fill the test database with production data (owner, by hand)

> ⚠️ **Never run these commands against `ajda`.** The only database this
> section writes to is `ajda_test`, and every command that writes names it
> explicitly. The `pg_dump` of `ajda` **only reads** production — it copies
> data out, it never changes it.

**Step 1 — the role and the database** (skip if §3.3 already created them):

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE ajda_test LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
CREATE DATABASE ajda_test OWNER ajda_test ENCODING 'UTF8';
SQL
```

**Step 2 — a dump of production (read-only):**

```bash
sudo -u postgres pg_dump -Fc -d ajda --file=/tmp/ajda-prod.dump
```

This command only *reads* the production database. Nothing in production is
modified by it.

**Step 3 — restore the dump into `ajda_test`:**

```bash
sudo -u postgres pg_restore --no-owner --no-privileges --role=ajda_test -d ajda_test /tmp/ajda-prod.dump
sudo rm -f /tmp/ajda-prod.dump
```

**Step 4 — sanitize `ajda_test`** (the script only ever touches `ajda_test`):

```bash
sudo -u postgres psql -d ajda_test -f /srv/ajda/test/deploy/sanitize-test-db.sql
```

**Step 5 — copy the uploads once** (see §3.5):

```bash
sudo cp -a /srv/ajda/app/server/uploads/. /srv/ajda/test/server/uploads/
```

The dump restores the real admin e-mails and the real lead data, so **always**
run step 4 after step 3. The script is idempotent, so it can be re-run after
any reseed.

> **If you use the seed instead of the dump, run the seed first and the
> sanitize script second — never the reverse.** The seed rewrites the admin
> e-mails and password hashes to their real values, so sanitizing first and
> seeding afterwards would put them back.

`deploy/sanitize-test-db.sql`:

* rewrites every `AdminUser` to `test-admin-<uuid>@example.test` with the
  bcrypt hash of the test password `AjdaTest!2026` and no phone number;
* deletes every `OtpChallenge` (login codes and reset tokens);
* anonymizes `CustomerInquiry` (name, e-mail, phone, message, notes);
* anonymizes `NewsletterSubscriber`;
* deletes the stored SMTP credentials (`AppSetting` key `mail`) and the
  notification configuration (key `notifications`);
* disables every `NotificationListener` and empties its config;
* strips the admin name/e-mail/metadata from the `developer_notes` rows;
* deletes every row of the foundation table `job_applications` (name, e-mail,
  phone, CV, cover letter — personal data that must not exist in the test
  instance). The statement is guarded, so the script also runs on a database
  that does not have that table yet.

### 3.4.1 Logging in to the test instance

After the script, the admin e-mails are no longer the production ones: each
`AdminUser` row keeps its own uuid and gets the address
`test-admin-<uuid>@example.test` (the `uuid` is the row id, so every account
has a different address). List them with:

```bash
sudo -u postgres psql -d ajda_test -c "SELECT email, role FROM \"AdminUser\";"
```

The password is the documented test password **`AjdaTest!2026`** — the same
value the sanitize script stores (as a bcrypt hash) and the same value
`SEED_ADMIN_PASSWORD='AjdaTest!2026'` gives to the seeded accounts. There is
no other account: the real `@ajdaa.sa` addresses no longer exist.

Verify afterwards:

```bash
sudo -u postgres psql -d ajda_test -c "SELECT count(*) FROM \"AdminUser\" WHERE \"email\" LIKE '%@ajdaa.sa';"
sudo -u postgres psql -d ajda_test -c "SELECT count(*) FROM \"CustomerInquiry\" WHERE \"email\" LIKE '%@ajdaa.sa';"
```

Both must be `0`.

### 3.4.2 Create a developer user

The `user:create-dev` script provisions a real `AdminUser` with the `super_admin`
role and every permission. It is a provisioning tool, not a login bypass: the
account signs in through the normal login flow (password, and the email code if
enabled). It prompts for the password on the TTY and never accepts it as a
command-line argument or environment variable.

Run from the instance directory. The script reads `DATABASE_URL` from
`server/.env` (Prisma loads it automatically) and prints only the database name
— never the full URL, host, user or password — before asking for confirmation.

**Test instance** (the database name ends with `_test`, so `--yes` is allowed):

```bash
cd /srv/ajda/test
npm run user:create-dev -- --email dev@example.com --name "Dev Name"
```

With a generated password (printed once, never logged or written to a file):

```bash
cd /srv/ajda/test
npm run user:create-dev -- --email dev@example.com --name "Dev Name" --generate
```

To reset the password of an existing account (a login lockout lives in the API's memory; restart `ajda-api` to clear it, or wait for it to expire):

```bash
cd /srv/ajda/test
npm run user:create-dev -- --email dev@example.com --reset-password
```

**Production** (database name does not end with `_test`): `--yes` is not
allowed. The owner runs this by hand, never from CI, and must type the database
name to confirm:

```bash
cd /srv/ajda/app
npm run user:create-dev -- --email dev@example.com --name "Dev Name"
```

### 3.5 Uploads (one-time copy, never a symlink)

The test instance gets its **own copy** of the media. It never shares a path
with production and never symlinks into it.

```bash
# The nightly backup mirrors production uploads into /var/backups/ajda/uploads.
# Copy the production uploads into the test instance (one time).
mkdir -p /srv/ajda/test/server/uploads
sudo cp -a /srv/ajda/app/server/uploads/. /srv/ajda/test/server/uploads/

# Equivalent, straight from the backup mirror:
# sudo cp -a /var/backups/ajda/uploads/. /srv/ajda/test/server/uploads/
```

It is always a real copy — never `ln -s`, never a shared path with
production.

> The copy also brings the uploaded CVs of the job applications, if any: the
> sanitize script deletes the `job_applications` **rows**, not the files. Check
> the copied upload directory for CV files and delete them by hand.

### 3.6 systemd

```bash
sudo cp deploy/ajda-api-test.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ajda-api-test
curl -fsS http://127.0.0.1:4001/api/health
journalctl -u ajda-api-test -f
```

The test unit is the production unit with test paths and `PORT=4001`. Its
`ReadWritePaths` point at `/srv/ajda/test/server/...`; `ProtectHome=read-only`
still allows reading the node binary under `/home/salah/.nvm`.

## 4. Deploy automation

### 4.1 The SSH key

Create a dedicated key (never reuse a personal key):

```bash
ssh-keygen -t ed25519 -C "ajda-deploy" -f ~/.ssh/ajda_deploy -N ''
```

* the **private** key (`~/.ssh/ajda_deploy`) becomes the GitHub secret
  `SSH_KEY`;
* the **public** key (`~/.ssh/ajda_deploy.pub`) goes into
  `/home/salah/.ssh/authorized_keys`.

### 4.2 authorized_keys (forced command)

```bash
sudo install -d -o salah -g salah -m 700 /home/salah/.ssh
sudo install -d -o salah -g salah -m 755 /srv/ajda/deploy
sudo install -o salah -g salah -m 755 deploy/ssh-entry.sh /srv/ajda/deploy/ssh-entry.sh

cat >> /home/salah/.ssh/authorized_keys <<'EOF'
command="/srv/ajda/deploy/ssh-entry.sh",restrict ssh-ed25519 AAAA... ajda-deploy
EOF

chmod 600 /home/salah/.ssh/authorized_keys
```

`restrict` disables pty, port forwarding, agent forwarding and X11 for that
key; the forced command is the only thing it can run.

`deploy/ssh-entry.sh` accepts exactly one command line —
`^test [0-9a-f]{40}$` — and execs
`/srv/ajda/test/deploy/remote-deploy.sh`, the copy in the **test** checkout.
There is no production path: the key can only ever deploy the test instance.

Git does not preserve the executable bit, so make the scripts runnable once
after every checkout that changed them:

```bash
chmod 755 /srv/ajda/test/deploy/remote-deploy.sh /srv/ajda/deploy/ssh-entry.sh
```

The `salah` account also needs read access to the origin repository (an SSH
deploy key or a token in the git configuration), because every deploy runs
`git fetch --prune origin`.

> The forced command always points at the installed wrapper
> (`/srv/ajda/deploy/ssh-entry.sh`). The deploy script it runs comes from the
> test checkout, so it is always the version of the commit being deployed.

### 4.3 sudoers (one rule, the test unit)

```bash
sudo tee /etc/sudoers.d/ajda-deploy >/dev/null <<'EOF'
salah ALL=(root) NOPASSWD: /usr/bin/systemctl restart ajda-api-test
EOF
sudo chmod 440 /etc/sudoers.d/ajda-deploy
sudo visudo -c
```

That is the only privileged operation the deploy needs, and it only restarts
the **test** unit: CI can never restart the production API. Adjust the path if
`systemctl` is not at `/usr/bin/systemctl` (`command -v systemctl`).

### 4.4 Running a test deploy by hand

```bash
/srv/ajda/test/deploy/remote-deploy.sh test <40-hex-commit-sha>
```

The script:

1. validates the target (`test` — anything else, `prod` included, is
   rejected) and the ref (a 40-hex SHA, or a branch name matching
   `^[A-Za-z0-9._/-]+$`);
2. **checks the database**: it reads the database name out of `DATABASE_URL`
   in `/srv/ajda/test/server/.env` and aborts unless the name ends with
   `_test`. The URL, the user and the password are never printed;
3. takes an `flock` on `/srv/ajda/test/.deploy/deploy.lock`;
4. records the current commit in `/srv/ajda/test/.deploy/previous`;
5. `git fetch --prune origin` + `git checkout --detach <sha>`;
6. `npm ci`, `npm --prefix server ci`, `db:gen:prod`, `db:migrate`, server
   build;
7. builds the SPA into `dist.new` and swaps it in
   (`dist` → `dist.old`, `dist.new` → `dist`);
8. `sudo systemctl restart ajda-api-test` and polls the health endpoint for
   30 s;
9. on failure: checks the previous commit out again, rebuilds the API and the
   SPA, restarts the unit and exits 1.

It never runs `git clean`, never deletes anything under `server/uploads` and
never reads, writes or removes a `.env` file itself — the single documented
exception is step 2, which reads **only** the database name from
`DATABASE_URL` to prove that the deploy cannot touch a non-test database.

**Production is not deployed by this script.** See the runbook in §6.1.

## 5. GitHub Actions

`.github/workflows/deploy.yml` replaces the old GitHub Pages workflow. It
deploys the **test instance only** — there is no production target.

* **Trigger** — a push to `deploy-test` deploys the test instance; the
  `workflow_dispatch` trigger takes an optional `ref` (branch or commit; empty
  = the triggering ref). There is no `target` input.
* **Gate** — the `verify` job runs `npm ci`, `npm run lint`, `npm run build`,
  `npm --prefix server ci`, `npm --prefix server run build` and
  `npm --prefix server test` on Node 24. The `deploy` job has
  `needs: verify`. The gate checks out the ref that is deployed
  (`ref: ${{ inputs.ref || github.sha }}`), so the tested commit and the
  deployed commit are the same one.
* **Environment** — the single GitHub environment `test`.
* **Concurrency** — one test deploy at a time
  (`group: deploy-test`, `cancel-in-progress: false`).
* **Transport** — SSH with `StrictHostKeyChecking=yes` and the host key from
  the `SSH_KNOWN_HOSTS` secret. The forced command always receives
  `test <sha>`.

Repository setup:

1. Create the branch `deploy-test` and push to it.
2. Settings → Environments: create `test`.
3. Settings → Secrets (repository or environment scoped): `SSH_HOST`,
   `SSH_USER` (`salah`), `SSH_KEY` (the private key from §4.1),
   `SSH_KNOWN_HOSTS` (the host key line, e.g. from
   `ssh-keyscan -H <host> >> known_hosts`).

## 6. Backups and restore

The nightly timer runs `ajda-backup.service` at 03:17:

```bash
sudo systemctl start ajda-backup.service      # run it now, don't wait
sudo -u salah ls -l /var/backups/ajda
```

Each run writes `ajda-<UTC timestamp>.dump` (custom format, compressed, mode
600), verifies it with `pg_restore --list`, refreshes `ajda-latest.dump`,
prunes archives older than `BACKUP_RETENTION_DAYS`, and mirrors
`server/uploads` into `/var/backups/ajda/uploads/` with `rsync -a` (no
`--delete`, so a file deleted from the app stays recoverable in the backup).

Restore:

```bash
# custom-format dump
sudo -u postgres createdb ajda_restore_test
sudo -u postgres pg_restore -d ajda_restore_test /var/backups/ajda/ajda-latest.dump

# plain SQL dump
sudo -u postgres psql -d ajda_restore_test -f /path/to/ajda-<stamp>.sql

# uploaded media
sudo -u salah rsync -a /var/backups/ajda/uploads/ /srv/ajda/app/server/uploads/

sudo -u postgres dropdb ajda_restore_test
```

**Migrations are not auto-reversible.** A rollback restores the *code* only;
the database stays at the migrated schema. Restoring the data means restoring
the dump above.

### 6.1 Production deploy runbook (manual, owner only)

> There is **no script** for production. These are the commands the owner runs
> by hand, in this order, after the users have tested the test instance and
> the owner has approved the release. CI never runs any of them.

**Step 1 — a verified backup of production** (read + write to the backup
directory only):

```bash
cd /srv/ajda/app
sudo -u postgres pg_dump -Fc -d ajda --file=/var/backups/ajda/ajda-manual-$(date -u +%Y%m%dT%H%M%SZ).dump
# the dump must be readable and not empty
sudo -u postgres pg_restore --list /var/backups/ajda/ajda-manual-*.dump | head
ls -l /var/backups/ajda/ajda-manual-*.dump      # must be far bigger than 1 KB
# the uploads, mirrored without --delete
sudo -u salah rsync -a /srv/ajda/app/server/uploads/ /var/backups/ajda/uploads/
```

**Step 2 — check out the approved commit:**

```bash
cd /srv/ajda/app
git fetch --prune origin
git checkout --detach <approved-40-hex-sha>
```

**Step 3 — install and generate the Prisma schema** (no database access:
`db:gen:prod` only writes the gitignored
`server/prisma/schema.postgresql.prisma`):

```bash
npm ci
npm --prefix server ci
npm --prefix server run db:gen:prod
```

**Step 4 — read every pending migration before it runs:**

```bash
# prisma is a dependency of server/, so run it from there (no network fetch)
(cd server && npx prisma migrate status --schema prisma/schema.postgresql.prisma)
```

For every migration folder that `migrate status` reports as pending, read the
`migration.sql` file. **Do not continue if a pending migration contains
`DROP`, `TRUNCATE`, `DELETE` or `ALTER ... DROP`.** `ON DELETE …` inside a
foreign-key clause is expected and does not count. A one-line helper for the
pending folders only:

```bash
grep -nEi '\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b' server/prisma/migrations/<pending-folder>/migration.sql
```

**Step 5 — only then migrate, build, swap the SPA and restart:**

```bash
npm --prefix server run db:migrate
npm --prefix server run build
./node_modules/.bin/tsc -b
./node_modules/.bin/vite build --outDir dist.new --emptyOutDir
mv dist dist.old && mv dist.new dist && rm -rf dist.old
sudo systemctl restart ajda-api
curl -fsS http://127.0.0.1:4000/api/health
```

**Step 6 — rollback:** check the previous commit out again, rebuild and
restart. If the data has to be restored as well, use the dump of step 1:

```bash
sudo -u postgres pg_restore -d ajda --clean --if-exists /var/backups/ajda/ajda-manual-<stamp>.dump
```

Migrations are **not** auto-reversible: a `pg_restore` only gives the data
back, the schema has to be fixed by hand.

## 7. Caddy

The Ajda sites live in two files, one per instance:

| File in the repo | Installed as | Site | Imported by the main Caddyfile with |
|---|---|---|---|
| `deploy/Caddyfile.ajda` | `/etc/caddy/Caddyfile.ajda` | `ajdaa.sa` (production) | `import /etc/caddy/Caddyfile.ajda` |
| `deploy/Caddyfile.test.ajda` | `/etc/caddy/Caddyfile.test.ajda` | `ajda.weghetk.com` (test) | `import /etc/caddy/Caddyfile.test.ajda` |

The server's main `/etc/caddy/Caddyfile` (global options and the unrelated
`weghetk.com` sites) is owned by hand and is never overwritten from this repo; it
only carries those two `import` lines at its end. `reload.sh` checks the file of
the instance it lives in (production copy -> `Caddyfile.ajda`, test copy ->
`Caddyfile.test.ajda`).

One-time setup (a human, with a backup):

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
sudo cp deploy/Caddyfile.ajda deploy/Caddyfile.test.ajda /etc/caddy/
sudo nano /etc/caddy/Caddyfile
#   1. make sure no `ajdaa.sa { ... }` or `ajda.weghetk.com { ... }` block remains
#      (a site address may exist only once, otherwise caddy refuses to load)
#   2. the last lines must be:
#        import /etc/caddy/Caddyfile.ajda
#        import /etc/caddy/Caddyfile.test.ajda
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Every later change (use the file of the instance you are changing):

```bash
diff -u /etc/caddy/Caddyfile.test.ajda deploy/Caddyfile.test.ajda    # read it first
sudo cp deploy/Caddyfile.test.ajda /etc/caddy/Caddyfile.test.ajda
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

The Ajda files must contain site blocks only: global options (`servers`,
`auto_https`, `email`) belong to the main Caddyfile, and a second global block is
an error.

`/api/*`, `/uploads/*` and `/socket.io/*` are proxied to the API port of the
instance; everything else falls back to `index.html` for client-side routing.

The test block (`ajda.weghetk.com`, in `Caddyfile.test.ajda`) proxies to `127.0.0.1:4001`, serves
the SPA from `/srv/ajda/test/dist`, sends
`X-Robots-Tag "noindex, nofollow"` and carries no `basicauth` (public, noindex). Add one with `caddy hash-password` if that ever changes.

`ajda.weghetk.com` used to be a second hostname of production. It now points
at the test instance and keeps using the Cloudflare origin certificate
(`/etc/caddy/ajda-origin.pem` / `.key`), so no new DNS record or certificate is
needed. Production is served only on `ajdaa.sa`: remove `ajda.weghetk.com`
from production's `CLIENT_ORIGIN` / `APP_URL` and from any Google Maps key
referrer list that should no longer allow it.

The test checkout lives under `/srv`, next to the production one, so Caddy
needs no traverse rights on `/home/salah` any more. Make sure the directory
exists and is readable by Caddy:

```bash
sudo mkdir -p /srv/ajda/test
sudo chown salah:salah /srv/ajda/test
namei -l /srv/ajda/test/dist
```

> The production block in `deploy/Caddyfile.ajda` serves `/srv/ajda/app/dist`, the
> verified production layout, with security headers and log rotation.

## 8. Post-deploy smoke test

```bash
curl -fsS http://127.0.0.1:4000/api/health
curl -fsS https://ajdaa.sa/api/health
curl -fsSI https://ajdaa.sa/                    # 200, index.html not cached
curl -fsS  https://ajdaa.sa/api/projects | head -c 200
# test instance
curl -fsS https://ajda.weghetk.com/api/health
```

## 9. Known limitations

* The queue name (`ajda-jobs`) and the BullMQ key prefix are hardcoded in the
  app; per-instance isolation comes from the Redis **database index**
  (production DB 0, test DB 1).
* `HOST` is honoured by the current server build; both instances bind the
  loopback interface (`127.0.0.1`) and are reachable only through Caddy.
  `HOST=0.0.0.0` would expose the API to the whole VPS network — do not set
  it (see §2.1, §3.2).
* The test instance shares the same Redis server, not the same database.
* `deploy/sanitize-test-db.sql` covers the tables in
  `server/prisma/schema.prisma` at the time of writing; re-check it after a
  schema change that adds a table with personal data. The foundation tables
  are handled defensively (the statement is skipped when the table does not
  exist yet).
* The test deploy script reads the database name out of
  `/srv/ajda/test/server/.env` (the only `.env` read it ever does) to refuse
  a non-`_test` database. It does not check the *host* of the URL, so a
  `DATABASE_URL` that points at a remote host is not detected — the name
  check is the guard.
* Production is deployed by hand (§6.1). Nothing automates it, and nothing
  in CI can restart the production unit.

## 10. CV storage (careers)

CVs submitted through the public careers form are stored under
`server/private` (env `PRIVATE_DIR`, default `./private`), **not** under the
publicly served `server/uploads`. They are backed up by `server/scripts/backup_db.sh`
into `${BACKUP_DIR}/private/`. They are **not** copied to the test instance, and
the sanitize script deletes the `job_applications` rows.

One-time step on both instances:

```bash
mkdir -p server/private && chmod 700 server/private
touch server/prod.log server/errors.log   # the unit refuses to start (226/NAMESPACE) without these
```
