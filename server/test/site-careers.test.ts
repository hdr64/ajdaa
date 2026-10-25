import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { SITE_DEFAULTS } from '../src/services/siteSettings.js';
import { authInject, closeApp, getApp, inject, seedSession, SEED_ADMINS, type TestSession } from './helpers.js';

/** The two public careers switches: footer item and floating button. */

let superSession: TestSession;

/** A full body, as the admin settings page sends it. */
function siteBody(careers?: Record<string, unknown>) {
  const { careers: _ignored, ...rest } = SITE_DEFAULTS;
  return { ...rest, ...(careers ? { careers } : {}) };
}

async function resetSiteRow(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: 'site' } });
}

beforeAll(async () => {
  await getApp();
  superSession = await seedSession(SEED_ADMINS.superAdmin);
  await resetSiteRow();
});

afterAll(async () => {
  await resetSiteRow();
  await closeApp();
});

async function readCareers(): Promise<{ showFooterLink: boolean; showFloatingButton: boolean }> {
  const response = await inject({ method: 'GET', url: '/api/settings/site' });
  expect(response.statusCode).toBe(200);
  return (response.json() as { careers: { showFooterLink: boolean; showFloatingButton: boolean } }).careers;
}

describe('careers visibility settings', () => {
  it('shows both on a fresh database and when a stored row predates the switches', async () => {
    expect(await readCareers()).toEqual({ showFooterLink: true, showFloatingButton: true });

    // A row written by an older build has no `careers` key at all.
    const { careers: _ignored, ...legacy } = SITE_DEFAULTS;
    await prisma.appSetting.upsert({
      where: { key: 'site' },
      create: { key: 'site', value: JSON.stringify(legacy) },
      update: { value: JSON.stringify(legacy) },
    });
    // Saving through the API refreshes the in-process cache.
    const saved = await authInject(superSession.token, { method: 'PUT', url: '/api/settings/site', payload: siteBody() });
    expect(saved.statusCode).toBe(200);
    expect(await readCareers()).toEqual({ showFooterLink: true, showFloatingButton: true });
  });

  it('stores each switch independently and keeps the other one when a field is omitted', async () => {
    const hideButton = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody({ showFloatingButton: false }),
    });
    expect(hideButton.statusCode).toBe(200);
    expect(await readCareers()).toEqual({ showFooterLink: true, showFloatingButton: false });

    const hideFooter = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody({ showFooterLink: false, showFloatingButton: true }),
    });
    expect(hideFooter.statusCode).toBe(200);
    expect(await readCareers()).toEqual({ showFooterLink: false, showFloatingButton: true });

    // A client that predates the switches sends no `careers` at all: nothing is reset.
    const legacyClient = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody(),
    });
    expect(legacyClient.statusCode).toBe(200);
    expect(await readCareers()).toEqual({ showFooterLink: false, showFloatingButton: true });
  });

  it('rejects a non-boolean switch', async () => {
    const response = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody({ showFooterLink: 'no' }),
    });
    expect(response.statusCode).toBe(400);
  });
});
