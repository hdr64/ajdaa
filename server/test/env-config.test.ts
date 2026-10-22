import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { productionConfigErrors } from '../src/config/env.js';

/**
 * The environment is validated when `src/config/env.ts` is imported, and an
 * unacceptable configuration stops the process. The rules are therefore tested
 * twice: as a pure function (fast, exhaustive) and by booting the real module
 * in a child process (proves the boot actually fails).
 */

const SERVER_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TSX_CLI = path.join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const PROBE = path.join(SERVER_ROOT, 'test', 'fixtures', 'env-probe.ts');

const VALID_JWT_SECRET = 'a1b2c3d4e5f6'.repeat(6);
const VALID_LOGS_SECRET = 'logs-secret-value-'.repeat(2);
const VALID_DEVELOPER_SECRET = 'developer-secret-value-'.repeat(2);

interface ProbeResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runProbe(env: Record<string, string>): ProbeResult {
  const result = spawnSync(process.execPath, [TSX_CLI, PROBE], {
    cwd: SERVER_ROOT,
    // The child inherits the environment of the test runner and gets the
    // variables of this case on top: an empty value must stay empty, so a
    // developer's own `.env` cannot fill in a secret that is meant to be
    // missing.
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function probeConfig(env: Record<string, string>): Record<string, unknown> {
  const result = runProbe(env);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

const BASE_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'file:./env-probe.db',
  JWT_SECRET: VALID_JWT_SECRET,
  LOGS_SECRET_KEY: VALID_LOGS_SECRET,
  DEVELOPER_NOTES_SECRET: VALID_DEVELOPER_SECRET,
};

describe('the production rules of the environment', () => {
  it('accepts a complete configuration', () => {
    expect(
      productionConfigErrors(
        { nodeEnv: 'production', jwtSecret: VALID_JWT_SECRET },
        {
          LOGS_SECRET_KEY: VALID_LOGS_SECRET,
          DEVELOPER_NOTES_SECRET: VALID_DEVELOPER_SECRET,
        }
      )
    ).toEqual({});
  });

  it('requires the log key and the developer key', () => {
    const errors = productionConfigErrors(
      { nodeEnv: 'production', jwtSecret: VALID_JWT_SECRET },
      {}
    );

    expect(errors.LOGS_SECRET_KEY).toBeDefined();
    expect(errors.DEVELOPER_NOTES_SECRET).toBeDefined();
  });

  it('requires at least 24 characters for the shared secrets', () => {
    const errors = productionConfigErrors(
      { nodeEnv: 'production', jwtSecret: VALID_JWT_SECRET },
      { LOGS_SECRET_KEY: 'too-short', DEVELOPER_NOTES_SECRET: 'also-too-short' }
    );

    expect(errors.LOGS_SECRET_KEY).toMatch(/24/);
    expect(errors.DEVELOPER_NOTES_SECRET).toMatch(/24/);
  });

  it('requires a JWT secret of at least 32 characters', () => {
    const errors = productionConfigErrors(
      { nodeEnv: 'production', jwtSecret: 'sixteen-chars-xxx' },
      { LOGS_SECRET_KEY: VALID_LOGS_SECRET, DEVELOPER_NOTES_SECRET: VALID_DEVELOPER_SECRET }
    );

    expect(errors.JWT_SECRET).toMatch(/32/);
  });

  it('rejects the obvious JWT placeholders', () => {
    for (const placeholder of [
      'changeme-changeme-changeme-changeme',
      'password-password-password-pass',
      'ajda_secret_development_key_super_secure_2026',
    ]) {
      const errors = productionConfigErrors(
        { nodeEnv: 'production', jwtSecret: placeholder },
        { LOGS_SECRET_KEY: VALID_LOGS_SECRET, DEVELOPER_NOTES_SECRET: VALID_DEVELOPER_SECRET }
      );

      expect(errors.JWT_SECRET, placeholder).toBeDefined();
    }
  });

  it('applies to production only', () => {
    expect(
      productionConfigErrors(
        { nodeEnv: 'development', jwtSecret: 'short' },
        {}
      )
    ).toEqual({});
  });
});

describe('booting with the environment', () => {
  it('starts with a complete production configuration', () => {
    const config = probeConfig(BASE_ENV);

    expect(config.host).toBe('127.0.0.1');
    expect(config.trustProxy).toBe(false);
    expect(config.logsSecretKey).toBe(VALID_LOGS_SECRET);
  });

  it('refuses to start in production without the shared secrets', () => {
    const result = runProbe({
      ...BASE_ENV,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('LOGS_SECRET_KEY');
    expect(result.stderr).toContain('DEVELOPER_NOTES_SECRET');
  });

  it('uses a random per-process secret outside production', () => {
    const first = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
    });
    const second = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
    });

    expect(first.logsSecretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(first.developerSecretKey).toMatch(/^[0-9a-f]{64}$/);
    // The published defaults are gone.
    expect(first.logsSecretKey).not.toBe('ajda-logs-secret-2026');
    expect(first.developerSecretKey).not.toBe('ajda-dev-notes-2026');
    // Two processes never share one.
    expect(first.logsSecretKey).not.toBe(second.logsSecretKey);
  });

  it('configures no developer email by default', () => {
    const config = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
      DEVELOPER_EMAIL: '',
    });

    expect(config.developerEmails).toEqual([]);
  });
});

describe('the network settings', () => {
  it('binds to 127.0.0.1 and trusts no proxy by default', () => {
    const config = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
      HOST: '',
      TRUST_PROXY: '',
    });

    expect(config.host).toBe('127.0.0.1');
    expect(config.trustProxy).toBe(false);
  });

  it('accepts an explicit bind address', () => {
    const config = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
      HOST: '0.0.0.0',
    });

    expect(config.host).toBe('0.0.0.0');
  });

  it('accepts a proxy hop count', () => {
    const config = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
      TRUST_PROXY: '2',
    });

    expect(config.trustProxy).toBe(2);
  });

  it('accepts "true"', () => {
    const config = probeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
      TRUST_PROXY: 'true',
    });

    expect(config.trustProxy).toBe(true);
  });

  it('refuses a value that is neither a boolean nor a hop count', () => {
    const result = runProbe({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./env-probe.db',
      JWT_SECRET: VALID_JWT_SECRET,
      LOGS_SECRET_KEY: '',
      DEVELOPER_NOTES_SECRET: '',
      TRUST_PROXY: 'maybe',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('TRUST_PROXY');
  });
});
