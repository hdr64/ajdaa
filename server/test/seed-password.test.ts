import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The seed is a deployment tool, not a test: it writes to the database, so it
 * is exercised in its own process and only in the cases that must fail
 * before anything is written.
 */

const SERVER_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TSX_CLI = path.join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SEED = path.join(SERVER_ROOT, 'prisma', 'seed.ts');

function runSeed(env: Record<string, string>): { status: number; stderr: string } {
  const result = spawnSync(process.execPath, [TSX_CLI, SEED], {
    cwd: SERVER_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

  return { status: result.status ?? -1, stderr: result.stderr ?? '' };
}

describe('seeding in production', () => {
  it('refuses to run without SEED_ADMIN_PASSWORD', () => {
    const result = runSeed({ NODE_ENV: 'production', SEED_ADMIN_PASSWORD: '' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SEED_ADMIN_PASSWORD');
  });

  it('refuses a password that does not meet the policy', () => {
    const result = runSeed({ NODE_ENV: 'production', SEED_ADMIN_PASSWORD: 'short' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('password policy');
  });
});
