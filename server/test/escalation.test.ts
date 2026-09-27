import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  login,
  removeUser,
  SEED_ADMINS,
  SEED_PASSWORD,
  seedSession,
  type TestSession,
} from './helpers.js';

const superAdminEmail = SEED_ADMINS.superAdmin;

let seededSuperAdminId: string;
let throwawayUsers: TestSession[] = [];
let nonSuperManager: TestSession | undefined;
let promotionTarget: TestSession | undefined;

beforeAll(async () => {
  await getApp();
  seededSuperAdminId = (await seedSession(superAdminEmail)).id;
});

afterAll(async () => {
  // Undo everything through Prisma so the shared database is left exactly as seeded.
  // The seeded super admin is restored first: if any cleanup step throws, the
  // remaining files must still find a usable super admin.
  await prisma.adminUser.update({
    where: { id: seededSuperAdminId },
    data: { role: 'super_admin', status: 'active' },
  });
  for (const user of throwawayUsers) {
    await removeUser(user.id);
  }
  if (nonSuperManager) await removeUser(nonSuperManager.id);
  if (promotionTarget) await removeUser(promotionTarget.id);
  await closeApp();
});

describe('only a super admin can hand out the super_admin role', () => {
  it('lets a super admin promote another account', async () => {
    const target = await createThrowawayUser({ role: 'viewer' });
    promotionTarget = target;

    const superAdmin = await seedSession(superAdminEmail);
    const response = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/auth/users/${target.id}`,
      payload: { role: 'super_admin' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { role: string }).role).toBe('super_admin');

    // Demote again straight away: a second active super admin would break the
    // "last active super admin" invariant the next suite depends on.
    const demoted = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/auth/users/${target.id}`,
      payload: { role: 'viewer' },
    });
    expect(demoted.statusCode).toBe(200);
  });

  it('refuses a manageUsers holder that is not a super admin from creating a super_admin', async () => {
    const manager = await createThrowawayUser({
      role: 'project_manager',
      permissions: { manageUsers: true, manageProjects: true },
    });
    nonSuperManager = manager;

    const session = await login(manager.email, SEED_PASSWORD);
    expect(session.permissions.manageUsers).toBe(true);

    const created = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Unauthorised Promotion',
        email: 'unauthorised.promotion@ajdaa.test',
        password: SEED_PASSWORD,
        role: 'super_admin',
      },
    });
    expect(created.statusCode).toBe(403);

    const target = await createThrowawayUser({ role: 'viewer' });
    throwawayUsers.push(target);

    const promoted = await authInject(session.token, {
      method: 'PUT',
      url: `/api/auth/users/${target.id}`,
      payload: { role: 'super_admin' },
    });
    expect(promoted.statusCode).toBe(403);
  });
});

describe('the last active super admin is protected', () => {
  let custodian: TestSession;

  beforeAll(async () => {
    // Move the seeded super admin out of the way through the API so the only
    // remaining active super admin is `custodian`, acting on a different account.
    const successor = await createThrowawayUser({ role: 'viewer' });
    throwawayUsers.push(successor);

    const superAdmin = await seedSession(superAdminEmail);
    const promoted = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/auth/users/${successor.id}`,
      payload: { role: 'super_admin' },
    });
    expect(promoted.statusCode).toBe(200);

    custodian = await login(successor.email, SEED_PASSWORD);

    const suspended = await authInject(custodian.token, {
      method: 'PUT',
      url: `/api/auth/users/${seededSuperAdminId}`,
      payload: { status: 'suspended' },
    });
    expect(suspended.statusCode).toBe(200);

    const activeSuperAdmins = await prisma.adminUser.count({
      where: { role: 'super_admin', status: 'active' },
    });
    expect(activeSuperAdmins).toBe(1);
  });

  it('refuses to demote the last active super admin', async () => {
    const response = await authInject(custodian.token, {
      method: 'PUT',
      url: `/api/auth/users/${seededSuperAdminId}`,
      payload: { role: 'project_manager' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuses to delete the last active super admin', async () => {
    const response = await authInject(custodian.token, {
      method: 'DELETE',
      url: `/api/auth/users/${seededSuperAdminId}`,
    });

    expect(response.statusCode).toBe(400);
  });
});
