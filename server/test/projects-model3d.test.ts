import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

let managerToken: string;
const createdIds: number[] = [];

/** Minimum body accepted by POST/PUT /api/projects. */
const baseProject = {
  type: 'commercial',
  typeAr: 'تجاري',
  title: 'مشروع المجسم ثلاثي الأبعاد',
  priceType: 'بيع',
  area: 1500,
  city: 'الرياض',
  image: '/uploads/model3d-test.webp',
};

const create = (extra: Record<string, unknown> = {}) =>
  authInject(managerToken, {
    method: 'POST',
    url: '/api/projects',
    payload: { ...baseProject, ...extra },
  });

const update = (id: number, extra: Record<string, unknown> = {}) =>
  authInject(managerToken, {
    method: 'PUT',
    url: `/api/projects/${id}`,
    payload: { ...baseProject, ...extra },
  });

beforeAll(async () => {
  await getApp();
  managerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: createdIds } } });
  }
  await closeApp();
});

describe('POST/PUT /api/projects model3dUrl', () => {
  it('accepts an https model3dUrl and round-trips it', async () => {
    const response = await create({
      model3dUrl: 'https://viewer.example.com/model/42',
      brochureUrl: 'https://example.com/docs/profile.pdf',
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: number; model3dUrl: string | null; brochureUrl: string | null };
    createdIds.push(body.id);
    expect(body.model3dUrl).toBe('https://viewer.example.com/model/42');
    // brochureUrl is unchanged by this lane; asserted here to guard the create path.
    expect(body.brochureUrl).toBe('https://example.com/docs/profile.pdf');

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored.model3dUrl).toBe('https://viewer.example.com/model/42');
  });

  it('rejects http, javascript, spaces and over-500-character values with 400', async () => {
    const invalid: [string, string][] = [
      ['http scheme', 'http://viewer.example.com/model/42'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['embedded space', 'https://viewer.example.com/a b'],
      ['over the length cap', `https://viewer.example.com/${'a'.repeat(600)}`],
    ];

    for (const [label, model3dUrl] of invalid) {
      const response = await create({ model3dUrl });
      expect(response.statusCode, label).toBe(400);
    }
  });

  it('accepts a library .glb path and round-trips it', async () => {
    const response = await create({ model3dUrl: '/uploads/3f2a-villa_model.glb' });
    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: number; model3dUrl: string | null; virtualTour3dAvailable: boolean };
    createdIds.push(body.id);
    expect(body.model3dUrl).toBe('/uploads/3f2a-villa_model.glb');
    expect(body.virtualTour3dAvailable).toBe(true);
  });

  it('accepts videos, HTML pages and nested extracted-folder paths', async () => {
    for (const model3dUrl of [
      '/uploads/3f2a-tour.mp4',
      '/uploads/3f2a-page.html',
      '/uploads/3f2a-site/site/index.html',
      '/uploads/3f2a-site/%D9%85%D9%84%D9%81/index.html',
      '/uploads/3f2a-clips/clips/a.webm',
      '/uploads/3f2a-prime/prime/tour.html?mode=model',
      '/uploads/3f2a-prime/prime/tour.html?mode=model&lang=ar#start',
    ]) {
      const response = await create({ model3dUrl });
      expect(response.statusCode, model3dUrl).toBe(201);
      const body = response.json() as { id: number; model3dUrl: string | null };
      createdIds.push(body.id);
      expect(body.model3dUrl).toBe(model3dUrl);
    }
  });

  it('rejects library paths that are not a plain .glb upload', async () => {
    const invalid: [string, string][] = [
      ['path traversal', '/uploads/../secret.glb'],
            ['pdf file', '/uploads/x.pdf'],
      ['gltf file', '/uploads/x.gltf'],
      ['other folder', '/other/x.glb'],
      ['embedded space', '/uploads/a b.glb'],
      ['nested traversal', '/uploads/a/../b/index.html'],
      ['double slash', '/uploads/a//index.html'],
      ['script file', '/uploads/a/app.js'],
      ['query on a glb', '/uploads/a/model.glb?x=1'],
      ['query with a quote', '/uploads/a/index.html?x="1"'],
      ['query traversal', '/uploads/a/index.html?x=../b'],
      ['query before extension', '/uploads/a/page?x=1.html'],
      ['exe file', '/uploads/a/run.exe'],
    ];

    for (const [label, model3dUrl] of invalid) {
      const response = await create({ model3dUrl });
      expect(response.statusCode, label).toBe(400);
    }
  });

  it('stores an empty model3dUrl as null', async () => {
    const response = await create({ model3dUrl: '' });
    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: number; model3dUrl: string | null };
    createdIds.push(body.id);
    expect(body.model3dUrl).toBeNull();

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored.model3dUrl).toBeNull();
  });

  it('round-trips brochureUrl on update', async () => {
    const created = (await create()).json() as { id: number };
    createdIds.push(created.id);

    const response = await update(created.id, { brochureUrl: 'https://example.com/docs/profile-v2.pdf' });
    expect(response.statusCode).toBe(200);
    expect(response.json().brochureUrl).toBe('https://example.com/docs/profile-v2.pdf');
  });
});

