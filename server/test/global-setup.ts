import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  requireTestEnvironment,
  tempRootFromDatabaseUrl,
  TEMP_DIR_PREFIX,
  type TestEnvironment,
} from './env.js';

const SERVER_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// Invoked through `process.execPath` with the CLI entry point rather than through
// `npx`/`.cmd` shims: shell resolution differs on Windows and this keeps the
// harness platform-agnostic.
const PRISMA_CLI = path.join(SERVER_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const TSX_CLI = path.join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

// Pinned so the suite never depends on a developer's ambient SEED_ADMIN_PASSWORD.
const SEED_PASSWORD = 'password';

let tempRoot = '';

function runNodeStep(label: string, cli: string, args: string[], env: Record<string, string>): void {
  execFileSync(process.execPath, [cli, ...args], {
    cwd: SERVER_ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  console.log(`[test-env] ${label} complete`);
}

export function setup(): void {
  const env = requireTestEnvironment();
  tempRoot = tempRootFromDatabaseUrl(env.DATABASE_URL);

  if (!tempRoot.includes(TEMP_DIR_PREFIX)) {
    throw new Error(`Refusing to use "${tempRoot}" as the test workspace: not a temp directory.`);
  }

  runNodeStep(
    'prisma db push',
    PRISMA_CLI,
    ['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate', '--accept-data-loss'],
    env
  );

  runNodeStep('prisma seed', TSX_CLI, ['prisma/seed.ts'], { ...env, SEED_ADMIN_PASSWORD: SEED_PASSWORD });
}

export function teardown(): void {
  if (!tempRoot) return;
  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log(`[test-env] removed ${tempRoot}`);
}
