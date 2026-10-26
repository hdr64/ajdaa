// Manual production deploy, run from the owner's PC: `npm run deploy:prod`.
// Checks out the current commit on the server and runs /srv/ajda/app/reload.sh
// (backup, migration check, build, restart, health check). CI never runs this.
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const SSH_TARGET = process.env.AJDA_PROD_SSH || 'salah@169.58.107.163'
const APP_DIR = '/srv/ajda/app'

const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`)
  return r.stdout.trim()
}

try {
  if (git('status', '--porcelain')) throw new Error('Working tree is not clean. Commit or stash first.')

  git('fetch', '--prune', 'origin')
  const sha = git('rev-parse', 'HEAD')
  if (!git('branch', '-r', '--contains', sha)) {
    throw new Error(`Commit ${sha.slice(0, 8)} is not pushed to origin. Push it first.`)
  }

  console.log(`\nProduction deploy to ${SSH_TARGET}:${APP_DIR}`)
  console.log(`Commit: ${git('log', '-1', '--format=%h %s', sha)}\n`)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question("Type 'production' to continue: ")
  rl.close()
  if (answer.trim() !== 'production') throw new Error('Aborted.')

  // -t: reload.sh asks for confirmation and sudo may need a tty.
  const remote = `cd ${APP_DIR} && git fetch --prune origin && git checkout --detach ${sha} && ./reload.sh`
  const r = spawnSync('ssh', ['-t', SSH_TARGET, remote], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
