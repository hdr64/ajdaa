// Test deploy, run from the owner's PC: `npm run deploy:test`.
// Pushes HEAD plus an empty "chore: redeploy" commit to the deploy-test branch (dirty files stay out); GitHub Actions
// (.github/workflows/deploy.yml) lints, builds, tests and deploys it.
// Then follows the run with the GitHub CLI and exits 0 on success, 1 on failure.
import { spawnSync } from 'node:child_process'

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const dirty = run('git', ['status', '--porcelain']).stdout.trim()
if (dirty) {
  console.log('Note: uncommitted changes are NOT deployed. Only the last commit (HEAD) is.\n')
}

// An empty "chore: redeploy" commit on top of HEAD is what gets pushed, so every run starts a new
// workflow run even when HEAD is already on deploy-test. It is created with commit-tree: the
// index, the working tree and the current branch stay untouched (staged or dirty files are
// never included).
const head = run('git', ['rev-parse', 'HEAD']).stdout.trim()
const commit = run('git', ['commit-tree', `${head}^{tree}`, '-p', head, '-m', 'chore: redeploy'])
const sha = commit.stdout.trim()
if (commit.status !== 0 || !/^[0-9a-f]{40}$/.test(sha)) {
  console.error(`Could not create the redeploy commit: ${commit.stderr.trim()}`)
  process.exit(1)
}
const push = run('git', ['push', '--force-with-lease', 'origin', `${sha}:refs/heads/deploy-test`], { stdio: 'inherit' })
if (push.status !== 0) process.exit(push.status ?? 1)

if (run('gh', ['--version']).status !== 0) {
  console.log('\nPushed. Install the GitHub CLI (gh) to follow the run here; otherwise open the Actions tab.')
  process.exit(0)
}

// The run appears a few seconds after the push. Pushing a commit that deploy-test already
// points at starts no run, so give up after about a minute.
console.log(`\nPushed ${sha.slice(0, 8)}. Waiting for the GitHub Actions run...`)
let runId = ''
for (let i = 0; i < 20 && !runId; i++) {
  await sleep(3000)
  const list = run('gh', ['run', 'list', '--workflow', 'deploy.yml', '--branch', 'deploy-test', '--commit', sha, '--limit', '1', '--json', 'databaseId'])
  try {
    runId = String(JSON.parse(list.stdout || '[]')[0]?.databaseId ?? '')
  } catch {
    runId = ''
  }
}
if (!runId) {
  console.error('No run found for this commit (it may already have been deployed). Check: gh run list --workflow deploy.yml')
  process.exit(1)
}

const watch = run('gh', ['run', 'watch', runId, '--exit-status'], { stdio: 'inherit' })
const final = run('gh', ['run', 'view', runId, '--json', 'conclusion,url'])
let info = {}
try {
  info = JSON.parse(final.stdout || '{}')
} catch {
  info = {}
}
if (watch.status === 0) {
  console.log(`\nDEPLOY SUCCEEDED (${info.url ?? runId})`)
  process.exit(0)
}
console.error(`\nDEPLOY FAILED: ${info.conclusion ?? 'unknown'} (${info.url ?? runId})`)
console.error(`Failed steps: gh run view ${runId} --log-failed`)
process.exit(1)
