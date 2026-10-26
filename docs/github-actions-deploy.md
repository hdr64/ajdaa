# GitHub Actions: deploy the test instance

The workflow `.github/workflows/deploy.yml` deploys the **test instance only**
(`/srv/ajda/test`, unit `ajda-api-test`, port 4001, database `ajda_test`).
Production is never deployed by CI: it is deployed by hand with `reload.sh` (see
`deploy/README-deploy.md` §6.1). Background and reference: `deploy/README-deploy.md`
§4 and §5.

How it is locked to test, in three layers:

1. The workflow has one environment (`test`) and always sends `test <sha>`; there is no target input.
2. The server's forced SSH command (`deploy/ssh-entry.sh`) accepts only `test <40-hex sha>`.
3. `deploy/remote-deploy.sh` rejects every target except `test` and aborts unless the database name ends in `_test`.

## 1. Server side (once, as `salah`)

### 1.1 A dedicated deploy key

On your PC or on the server. Never reuse a personal key.

```bash
ssh-keygen -t ed25519 -C "ajda-deploy" -f ~/.ssh/ajda_deploy -N ''
```

The private key (`~/.ssh/ajda_deploy`) becomes the GitHub secret `SSH_KEY`. The
public key (`~/.ssh/ajda_deploy.pub`) goes into the server's `authorized_keys`.

### 1.2 Forced-command wrapper and authorised key

```bash
sudo install -d -o salah -g salah -m 755 /srv/ajda/deploy
sudo install -o salah -g salah -m 755 /srv/ajda/test/deploy/ssh-entry.sh /srv/ajda/deploy/ssh-entry.sh
chmod 755 /srv/ajda/test/deploy/remote-deploy.sh

# paste the PUBLIC key after "ssh-ed25519":
echo 'command="/srv/ajda/deploy/ssh-entry.sh",restrict ssh-ed25519 AAAA...your-public-key... ajda-deploy' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

`restrict` disables pty, port, agent and X11 forwarding. The key can run the
forced command and nothing else.

### 1.3 Allow restarting the test unit without a password

```bash
echo 'salah ALL=(root) NOPASSWD: /usr/bin/systemctl restart ajda-api-test' | sudo tee /etc/sudoers.d/ajda-deploy
sudo chmod 440 /etc/sudoers.d/ajda-deploy
sudo visudo -c
command -v systemctl      # must print /usr/bin/systemctl, otherwise fix the path in the rule
```

This is the only privileged operation the deploy needs, and it only restarts the
test unit. CI can never restart production.

### 1.4 The server can fetch the repository

Every deploy runs `git fetch --prune origin` in `/srv/ajda/test`. Check it works as `salah`:

```bash
cd /srv/ajda/test && git fetch --prune origin
```

If it fails, add a read-only deploy key to the repository (Settings, Deploy keys)
or configure a token for `origin`.

### 1.5 The test instance itself is healthy

```bash
sudo systemctl status ajda-api-test --no-pager | head -6
curl -fsS http://127.0.0.1:4001/api/health ; echo
```

Prerequisites if it is not: a complete `/srv/ajda/test/server/.env` (including
`JWT_SECRET`, `LOGS_SECRET_KEY`, `DEVELOPER_NOTES_SECRET`), the files
`server/prod.log` and `server/errors.log`, and the folders `server/uploads` and
`server/private`. Without the two log files systemd stops the unit with
`226/NAMESPACE`.

### 1.6 Host key for GitHub

From your PC:

```bash
ssh-keyscan -H <server-host-or-ip> > known_hosts.txt
```

## 2. GitHub side

Settings, Environments: create an environment named **`test`**. Add these four
secrets to the repository or to that environment:

| Secret | Value |
|---|---|
| `SSH_HOST` | the server host or IP |
| `SSH_USER` | `salah` |
| `SSH_KEY` | the private key `~/.ssh/ajda_deploy` |
| `SSH_KNOWN_HOSTS` | the content of `known_hosts.txt` |

With the GitHub CLI the private key never has to be pasted anywhere:

```bash
gh secret set SSH_KEY --env test < ~/.ssh/ajda_deploy
gh secret set SSH_HOST --env test --body "<host>"
gh secret set SSH_USER --env test --body "salah"
gh secret set SSH_KNOWN_HOSTS --env test < known_hosts.txt
```

## 3. Run a deploy

The workflow file must be committed and pushed first.

```bash
git push origin HEAD:refs/heads/deploy-test
```

Every later push to the `deploy-test` branch deploys the test instance. `npm run deploy:test` does this for you: it pushes an empty `chore: redeploy` commit on top of `HEAD` (made with `git commit-tree`, so dirty or staged files and your branch stay untouched, and only committed code is deployed) to `deploy-test` with `--force-with-lease`, then follows the run with `gh` and prints DEPLOY SUCCEEDED or DEPLOY FAILED (exit code 0 or 1). To run it
by hand: GitHub, Actions, Deploy, Run workflow (optional input `ref`: a branch or a
commit; empty means the triggering ref).

What happens:

1. Job `verify`: `npm ci`, lint, frontend build, server install, server build, server tests on Node 24, all on the exact commit that will be deployed.
2. Job `deploy` (only after `verify` passes): SSH to the server with the command `test <sha>`.
3. On the server `remote-deploy.sh` checks the database name, takes a lock, fetches and checks out the commit, installs, generates the Prisma schema, migrates, builds the API and the SPA (`VITE_APP_ENV=test`, which shows the TEST badge), swaps `dist`, restarts the unit and polls `/api/health` for 30 seconds.
4. If the health check fails it checks out the previous commit again, rebuilds and restarts.

One deploy runs at a time (`concurrency: deploy-test`).

## 4. After a deploy

```bash
git -C /srv/ajda/test log -1 --oneline
curl -fsS https://ajda.weghetk.com/api/health ; echo
```

## 5. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `verify` fails on a test | Re-run once; the known flaky mail-settings "tampered box" test can fail alone. A real failure blocks the deploy by design. |
| SSH step: `Host key verification failed` | `SSH_KNOWN_HOSTS` is wrong or empty. Regenerate it with `ssh-keyscan -H`. |
| SSH step: `Permission denied (publickey)` | The public key is not in `authorized_keys`, or the line is malformed. Keep the `command="...",restrict` prefix on one line. |
| Server: `rejected` or `usage` message | The command is not `test <40-hex sha>`. The wrapper accepts only that. |
| `git fetch` fails on the server | Section 1.4. |
| `sudo: a password is required` | Section 1.3, check the rule and the `systemctl` path. |
| Deploy aborts with a database-name message | `DATABASE_URL` in `/srv/ajda/test/server/.env` does not point at a `*_test` database. This is the safety guard working. |
| Health check fails, deploy rolls back | `journalctl -u ajda-api-test -n 100 --no-pager`. Most often a missing variable in `server/.env`, or the two log files missing. |
| Production? | Not possible from CI. Use `./reload.sh` in `/srv/ajda/app`, by hand. |
