#!/usr/bin/env bash
#
# Forced command for the GitHub Actions deploy key.
#
# The public key is added to /home/salah/.ssh/authorized_keys with a forced
# command, so this script is the only thing the deploy user can run. It accepts
# exactly one argument pair - "test <40-hex-commit-sha>" - and hands it to
# remote-deploy.sh. Everything else is rejected.
#
# The target is always "test": the CI deploys the TEST instance only.
# Production is deployed by hand, with the runbook in
# deploy/README-deploy.md, and never by this key.
#
# Install: /srv/ajda/deploy/ssh-entry.sh (mode 755, owned by salah)
#
# The deploy script itself is taken from the TEST checkout
# (/srv/ajda/test/deploy/remote-deploy.sh), so the test instance always runs
# the deploy logic of the commit that is being deployed.
#
set -Eeuo pipefail

readonly DEPLOY_SCRIPT="${AJDA_DEPLOY_SCRIPT:-/srv/ajda/test/deploy/remote-deploy.sh}"

log() {
  printf '%s level=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${*:2}"
}

# sshd passes the original command line in SSH_ORIGINAL_COMMAND.
original_command="${SSH_ORIGINAL_COMMAND:-}"

if [[ ! "$original_command" =~ ^test[[:space:]]+[0-9a-f]{40}$ ]]; then
  log error "event=ssh.denied reason=unexpected-command"
  exit 1
fi

read -r target ref <<<"$original_command"

if [[ ! -x "$DEPLOY_SCRIPT" ]]; then
  log error "event=ssh.denied reason=deploy-script-missing path=${DEPLOY_SCRIPT}"
  exit 1
fi

log info "event=ssh.accept target=${target} ref=${ref}"
exec "$DEPLOY_SCRIPT" "$target" "$ref"
