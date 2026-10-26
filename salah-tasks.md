# Salah's tasks (owner actions, updated 2026-10-26)

## A. Done
- [x] Waves 1 and 2, the auth chain (email verification, email code, authenticator 2FA, passkeys), admin AR/EN translation, careers/past-works, hardening and production-readiness tasks: reviewed, committed and merged into `main`. Details: `docs/CHANGELOG.md`, `docs/TODO.md` section 5.

## B. Decisions for you now
- [ ] Open the app once with Claude's browser pass (TODO item 1) and tell Claude what you approve
- [ ] Decide the passkey domain `WEBAUTHN_RP_ID` (default = the host of `APP_URL`; passkeys stop working if the domain changes later)
- [ ] Monitoring (`docs/prompts/task-w2-monitoring-prompt.md`): set `MONITOR_ALLOWED_IPS` to your own IP (recommended) and `MONITOR_EXTERNAL_UNTIL` = go-live + 30 days, then say when to run it
- [ ] Delete merged branches and clean the repo root (see `docs/TODO.md` section 3)

## C. On the production server (independent of the code, still pending)
- [ ] Rotate the Gmail app password (myaccount.google.com/apppasswords) and update `MAIL_PASSWORD`
- [ ] Rotate `JWT_SECRET` (`openssl rand -base64 32`; everyone logs in again once)
- [ ] Rotate the DB password: `sudo -u postgres psql -c "ALTER ROLE ajda PASSWORD '<new>'"`, update `DATABASE_URL`, delete the stale "0000" comment
- [ ] `chmod 600 /srv/ajda/app/server/.env`
- [ ] Delete `/srv/ajda/app/.env.local.save`; remove the `MAIL_*` lines from `/srv/ajda/app/.env.local`
- [ ] `sudo systemctl restart ajda-api` and check status
- [ ] `sudo ufw status` — is port 4000 blocked from outside? (API listens on 0.0.0.0:4000 until sec0 is deployed)
- [ ] Change the `admin@ajdaa.sa` password if it is still `password` (the login page publishes it until sec0 is deployed)
- [ ] Check Google Maps key restriction (HTTP referrers: ajdaa.sa, ajda.weghetk.com)
- [ ] Never paste `.env` into chat; use `sed -E 's/=.*/=<hidden>/' server/.env`

## D. For the test instance (ajda.weghetk.com, repointed from production)
- [ ] Replace the `ajda.weghetk.com` block in `/etc/caddy/Caddyfile` with the test block from `deploy/Caddyfile` (basic auth hash first: `caddy hash-password`), then `sudo caddy validate --config /etc/caddy/Caddyfile` and `sudo systemctl reload caddy`
- [ ] Remove `ajda.weghetk.com` from production `CLIENT_ORIGIN`/`APP_URL` in `/srv/ajda/app/server/.env` (production is `ajdaa.sa` only) and check the Google Maps key referrers
- [ ] Follow `deploy/README-deploy.md` (deploy SSH key, sudoers line, DB `ajda_test`, sanitized data, Caddy block, GitHub environments/secrets)
- [ ] **New (careers):** on the test server create the CV folder BEFORE the first restart: `mkdir -p /srv/ajda/test/server/private && chmod 700 /srv/ajda/test/server/private`
- [ ] Let users test `ajda.weghetk.com` and tell Claude what you approve

## E. Before and after the first production deploy (by hand, you only)
- [ ] **New (careers):** create the CV folder on production before restarting: `mkdir -p /srv/ajda/app/server/private && chmod 700 /srv/ajda/app/server/private`
- [ ] Run the production DB migration by hand (new tables: past projects, job applications; new columns); take a fresh backup first
- [ ] After deploy, in admin: give the new permissions to the right users/roles: `managePastProjects`, `viewApplications`, `manageApplications`
- [ ] After deploy, in admin: add "أعمالنا السابقة" to the main menu (CMS nav panel). The saved production menu does not get it automatically
- [ ] After deploy, in admin: choose who gets the job-application email (Settings > notification listeners, event "طلب توظيف جديد", or the emails in Applications > Settings)
- [ ] Add the careers/past-works pages to the footer or menu text if you want different wording

## F. Other pending
- [ ] Confirm the production backup copy on D:\backups\ajda-2026-10-21 matches the checksums
- [ ] Backups now also copy `server/private` (CVs): check the backup folder permissions after the first run

## G. Before the production deploy of the auth work
- [ ] Decide `WEBAUTHN_RP_ID` (see B)
- [ ] Set `SETTINGS_ENCRYPTION_KEY`, `LOGS_SECRET_KEY`, `DEVELOPER_NOTES_SECRET` in production `.env` (the server refuses to boot without them), plus `TRUST_PROXY=1` and `HOST=127.0.0.1`
- [ ] After the backup, run all six pending migrations by hand: `20261022000000_foundation_past_projects_applications`, `20261022100000_email_verification`, `20261024000000_totp`, `20261025000000_defaults_and_indexes`, `20261025120000_passkeys`, `20261026000000_user_avatar`
- [ ] Production deploy is `npm run deploy:prod` (or `reload.sh` on the server), never CI
