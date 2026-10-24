import { describe, expect, it } from 'vitest';

import { meetsPasswordPolicy } from '../src/services/passwordPolicy.js';
import {
  allPermissionsObject,
  buildDevUserData,
  generatePassword,
  normalizeEmail,
  parseCliArgs,
  parseDbName,
  validateName,
} from '../scripts/lib/devUser.js';

describe('normalizeEmail', () => {
  it('trims and lowercases a valid email', () => {
    expect(normalizeEmail('  Dev.User@Example.COM ')).toBe('dev.user@example.com');
  });

  it.each([
    'not-an-email',
    '@example.com',
    'user@',
    'user @example.com',
    '',
    '   ',
  ])('rejects %j', (bad) => {
    expect(() => normalizeEmail(bad)).toThrow();
  });
});

describe('validateName', () => {
  it.each([
    ['Ada', true],
    ['A very long name that is exactly eighty characters long!!', true],
    ['A', false],
    ['', false],
  ])('accepts %j: %s', (name, ok) => {
    if (ok) {
      expect(() => validateName(name)).not.toThrow();
    } else {
      expect(() => validateName(name)).toThrow();
    }
  });

  it('rejects a name longer than 80 characters', () => {
    expect(() => validateName('A'.repeat(81))).toThrow();
  });
});

describe('parseCliArgs', () => {
  it('parses required and optional flags', () => {
    const args = parseCliArgs([
      '--email',
      'Dev.User@example.com',
      '--name',
      'Ada Developer',
      '--phone',
      '+966501234567',
    ]);
    expect(args.email).toBe('Dev.User@example.com');
    expect(args.name).toBe('Ada Developer');
    expect(args.phone).toBe('+966501234567');
    expect(args.generate).toBe(false);
    expect(args.resetPassword).toBe(false);
    expect(args.yes).toBe(false);
  });

  it('handles --generate, --reset-password and --yes', () => {
    const args = parseCliArgs(['--generate', '--reset-password', '--yes']);
    expect(args.generate).toBe(true);
    expect(args.resetPassword).toBe(true);
    expect(args.yes).toBe(true);
  });

  it('rejects --password with a clear error', () => {
    expect(() => parseCliArgs(['--password', 'secret123'])).toThrow(
      /command line/
    );
  });

  it('rejects unknown flags', () => {
    expect(() => parseCliArgs(['--bogus'])).toThrow(/Unknown flag/);
  });
});

describe('generatePassword', () => {
  it('always produces a 20-character password meeting the policy', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generatePassword();
      expect(password.length).toBe(20);
      expect(meetsPasswordPolicy(password)).toBe(true);
      expect(/[a-zA-Z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
    }
  });
});

describe('allPermissionsObject', () => {
  it('sets every PERMISSION_KEYS key to true', () => {
    const perms = allPermissionsObject();
    for (const key of [
      'manageProjects',
      'viewProjects',
      'createProject',
      'editProject',
      'deleteProject',
      'publishProject',
      'manageCms',
      'manageClients',
      'managePastProjects',
      'rollbackCms',
      'manageUnits',
      'viewInquiries',
      'viewApplications',
      'manageApplications',
      'exportData',
      'manageUsers',
      'manageNotifications',
    ]) {
      expect(perms[key]).toBe(true);
    }
  });
});

describe('buildDevUserData', () => {
  const hash = 'hashedpassword';
  const data = buildDevUserData('Dev.User@example.com', 'Ada Developer', null, hash);

  it('sets role super_admin with roleId role_super_admin', () => {
    expect(data.role).toBe('super_admin');
    expect(data.roleId).toBe('role_super_admin');
    expect(data.roleAr).toBe('مدير عام النظام (Super Admin)');
    expect(data.departmentId).toBeNull();
  });

  it('sets department exactly as the seeded super admin entry', () => {
    expect(data.department).toBe('الإدارة التنفيذية');
  });

  it('sets status active and stamps passwordChangedAt', () => {
    expect(data.status).toBe('active');
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
  });

  it('sets every permission key to true in the JSON payload', () => {
    const perms = JSON.parse(data.permissions as string);
    expect(typeof perms).toBe('object');
    expect(Array.isArray(perms)).toBe(false);
    for (const key of [
      'manageProjects', 'manageUnits', 'viewInquiries', 'viewApplications',
      'manageApplications', 'managePastProjects', 'exportData', 'manageUsers',
      'manageCms', 'manageClients', 'rollbackCms', 'createProject',
      'editProject', 'deleteProject', 'publishProject', 'viewProjects',
      'manageNotifications',
    ]) {
      expect(perms[key]).toBe(true);
    }
  });

  it('includes phone when provided', () => {
    const withPhone = buildDevUserData('a@b.com', 'Name', '+966500000000', hash);
    expect(withPhone.phone).toBe('+966500000000');
  });

  it('sets departmentId when provided', () => {
    const deptId = 'dept_abc123';
    const withDept = buildDevUserData('a@b.com', 'Name', null, hash, deptId);
    expect(withDept.departmentId).toBe(deptId);
  });
});

describe('parseDbName', () => {
  it('extracts the database name from a SQLite file URL', () => {
    expect(parseDbName('file:./dev.db')).toBe('dev.db');
    expect(parseDbName('file:/tmp/ajda-server-test-abc/test.db')).toBe('test.db');
  });

  it('extracts the database name from a PostgreSQL URL', () => {
    expect(parseDbName('postgresql://ajda:pass@localhost:5432/ajda')).toBe('ajda');
    expect(parseDbName('postgresql://ajda_test:pass@localhost:5432/ajda_test?sslmode=require')).toBe('ajda_test');
  });
});
