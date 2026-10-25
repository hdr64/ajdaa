import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

const NON_EXISTENT_PROJECT_ID = 999999;
const NON_EXISTENT_UNIT_ID = 'nope';

let superAdminToken: string;
let superAdminId: string;
let projectManagerToken: string;
let salesAgentToken: string;
let viewerToken: string;
let viewerId: string;

beforeAll(async () => {
  await getApp();
  const superAdmin = await seedSession(SEED_ADMINS.superAdmin);
  superAdminToken = superAdmin.token;
  superAdminId = superAdmin.id;

  projectManagerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
  salesAgentToken = (await seedSession(SEED_ADMINS.salesAgent)).token;

  const viewer = await seedSession(SEED_ADMINS.viewer);
  viewerToken = viewer.token;
  viewerId = viewer.id;
});

afterAll(async () => {
  await closeApp();
});

describe('admin user management is restricted to manageUsers', () => {
  it('refuses a viewer who tries to promote their own account to super_admin', async () => {
    const response = await authInject(viewerToken, {
      method: 'PUT',
      url: `/api/auth/users/${viewerId}`,
      payload: { role: 'super_admin' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a viewer who tries to create a super_admin', async () => {
    const response = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Escalation Attempt',
        email: 'escalation.viewer@ajdaa.test',
        password: 'password',
        role: 'super_admin',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a viewer who tries to list the admin roster', async () => {
    const response = await authInject(viewerToken, { method: 'GET', url: '/api/auth/users' });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a project_manager who tries to delete a super admin', async () => {
    const response = await authInject(projectManagerToken, {
      method: 'DELETE',
      url: `/api/auth/users/${superAdminId}`,
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('project deletion is restricted to manageProjects', () => {
  it('refuses a viewer', async () => {
    const response = await authInject(viewerToken, {
      method: 'DELETE',
      url: `/api/projects/${NON_EXISTENT_PROJECT_ID}`,
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a sales_agent', async () => {
    const response = await authInject(salesAgentToken, {
      method: 'DELETE',
      url: `/api/projects/${NON_EXISTENT_PROJECT_ID}`,
    });

    expect(response.statusCode).toBe(403);
  });

  it('reports 404, not 500, when an authorised manager deletes a missing project', async () => {
    const response = await authInject(projectManagerToken, {
      method: 'DELETE',
      url: `/api/projects/${NON_EXISTENT_PROJECT_ID}`,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('unit status changes are restricted to manageUnits', () => {
  it('refuses a viewer before the unit is even looked up', async () => {
    const response = await authInject(viewerToken, {
      method: 'PATCH',
      url: `/api/units/${NON_EXISTENT_UNIT_ID}/status`,
      payload: { status: 'sold' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('reports 404 for an authorised sales agent patching a missing unit', async () => {
    const response = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/units/${NON_EXISTENT_UNIT_ID}/status`,
      payload: { status: 'sold' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('media uploads are restricted to manageProjects', () => {
  it('refuses a viewer', async () => {
    const response = await authInject(viewerToken, { method: 'POST', url: '/api/media/upload' });

    expect(response.statusCode).toBe(403);
  });
});

describe('granted reads still work', () => {
  it('lets a viewer list inquiries with viewInquiries', async () => {
    const response = await authInject(viewerToken, { method: 'GET', url: '/api/inquiries' });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });

  it('lets a super admin list the admin roster', async () => {
    const response = await authInject(superAdminToken, { method: 'GET', url: '/api/auth/users' });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});

describe('super admin cannot widen their own access', () => {
  it('accepts the admin form resending the unchanged name, role, status and permissions', async () => {
    const current = await authInject(superAdminToken, { method: 'GET', url: '/api/auth/me' });
    expect(current.statusCode).toBe(200);

    const { user } = current.json() as {
      user: { name: string; role: string; status: string; permissions: Record<string, boolean> };
    };

    const response = await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/auth/users/${superAdminId}`,
      payload: {
        name: user.name,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('refuses a change to their own permissions', async () => {
    const response = await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/auth/users/${superAdminId}`,
      payload: { permissions: { manageUsers: false, manageProjects: true } },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('token and payload validation', () => {
  it('returns the current profile for any valid token', async () => {
    const response = await authInject(viewerToken, { method: 'GET', url: '/api/auth/me' });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: { email: string } }).user.email).toBe(SEED_ADMINS.viewer);
  });

  it('rejects an unauthenticated inquiry listing', async () => {
    const response = await inject({ method: 'GET', url: '/api/inquiries' });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a malformed project payload from an authorised manager with 400', async () => {
    const response = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
