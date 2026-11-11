import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { authInject, closeApp, getApp, inject, seedSession } from './helpers.js';
import { buildZip, uploadChunked } from './zip-helper.js';

let token: string;
const createdIds: string[] = [];

interface MediaRow {
  id: string;
  slug: string | null;
  url: string;
}

async function uploadSite(name: string): Promise<MediaRow> {
  const zip = buildZip([
    { name: 'site/index.html', data: Buffer.from('<html><body>hello slug</body></html>') },
    { name: 'site/css/app.css', data: Buffer.from('body{color:red}') },
    { name: 'site/.secret', data: Buffer.from('hidden') },
  ]);
  const { status, body } = await uploadChunked(token, name, zip, 'html');
  expect(status).toBe(201);
  const item = (body.extracted ?? [])[0] as MediaRow;
  createdIds.push(item.id);
  return item;
}

beforeAll(async () => {
  await getApp();
  token = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await prisma.mediaFile.deleteMany({ where: { id: { in: createdIds } } });
  await closeApp();
});

describe('permanent library slugs', () => {
  it('gives every new file a readable, unique slug', async () => {
    const a = await uploadSite('Tower View.zip');
    const b = await uploadSite('Tower View.zip');
    expect(a.slug).toMatch(/^tower-view-[0-9a-f]{6}$/);
    expect(b.slug).not.toBe(a.slug);
  });

  it('serves a file at /f/<slug> without a login', async () => {
    const site = await uploadSite('page-one.zip');
    const res = await inject({ method: 'GET', url: `/f/${site.slug}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('hello slug');

    expect((await inject({ method: 'GET', url: '/f/does-not-exist' })).statusCode).toBe(404);
    expect((await inject({ method: 'GET', url: '/f/Bad_Slug!' })).statusCode).toBe(404);
  });

  it('serves a website at /html/<slug>/ with its own files, sandboxed', async () => {
    const site = await uploadSite('site-two.zip');

    const redirect = await inject({ method: 'GET', url: `/html/${site.slug}` });
    expect(redirect.statusCode).toBe(301);
    expect(redirect.headers.location).toBe(`/html/${site.slug}/`);

    const page = await inject({ method: 'GET', url: `/html/${site.slug}/` });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('hello slug');
    expect(page.headers['content-security-policy']).toContain('sandbox');

    const css = await inject({ method: 'GET', url: `/html/${site.slug}/css/app.css` });
    expect(css.statusCode).toBe(200);
    expect(css.body).toBe('body{color:red}');
  });

  it('does not serve hidden files or anything outside the site folder', async () => {
    const site = await uploadSite('site-three.zip');
    for (const rest of ['.ajda-extracted', '%2e%2e/%2e%2e/seed.txt', '../../x', 'css/../../x']) {
      const res = await inject({ method: 'GET', url: `/html/${site.slug}/${rest}` });
      // The URL parser may collapse `..` into a different path, which then redirects to its own
      // trailing-slash form (301). Whatever happens, no file content is served.
      const final = res.statusCode === 301 ? await inject({ method: 'GET', url: String(res.headers.location) }) : res;
      expect(final.statusCode, rest).toBe(404);
    }
  });

  it('refuses /html/<slug>/ for a file that is not an HTML page', async () => {
    const zip = buildZip([{ name: 'a.mp4', data: Buffer.from('video-bytes') }]);
    const { body } = await uploadChunked(token, 'one-clip.zip', zip, 'video');
    const video = (body.extracted ?? [])[0] as MediaRow;
    createdIds.push(video.id);
    expect((await inject({ method: 'GET', url: `/html/${video.slug}/` })).statusCode).toBe(404);
    expect((await inject({ method: 'GET', url: `/f/${video.slug}` })).statusCode).toBe(200);
  });

  it('lets an admin change the slug, keeps the new link working and breaks the old one', async () => {
    const site = await uploadSite('rename-me.zip');
    const oldSlug = site.slug;
    const newSlug = `villa-tour-${Date.now().toString(36)}`;

    const res = await authInject(token, { method: 'PATCH', url: `/api/media/${site.id}`, payload: { slug: newSlug } });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe(newSlug);

    expect((await inject({ method: 'GET', url: `/html/${newSlug}/` })).statusCode).toBe(200);
    expect((await inject({ method: 'GET', url: `/html/${oldSlug}/` })).statusCode).toBe(404);
  });

  it('rejects invalid, reserved and duplicate slugs', async () => {
    const a = await uploadSite('first.zip');
    const b = await uploadSite('second.zip');
    const patch = (id: string, slug: string) =>
      authInject(token, { method: 'PATCH', url: `/api/media/${id}`, payload: { slug } });

    for (const bad of ['ab', 'Has Space', 'under_score', '-lead', 'trail-', 'dou--ble', 'api', 'x'.repeat(81)]) {
      expect((await patch(a.id, bad)).statusCode, bad).toBe(400);
    }
    expect((await patch(a.id, b.slug as string)).statusCode).toBe(409);
    expect((await patch('00000000-0000-0000-0000-000000000000', 'free-slug-1')).statusCode).toBe(404);
  });

  it('requires a login to change a slug', async () => {
    const site = await uploadSite('private.zip');
    const res = await inject({ method: 'PATCH', url: `/api/media/${site.id}`, payload: { slug: 'sneaky-slug' } });
    expect(res.statusCode).toBe(401);
  });
});
