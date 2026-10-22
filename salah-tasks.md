# Salah's tasks (owner actions, updated 2026-10-22)

## A. Wave 1 and Wave 2 in OpenCode: done
- [x] Wave 1 lanes (foundation, sec0, deploy) ran, reviewed and merged into `integration/wave1`
- [x] Wave 2 lanes (projects, users wizard, past projects, careers) ran, reviewed, fixed, committed and merged into `integration/wave1` (all gates green: lint, builds, 273 server tests)

## B. Decisions for you now
- [ ] Approve merging `integration/wave1` into `feat/backend-admin` (Claude will do it when you say so)
- [ ] Decide when to run the next OpenCode prompt: `task-w2-monitoring-prompt.md` (monitoring; needs `MONITOR_ALLOWED_IPS` and `MONITOR_EXTERNAL_UNTIL` below)
- [ ] Monitoring: set `MONITOR_ALLOWED_IPS` to your own IP (recommended) and `MONITOR_EXTERNAL_UNTIL` = go-live + 30 days
- [ ] Open the merged app once and look at: `/careers`, `/past-works`, a project page (3D + PDF buttons), admin "Users" create wizard, admin "Applications", admin "Past projects" (Claude will also check these in the browser)

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

## D. For the test instance (test-ajda.weghetk.com)
- [ ] Create the DNS record for `test-ajda.weghetk.com`
- [ ] `openssl x509 -in /etc/caddy/weghetk.com.pem -noout -ext subjectAltName` — is it a wildcard? (paste output)
- [ ] Follow `deploy/README-deploy.md` (deploy SSH key, sudoers line, DB `ajda_test`, sanitized data, Caddy block, GitHub environments/secrets)
- [ ] **New (careers):** on the test server create the CV folder BEFORE the first restart: `mkdir -p /srv/ajda/test/server/private && chmod 700 /srv/ajda/test/server/private`
- [ ] Let users test `test-ajda` and tell Claude what you approve

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

## G. Auth work (new, 2026-10-22): run in OpenCode, one after the other
- [ ] `task-w3-login-eye-prompt.md` in `D:\projects\html\ajda` (small: eye button on login). Send me `task-w3-login-eye-report.md`
- [ ] `task-w3-auth-a-prompt.md` in `D:\projects\html\ajda-wt\auth` (email verification: invite user + create user, password-change email code, super admin exempt). Report: `task-w3-auth-a-report.md`
- [ ] After I review and commit A: `task-w3-auth-b-prompt.md` (authenticator-app 2FA + recovery codes). Report: `task-w3-auth-b-report.md`
- [ ] After I review and commit B: `task-w3-auth-c-prompt.md` (passkeys). Report: `task-w3-auth-c-report.md`
- [ ] Before the production deploy of these: decide the passkey domain (`WEBAUTHN_RP_ID`, default = the site host; passkeys stop working if the domain changes later) and run the three new migrations by hand

