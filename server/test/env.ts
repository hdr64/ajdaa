import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The suite must never touch `prisma/dev.db` or the developer's `.env`. Every
 * run therefore gets a throwaway SQLite file, an upload directory and a random
 * JWT secret, all under a uniquely named directory in the OS temp folder.
 *
 * `src/config/env.ts` validates `process.env` at import time and `dotenv.config()`
 * does not override already-set variables, so these values have to be in place
 * before anything under `src/` is loaded.
 */
export const TEMP_DIR_PREFIX = 'ajda-server-test-';
const DB_FILENAME = 'test.db';

/**
 * Declared as a type alias rather than an interface so it stays assignable to
 * `Record<string, string>` when it is merged into a child process environment.
 */
export type TestEnvironment = {
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  UPLOAD_DIR: string;
  LOGIN_OTP_RESEND_COOLDOWN_MS: string;
  QUEUE_DRIVER: string;
};

/** Prisma's SQLite URL parser wants forward slashes even for Windows drive letters. */
function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function createTestEnvironment(): TestEnvironment {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
  const uploadDir = path.join(root, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  return {
    NODE_ENV: 'test',
    DATABASE_URL: `file:${toPosix(path.join(root, DB_FILENAME))}`,
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    UPLOAD_DIR: uploadDir,
    // Short enough for the resend-throttle test to wait it out, long enough that
    // two back-to-back requests still collide.
    LOGIN_OTP_RESEND_COOLDOWN_MS: '1500',
    // Pinned rather than left to the `auto` default: a developer who happens to
    // have Redis running must not silently push the suite onto the async path.
    // Every other test then exercises the deterministic inline path, and
    // `queue.test.ts` covers the Redis probe and fallback explicitly.
    QUEUE_DRIVER: 'sync',
  };
}

export function applyTestEnvironment(env: TestEnvironment): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

/**
 * True only when this process is pointed at an isolated test database. Used as a
 * guard so a misconfigured run fails loudly instead of quietly writing to dev.db.
 */
export function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' &&
    typeof process.env.DATABASE_URL === 'string' &&
    process.env.DATABASE_URL.includes(TEMP_DIR_PREFIX) &&
    typeof process.env.UPLOAD_DIR === 'string' &&
    process.env.UPLOAD_DIR.includes(TEMP_DIR_PREFIX) &&
    typeof process.env.JWT_SECRET === 'string' &&
    process.env.JWT_SECRET.length >= 16
  );
}

export function requireTestEnvironment(): TestEnvironment {
  if (!isTestEnvironment()) {
    throw new Error(
      'Test environment is not configured. Run the suite with `npm test` so that ' +
        'vitest.config.ts and test/global-setup.ts can inject DATABASE_URL, JWT_SECRET ' +
        'and UPLOAD_DIR. Refusing to run: a fallback would point the suite at a real database.'
    );
  }

  return {
    NODE_ENV: process.env.NODE_ENV as string,
    DATABASE_URL: process.env.DATABASE_URL as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    UPLOAD_DIR: process.env.UPLOAD_DIR as string,
    LOGIN_OTP_RESEND_COOLDOWN_MS: process.env.LOGIN_OTP_RESEND_COOLDOWN_MS as string,
    QUEUE_DRIVER: process.env.QUEUE_DRIVER as string,
  };
}

/**
 * Temp *directory* derived from DATABASE_URL rather than from module state, so the
 * setup and teardown phases agree even if they are loaded in separate module
 * registries.
 */
export function tempRootFromDatabaseUrl(databaseUrl: string): string {
  return path.dirname(path.normalize(databaseUrl.replace(/^file:(\/\/)?/, '')));
}
