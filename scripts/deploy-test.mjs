// Test deploy, run from the owner's PC: `npm run deploy:test`.
// Pushes the current commit to the deploy-test branch; GitHub Actions
// (.github/workflows/deploy.yml) lints, builds, tests and deploys it.
import { spawnSync } from 'node:child_process'

const run = (args, opts = {}) => spawnSync('git', args, { encoding: 'utf8', ...opts })

const dirty = run(['status', '--porcelain']).stdout.trim()
if (dirty) {
  console.error('Working tree is not clean. Only committed code is deployed; commit or stash first.')
  process.exit(1)
}

const r = run(['push', '--force-with-lease', 'origin', 'HEAD:refs/heads/deploy-test'], { stdio: 'inherit' })
if (r.status === 0) console.log('\nPushed. Follow the run with: gh run watch')
process.exit(r.status ?? 1)
