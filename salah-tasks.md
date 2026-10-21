# Salah's tasks (owner actions, 2026-10-21)

## A. Run the three Wave 1 lanes in OpenCode (free model, one terminal per worktree)
- [ ] `D:\projects\html\ajda-wt\foundation` -> "Read task-w1-foundation-prompt.md ... write the report"
- [ ] `D:\projects\html\ajda-wt\sec0` -> "Read task-w1-sec0-prompt.md ..."
- [ ] `D:\projects\html\ajda-wt\deploy` -> "Read task-deploy-prompt.md ..."
- [ ] Send Claude the report file names: `task-w1-foundation-report.md`, `task-w1-sec0-report.md`, `task-deploy-report.md` (each inside its worktree folder)

## B. On the production server (independent of the lanes)
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

## C. For the test instance (test-ajda.weghetk.com)
- [ ] Create the DNS record for `test-ajda.weghetk.com`
- [ ] `openssl x509 -in /etc/caddy/weghetk.com.pem -noout -ext subjectAltName` — is it a wildcard? (paste output)
- [ ] After the deploy task merges: follow `deploy/README-deploy.md` (deploy SSH key, sudoers line, DB `ajda_test`, sanitized data, Caddy block, GitHub environments/secrets)

## D. Decisions still open
- [ ] Monitoring: set `MONITOR_ALLOWED_IPS` to your own IP (recommended) and `MONITOR_EXTERNAL_UNTIL` = go-live + 30 days
- [ ] Confirm the production backup copy on D:\backups\ajda-2026-10-21 matches the checksums
