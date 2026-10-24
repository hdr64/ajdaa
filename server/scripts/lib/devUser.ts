import crypto from 'node:crypto';

import { PERMISSION_KEYS } from '../../src/config/permissions.js';

export interface CliArgs {
  email: string;
  name: string;
  phone: string | null;
  generate: boolean;
  resetPassword: boolean;
  yes: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    email: '',
    name: '',
    phone: null,
    generate: false,
    resetPassword: false,
    yes: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '--email':
        args.email = argv[++i] ?? '';
        break;
      case '--name':
        args.name = argv[++i] ?? '';
        break;
      case '--phone':
        args.phone = argv[++i] ?? null;
        break;
      case '--generate':
        args.generate = true;
        break;
      case '--reset-password':
        args.resetPassword = true;
        break;
      case '--yes':
        args.yes = true;
        break;
      case '--password':
        throw new Error(
          '--password is not allowed: passwords are never accepted on the command line or via environment variables.'
        );
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        break;
    }
    i += 1;
  }

  return args;
}

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) {
    throw new Error(`Invalid email address: ${email}`);
  }
  return trimmed;
}

export function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters (got ${trimmed.length})`
    );
  }
  return trimmed;
}

export function allPermissionsObject(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    result[key] = true;
  }
  return result;
}

/**
 * Builds the Prisma `AdminUser.create` payload for a developer super-admin
 * account: every permission key explicitly set to `true`, role `super_admin`,
 * `roleId = 'role_super_admin'`, `status = 'active'`, and `passwordChangedAt`
 * stamped to now so every previously issued token is revoked.
 */
export function buildDevUserData(
  email: string,
  name: string,
  phone: string | null,
  passwordHash: string,
  departmentId: string | null = null
) {
  return {
    email,
    passwordHash,
    name,
    phone: phone ?? null,
    role: 'super_admin',
    roleAr: 'مدير عام النظام (Super Admin)',
    roleId: 'role_super_admin',
    department: 'الإدارة التنفيذية',
    departmentId,
    permissions: JSON.stringify(allPermissionsObject()),
    status: 'active',
    passwordChangedAt: new Date(),
  };
}

/**
 * Generates a 20-character random password (letters + digits, at least one of
 * each) using `crypto.randomInt`. No dependency beyond Node's standard library.
 */
export function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password: string;
  do {
    password = Array.from({ length: 20 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  } while (!/[a-zA-Z]/.test(password) || !/\d/.test(password));
  return password;
}

/**
 * Extracts the database name from a `DATABASE_URL` so it can be printed
 * (never the full URL, which would expose host, user or password).
 *
 * SQLite file URLs: `file:./dev.db` → `dev.db`
 * PostgreSQL URLs: `postgresql://user:pass@host:5432/ajda` → `ajda`
 */
export function parseDbName(databaseUrl: string): string {
  if (databaseUrl.startsWith('file:')) {
    const filePath = databaseUrl.slice('file:'.length);
    return filePath.split(/[/\\]/).pop() ?? filePath;
  }
  const match = databaseUrl.match(/^[^/]+:\/\/[^@]+@[^/]+\/([^?]+)/);
  return match ? match[1] : '';
}

export function isLocalDatabase(databaseUrl: string): boolean {
  return databaseUrl.startsWith('file:');
}
