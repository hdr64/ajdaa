import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

/**
 * The log endpoints are guarded by two independent factors: an active super
 * admin (re-read from the database) and the shared log key. Neither one on
 * its own is enough.
 */

let superAdminToken: string;
let superAdminId: string;
let viewerToken: string;

const LOGS_KEY = config.logs.secretKey;

beforeAll(async () => {
  await getApp();
  const superAdmin = await seedSession(SEED_ADMINS.superAdmin);
  superAdminToken = superAdmin.token;
  superAdminId = superAdmin.id;
  viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;
});

afterAll(async () => {
  await closeApp();
});

describe('the log endpoints need a super admin and the log key', () => {
  it('refuses an anonymous request', async () => {
    const response = await inject({ method: 'GET', url: '/api/logs' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses the log key on its own', async () => {
    const response = await inject({
      method: 'GET',
      url: '/api/logs',
      headers: { 'x-logs-key': LOGS_KEY },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a super admin without the log key', async () => {
    const response = await authInject(superAdminToken, { method: 'GET', url: '/api/logs' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses the key in the query string', async () => {
    const response = await authInject(superAdminToken, {
      method: 'GET',
      url: `/api/logs?key=${encodeURIComponent(LOGS_KEY)}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a key of a different length', async () => {
    const response = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/logs',
      headers: { 'x-logs-key': `${LOGS_KEY}x` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses an admin who is not a super admin, even with the key', async () => {
    const response = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/logs',
      headers: { 'x-logs-key': LOGS_KEY },
    });

    expect(response.statusCode).toBe(403);
  });

  it('accepts a super admin with the key in the header', async () => {
    const response = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/logs',
      headers: { 'x-logs-key': LOGS_KEY },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { success: boolean }).success).toBe(true);
  });

  it('refuses a super admin whose account was suspended', async () => {
    await prisma.adminUser.update({
      where: { id: superAdminId },
      data: { status: 'suspended' },
    });

    try {
      const response = await authInject(superAdminToken, {
        method: 'GET',
        url: '/api/logs',
        headers: { 'x-logs-key': LOGS_KEY },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await prisma.adminUser.update({
        where: { id: superAdminId },
        data: { status: 'active' },
      });
    }
  });
});

describe('the log endpoints that stay open', () => {
  it('keeps the client error beacon reachable without credentials', async () => {
    const response = await inject({
      method: 'POST',
      url: '/api/logs/client-error',
      payload: { message: 'guard test beacon' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('serves the viewer shell without embedding the secret', async () => {
    const response = await inject({ method: 'GET', url: '/api/logs/view' });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(LOGS_KEY);
    // The key must not travel in a URL either.
    expect(response.body).not.toContain('?key=');
    // The page asks for the key instead of carrying it.
    expect(response.body).toContain('x-logs-key');
  });
});
