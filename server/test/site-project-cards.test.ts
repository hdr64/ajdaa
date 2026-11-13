import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { SITE_DEFAULTS } from '../src/services/siteSettings.js';
import { authInject, closeApp, getApp, inject, seedSession, SEED_ADMINS, type TestSession } from './helpers.js';

/** The project-card switch: show a 3D button on home cards that have a 3D model, video or page. */

let superSession: TestSession;

/** A full body, as the admin settings page sends it. */
function siteBody(projectCards?: Record<string, unknown>) {
  const { projectCards: _ignored, ...rest } = SITE_DEFAULTS;
  return { ...rest, ...(projectCards ? { projectCards } : {}) };
}

async function resetSiteRow(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: 'site' } });
}

async function readProjectCards(): Promise<{ show3d: boolean }> {
  const response = await inject({ method: 'GET', url: '/api/settings/site' });
  expect(response.statusCode).toBe(200);
  return (response.json() as { projectCards: { show3d: boolean } }).projectCards;
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

describe('project cards settings', () => {
  it('shows 3D on a fresh database and when a stored row predates the switch', async () => {
    expect(await readProjectCards()).toEqual({ show3d: true });

    // A row written by an older build has no `projectCards` key at all.
    const { projectCards: _ignored, ...legacy } = SITE_DEFAULTS;
    await prisma.appSetting.upsert({
      where: { key: 'site' },
      create: { key: 'site', value: JSON.stringify(legacy) },
      update: { value: JSON.stringify(legacy) },
    });
    // Saving through the API refreshes the in-process cache.
    const saved = await authInject(superSession.token, { method: 'PUT', url: '/api/settings/site', payload: siteBody() });
    expect(saved.statusCode).toBe(200);
    expect(await readProjectCards()).toEqual({ show3d: true });
  });

  it('persists show3d: false and keeps it when a later body omits projectCards', async () => {
    const hide = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody({ show3d: false }),
    });
    expect(hide.statusCode).toBe(200);
    expect(await readProjectCards()).toEqual({ show3d: false });

    // A client that predates the switch sends no `projectCards` at all: nothing is reset.
    const legacyClient = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody(),
    });
    expect(legacyClient.statusCode).toBe(200);
    expect(await readProjectCards()).toEqual({ show3d: false });

    const show = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody({ show3d: true }),
    });
    expect(show.statusCode).toBe(200);
    expect(await readProjectCards()).toEqual({ show3d: true });
  });

  it('rejects a non-boolean switch', async () => {
    const response = await authInject(superSession.token, {
      method: 'PUT',
      url: '/api/settings/site',
      payload: siteBody({ show3d: 'no' }),
    });
    expect(response.statusCode).toBe(400);
  });
});
