import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { injectCaptureScript } from '../src/routes/publicMedia.routes.js';
import { closeApp, getApp, inject, seedSession } from './helpers.js';
import { buildZip, uploadChunked } from './zip-helper.js';

let token: string;
const createdIds: string[] = [];
let entryPath: string; // `<folder>/site/index.html`, relative to /uploads/

beforeAll(async () => {
  await getApp();
  token = (await seedSession('admin@ajdaa.sa')).token;
  const zip = buildZip([
    { name: 'site/index.html', data: Buffer.from('<html><head><title>t</title></head><body>home</body></html>') },
    { name: 'site/prime/tour.html', data: Buffer.from('<html><body>tour</body></html>') },
    { name: 'site/css/app.css', data: Buffer.from('body{color:red}') },
    { name: 'site/.secret', data: Buffer.from('hidden') },
  ]);
  const { status, body } = await uploadChunked(token, 'preview-site.zip', zip, 'html');
  expect(status).toBe(201);
  const item = (body.extracted ?? [])[0] as { id: string; url: string };
  createdIds.push(item.id);
  entryPath = item.url.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/uploads\//, '');
});

afterAll(async () => {
  await prisma.mediaFile.deleteMany({ where: { id: { in: createdIds } } });
  await closeApp();
});

describe('injectCaptureScript', () => {
  it('goes right after <head>, or in front of a page without one', () => {
    const withHead = injectCaptureScript('<html><head><title>x</title></head></html>');
    expect(withHead.startsWith('<html><head><script>')).toBe(true);
    expect(withHead).toContain('ajda-capture-nav');
    expect(injectCaptureScript('<p>hi</p>').startsWith('<script>')).toBe(true);
  });
});

describe('GET /api/media/site-preview/*', () => {
  it('serves an HTML page with the capture script and a sandbox policy, no login needed', async () => {
    const res = await inject({ method: 'GET', url: `/api/media/site-preview/${entryPath}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('ajda-capture-nav');
    expect(res.body).toContain('home');
    expect(String(res.headers['content-security-policy'])).toContain('sandbox');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('serves a page in a sub folder and non-HTML files untouched', async () => {
    const dir = entryPath.replace(/index\.html$/, '');
    const tour = await inject({ method: 'GET', url: `/api/media/site-preview/${dir}prime/tour.html` });
    expect(tour.statusCode).toBe(200);
    expect(tour.body).toContain('tour');
    expect(tour.body).toContain('ajda-capture-nav');

    const css = await inject({ method: 'GET', url: `/api/media/site-preview/${dir}css/app.css` });
    expect(css.statusCode).toBe(200);
    expect(css.body).toBe('body{color:red}');
    expect(css.body).not.toContain('ajda-capture-nav');
  });

  it('serves index.html for a folder (redirecting to the trailing slash first)', async () => {
    const dir = entryPath.replace(/\/index\.html$/, '');
    const bare = await inject({ method: 'GET', url: `/api/media/site-preview/${dir}?x=1` });
    expect(bare.statusCode).toBe(301);
    expect(String(bare.headers.location)).toBe(`/api/media/site-preview/${dir}/?x=1`);

    const slash = await inject({ method: 'GET', url: `/api/media/site-preview/${dir}/` });
    expect(slash.statusCode).toBe(200);
    expect(slash.body).toContain('ajda-capture-nav');
  });

  it('rejects traversal, hidden files and missing files', async () => {
    const dir = entryPath.replace(/index\.html$/, '');
    for (const url of [
      '/api/media/site-preview/',
      `/api/media/site-preview/${dir}%2e%2e/%2e%2e/package.json`,
      `/api/media/site-preview/${dir}.secret`,
      `/api/media/site-preview/${dir}missing.html`,
      '/api/media/site-preview/..%5c..%5cetc',
    ]) {
      const res = await inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
    }
  });
});