describe('virtualTour3dAvailable is derived from model3dUrl', () => {
  it('reports true when model3dUrl is set, even though the stored column stays false', async () => {
    const created = (
      await create({ model3dUrl: 'https://viewer.example.com/model/7', publishStatus: 'published' })
    ).json() as { id: number; virtualTour3dAvailable: boolean };
    createdIds.push(created.id);

    expect(created.virtualTour3dAvailable).toBe(true);

    // The route never writes the legacy column...
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.virtualTour3dAvailable).toBe(false);
    expect(stored.model3dUrl).toBe('https://viewer.example.com/model/7');

    // ...and the anonymous detail read derives it the same way.
    const publicRead = await inject({ method: 'GET', url: `/api/projects/${created.id}` });
    expect(publicRead.statusCode).toBe(200);
    expect((publicRead.json() as { virtualTour3dAvailable: boolean }).virtualTour3dAvailable).toBe(true);
  });

  it('reports false when model3dUrl is absent, even if the stored column is true', async () => {
    const created = (await create({ publishStatus: 'published' })).json() as { id: number };
    createdIds.push(created.id);

    // Simulate legacy data that claims a 3D tour without a link.
    await prisma.project.update({ where: { id: created.id }, data: { virtualTour3dAvailable: true } });

    const updated = (await update(created.id, {})).json() as { virtualTour3dAvailable: boolean };
    expect(updated.virtualTour3dAvailable).toBe(false);
  });

  it('ignores an incoming virtualTour3dAvailable and leaves the stored column untouched', async () => {
    const created = (await create()).json() as { id: number };
    createdIds.push(created.id);

    await prisma.project.update({ where: { id: created.id }, data: { virtualTour3dAvailable: true } });

    const response = await update(created.id, { virtualTour3dAvailable: false });
    expect(response.statusCode).toBe(200);
    // Derived response (no model3dUrl)...
    expect(response.json().virtualTour3dAvailable).toBe(false);
    // ...while the stored column is still whatever it was before the write.
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.virtualTour3dAvailable).toBe(true);
  });

  it('clears the derived flag when model3dUrl is removed on update', async () => {
    const created = (
      await create({ model3dUrl: 'https://viewer.example.com/model/9' })
    ).json() as { id: number; virtualTour3dAvailable: boolean };
    createdIds.push(created.id);
    expect(created.virtualTour3dAvailable).toBe(true);

    const cleared = (await update(created.id, { model3dUrl: '' })).json() as {
      model3dUrl: string | null;
      virtualTour3dAvailable: boolean;
    };
    expect(cleared.model3dUrl).toBeNull();
    expect(cleared.virtualTour3dAvailable).toBe(false);
  });
});

describe('model3dDisplay', () => {
  const display = (body: unknown) => (body as { model3dDisplay: string }).model3dDisplay;

  it('defaults to modal when the field is not sent', async () => {
    const response = await create({ model3dUrl: 'https://viewer.example.com/model/11' });
    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: number };
    createdIds.push(body.id);
    expect(display(body)).toBe('modal');
  });

  it('persists tab on update and keeps it when a later update omits the field', async () => {
    const created = (await create({ model3dUrl: '/uploads/3f2a-site/index.html' })).json() as { id: number };
    createdIds.push(created.id);

    const toTab = await update(created.id, { model3dUrl: '/uploads/3f2a-site/index.html', model3dDisplay: 'tab' });
    expect(toTab.statusCode).toBe(200);
    expect(display(toTab.json())).toBe('tab');
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.model3dDisplay).toBe('tab');

    // A client that predates the option sends no `model3dDisplay`: nothing is reset.
    const legacyClient = await update(created.id, { model3dUrl: '/uploads/3f2a-site/index.html' });
    expect(legacyClient.statusCode).toBe(200);
    expect(display(legacyClient.json())).toBe('tab');

    const back = await update(created.id, { model3dDisplay: 'modal' });
    expect(display(back.json())).toBe('modal');
  });

  it('is copied by duplicate', async () => {
    const created = (await create({ model3dUrl: 'https://viewer.example.com/model/12', model3dDisplay: 'tab' })).json() as {
      id: number;
    };
    createdIds.push(created.id);

    const copy = await authInject(managerToken, { method: 'POST', url: `/api/projects/${created.id}/duplicate` });
    expect(copy.statusCode).toBeLessThan(300);
    const copyBody = copy.json() as { id: number };
    createdIds.push(copyBody.id);
    expect(display(copyBody)).toBe('tab');
  });

  it('persists fullscreen', async () => {
    const created = (await create({ model3dUrl: 'https://viewer.example.com/model/13', model3dDisplay: 'fullscreen' })).json() as {
      id: number;
    };
    createdIds.push(created.id);
    expect(display(created)).toBe('fullscreen');
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.model3dDisplay).toBe('fullscreen');
  });

  it('rejects a value other than modal, fullscreen or tab with 400', async () => {
    const response = await create({ model3dDisplay: 'popup' });
    expect(response.statusCode).toBe(400);
  });
});
