import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { buildZip, uploadChunked as uploadChunkedAs, type Extracted } from './zip-helper.js';
import { authInject, closeApp, getApp, inject, seedSession } from './helpers.js';

let token: string;
const uploadChunked = (filename: string, file: Buffer, extract?: string) => uploadChunkedAs(token, filename, file, extract);
const createdIds: string[] = [];


const folderOf = (url: string) => decodeURIComponent(url.split('/')[2]);
const folderExists = (url: string) => fs.existsSync(path.join(config.uploadDir, folderOf(url)));

beforeAll(async () => {
  await getApp();
  token = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await prisma.mediaFile.deleteMany({ where: { id: { in: createdIds } } });
  await closeApp();
});

describe('zip extraction into the media library', () => {
  it('lists every video of a zip and removes the folder with the last one', async () => {
    const zip = buildZip([
      { name: 'clips/a.mp4', data: Buffer.from('aaaa-video') },
      { name: 'clips/b.webm', data: Buffer.from('bbbb-video') },
      { name: 'notes.txt', data: Buffer.from('not a video') },
    ]);
    const { status, body } = await uploadChunked('clips.zip', zip, 'video');
    expect(status).toBe(201);
    const items = body.extracted ?? [];
    createdIds.push(...items.map((i) => i.id));
    expect(items.map((i) => i.originalName).sort()).toEqual(['a.mp4', 'b.webm']);
    expect(items.every((i) => i.fileType === 'video')).toBe(true);
    expect(folderExists(items[0].url)).toBe(true);

    const list = await authInject(token, { method: 'GET', url: '/api/media?type=video&limit=100' });
    const listed = (list.json() as { items: { id: string }[] }).items.map((i) => i.id);
    for (const item of items) expect(listed).toContain(item.id);

    // The zip itself is not kept.
    const zips = await prisma.mediaFile.count({ where: { originalName: 'clips.zip' } });
    expect(zips).toBe(0);

    const first = await authInject(token, { method: 'DELETE', url: `/api/media/${items[0].id}` });
    expect(first.statusCode).toBe(200);
    expect(folderExists(items[0].url)).toBe(true);
    const second = await authInject(token, { method: 'DELETE', url: `/api/media/${items[1].id}` });
    expect(second.statusCode).toBe(200);
    expect(folderExists(items[0].url)).toBe(false);
  });

  it('registers a website zip as one html entry and serves it sandboxed', async () => {
    const zip = buildZip([
      { name: 'site/index.html', data: Buffer.from('<html><body>hello</body></html>') },
      { name: 'site/app.js', data: Buffer.from('console.log(1)') },
      { name: 'site/img/logo.png', data: Buffer.from('not-really-a-png') },
    ]);
    const { status, body } = await uploadChunked('mysite.zip', zip, 'html');
    expect(status).toBe(201);
    const items = body.extracted ?? [];
    createdIds.push(...items.map((i) => i.id));
    expect(items).toHaveLength(1);
    expect(items[0].fileType).toBe('html');
    expect(items[0].url.endsWith('/site/index.html')).toBe(true);

    // The next library listing must not index the site's other files.
    const all = await authInject(token, { method: 'GET', url: '/api/media?type=all&limit=100&search=logo' });
    expect((all.json() as { total: number }).total).toBe(0);

    const page = await inject({ method: 'GET', url: items[0].url });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-security-policy']).toContain('sandbox');
    expect(page.headers['x-frame-options']).toBeUndefined();

    const del = await authInject(token, { method: 'DELETE', url: `/api/media/${items[0].id}` });
    expect(del.statusCode).toBe(200);
    expect(folderExists(items[0].url)).toBe(false);
  });

  it('extracts 3D models from a zip', async () => {
    const zip = buildZip([{ name: 'one.glb', data: Buffer.from('glTF-model-bytes') }]);
    const { status, body } = await uploadChunked('models.zip', zip, 'model3d');
    expect(status).toBe(201);
    const items = body.extracted ?? [];
    createdIds.push(...items.map((i) => i.id));
    expect(items).toHaveLength(1);
    expect(items[0].fileType).toBe('model3d');
    await authInject(token, { method: 'DELETE', url: `/api/media/${items[0].id}` });
  });

  it('rejects a zip-slip path and leaves nothing behind', async () => {
    const before = await prisma.mediaFile.count();
    const zip = buildZip([
      { name: '../evil.mp4', data: Buffer.from('x') },
      { name: 'ok.mp4', data: Buffer.from('y') },
    ]);
    const { status, body } = await uploadChunked('slip.zip', zip, 'video');
    expect(status).toBe(400);
    expect(body.error).toMatch(/unsafe path/i);
    expect(await prisma.mediaFile.count()).toBe(before);
    expect(fs.existsSync(path.join(config.uploadDir, '..', 'evil.mp4'))).toBe(false);
  });

  it('rejects a zip without files of the chosen kind', async () => {
    const zip = buildZip([{ name: 'readme.txt', data: Buffer.from('hello') }]);
    const { status, body } = await uploadChunked('none.zip', zip, 'video');
    expect(status).toBe(400);
    expect(body.error).toMatch(/no video files/i);
  });

  it('rejects the extract flag on a file that is not a zip', async () => {
    const { status } = await uploadChunked('video.mp4', Buffer.from('not a zip'), 'video');
    expect(status).toBe(400);
  });

  it('rejects a corrupt zip', async () => {
    const { status } = await uploadChunked('broken.zip', Buffer.from('PK-this-is-not-a-zip-file'), 'video');
    expect(status).toBe(400);
  });
});
