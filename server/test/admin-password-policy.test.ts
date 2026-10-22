import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  removeUser,
  SEED_ADMINS,
  seedSession,
  type TestSession,
} from './helpers.js';

/**
 * A password that an admin sets for somebody else is a password the owner
 * never chose, so it obeys the same policy as a self-service one: at least 10
 * characters, one letter and one digit.
 */

let superAdminToken: string;
let target: TestSession | undefined;

beforeAll(async () => {
  await getApp();
  superAdminToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
});

afterAll(async () => {
  if (target) await removeUser(target.id);
  await closeApp();
});

describe('creating an admin account', () => {
  it('refuses a request without a password', async () => {
    const response = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'No Password',
        email: `no-password-${Date.now()}@ajdaa.test`,
        role: 'viewer',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuses a password that does not meet the policy', async () => {
    const response = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Weak Password',
        email: `weak-password-${Date.now()}@ajdaa.test`,
        password: 'password',
        role: 'viewer',
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: string }).error).toMatch(/at least 10 characters/i);
  });

  it('refuses a password without a digit', async () => {
    const response = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Letters Only',
        email: `letters-only-${Date.now()}@ajdaa.test`,
        password: 'abcdefghijkl',
        role: 'viewer',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('accepts a password that meets the policy', async () => {
    const email = `policy-ok-${Date.now()}@ajdaa.test`;

    const response = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Policy OK',
        email,
        password: 'password123',
        role: 'viewer',
      },
    });

    expect(response.statusCode).toBe(201);

    const created = response.json() as { id: string };
    await prisma.adminUser.deleteMany({ where: { id: created.id } });
  });
});

describe('changing the password of an admin account', () => {
  it('refuses a password that does not meet the policy', async () => {
    target = await createThrowawayUser({ role: 'viewer' });

    const response = await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/auth/users/${target.id}`,
      payload: { password: 'shortpass' },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: string }).error).toMatch(/at least 10 characters/i);
  });

  it('refuses a password that is too short to even reach the policy', async () => {
    const response = await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/auth/users/${target!.id}`,
      payload: { password: 'short' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('leaves the stored password untouched when the policy is refused', async () => {
    const before = await prisma.adminUser.findUnique({ where: { id: target!.id } });

    await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/auth/users/${target!.id}`,
      payload: { password: 'shortpass' },
    });

    const after = await prisma.adminUser.findUnique({ where: { id: target!.id } });
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it('accepts a password that meets the policy', async () => {
    const response = await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/auth/users/${target!.id}`,
      payload: { password: 'BrandNewPassword123' },
    });

    expect(response.statusCode).toBe(200);
  });
});
