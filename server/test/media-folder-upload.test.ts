import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { buildZip, type Extracted } from './zip-helper.js';
import { authInject, buildMultipartBody, closeApp, getApp, seedSession } from './helpers.js';

/**
 * Uploads land in a library folder; a zip extraction gets one new folder named
 * after the zip. See task-libfolders-b.
 */

let token: string;

type FolderDto = { id: string; name: string; parentId: string | null; fileCount: number };

const createdFolderIds: string[] = [];
const createdMediaIds: string[] = [];

const chunkDir = path.join(config.uploadDir, '.chunks');
const sessionCount = () => fs.readdirSync(chunkDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;

async function createFolder(name: string, parentId?: string | null): Promise<FolderDto> {
  const res = await authInject(token, {
    method: 'POST',
    url: '/api/media/folders',
    payload: { name, parentId: parentId ?? null },
  });
  expect(res.statusCode).toBe(201);
  const dto = res.json() as FolderDto;
  createdFolderIds.push(dto.id);
  return dto;
}

beforeAll(async () => {
  await getApp();
  token = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await prisma.mediaFile.deleteMany({ where: { id: { in: createdMediaIds } } });
  // Leaves first (children before their parents) so the Restrict FK is never hit.
  for (let guard = 0; createdFolderIds.length > 0 && guard <= createdFolderIds.length + 1; guard++) {
    const rows = await prisma.mediaFolder.findMany({
      where: { id: { in: createdFolderIds } },
      select: { id: true, parentId: true },
    });
    const leaves = rows.filter((row) => !rows.some((other) => other.parentId === row.id));
    if (leaves.length === 0) break;
    for (const row of leaves) {
      await prisma.mediaFolder.delete({ where: { id: row.id } }).catch(() => {});
    }
  }
  await closeApp();
});

/** Full chunked upload with an optional target folder. */
async function uploadChunked(
  filename: string,
  file: Buffer,
  extract?: string,
  folderId?: string | null
): Promise<{ status: number; body: { extracted?: Extracted[]; error?: string; id?: string; folderId?: string | null } }> {
  const init = await authInject(token, {
    method: 'POST',
    url: '/api/media/upload/chunked/init',
    payload: { filename, totalSize: file.length, totalChunks: 1, ...(extract ? { extract } : {}), folderId },
  });
  if (init.statusCode !== 201) return { status: init.statusCode, body: init.json() };

  const { uploadId } = init.json() as { uploadId: string };
  const { payload, headers } = buildMultipartBody({
    filename: 'chunk0.bin',
    contentType: 'application/octet-stream',
    data: file,
  });
  const chunk = await authInject(token, {
    method: 'POST',
    url: `/api/media/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=0`,
    payload,
    headers,
  });
  expect(chunk.statusCode).toBe(200);

  const complete = await authInject(token, {
    method: 'POST',
    url: '/api/media/upload/chunked/complete',
    payload: { uploadId },
  });
  return { status: complete.statusCode, body: complete.json() };
}

function trackRows(body: { extracted?: Extracted[]; id?: string }) {
  if (body.extracted) createdMediaIds.push(...body.extracted.map((item) => item.id));
  if (body.id) createdMediaIds.push(body.id);
}

describe('chunked uploads into a library folder', () => {
  it('lands a normal chunked upload in the requested folder', async () => {
    const folder = await createFolder('video dailies');
    const data = Buffer.alloc(300 * 1024, 'v');

    const { status, body } = await uploadChunked('dailies.mp4', data, undefined, folder.id);
    expect(status).toBe(201);
    trackRows(body);
    expect(body.folderId).toBe(folder.id);

    const row = await prisma.mediaFile.findUnique({ where: { id: body.id! } });
    expect(row?.folderId).toBe(folder.id);

    // The folder listing counts it.
    const list = await authInject(token, { method: 'GET', url: '/api/media/folders' });
    const listed = (list.json() as { folders: FolderDto[] }).folders.find((f) => f.id === folder.id);
    expect(listed?.fileCount).toBe(1);
  });

  it('answers 404 for an unknown folder at init and creates no session', async () => {
    const sessionsBefore = sessionCount();
    const { status, body } = await uploadChunked('ghost.mp4', Buffer.alloc(300 * 1024), undefined, '00000000-0000-4000-8000-000000000000');
    expect(status).toBe(404);
    expect(body.error).toBe('Folder not found');
    expect(sessionCount()).toBe(sessionsBefore);
  });

  it('still uploads without a folderId exactly as before (library root)', async () => {
    const { status, body } = await uploadChunked('loose.mp4', Buffer.alloc(300 * 1024));
    expect(status).toBe(201);
    trackRows(body);
    const row = await prisma.mediaFile.findUnique({ where: { id: body.id! } });
    expect(row?.folderId).toBeNull();
  });
});

describe('zip extraction creates its own folder', () => {
  it('puts an html site into one folder named after the zip, inside the target folder', async () => {
    const parent = await createFolder('sites');
    const zip = buildZip([
      { name: 'site/index.html', data: Buffer.from('<html><body>brochure</body></html>') },
      { name: 'site/app.js', data: Buffer.from('console.log(1)') },
    ]);

    const { status, body } = await uploadChunked('spring-tower.zip', zip, 'html', parent.id);
    expect(status).toBe(201);
    trackRows(body);

    const items = body.extracted ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].fileType).toBe('html');
    expect(items[0].folderName).toBe('spring-tower');
    expect(items[0].folderId).toBeDefined();

    // The row really sits in the new folder, which itself sits in the parent.
    const row = await prisma.mediaFile.findUnique({ where: { id: items[0].id } });
    expect(row?.folderId).toBe(items[0].folderId);
    const folderRow = await prisma.mediaFolder.findUnique({ where: { id: items[0].folderId! } });
    expect(folderRow?.name).toBe('spring-tower');
    expect(folderRow?.parentId).toBe(parent.id);

    // The top-level response carries the folder as well.
    expect(body.folderId).toBe(items[0].folderId);
  });

  it('names the second extraction of the same zip `name (2)`', async () => {
    const zip = buildZip([{ name: 'page.html', data: Buffer.from('<html><body>x</body></html>') }]);

    const first = await uploadChunked('dup-site.zip', zip, 'html');
    expect(first.status).toBe(201);
    trackRows(first.body);
    expect((first.body.extracted ?? [])[0]?.folderName).toBe('dup-site');

    const second = await uploadChunked('dup-site.zip', zip, 'html');
    expect(second.status).toBe(201);
    trackRows(second.body);
    expect((second.body.extracted ?? [])[0]?.folderName).toBe('dup-site (2)');
  });

  it('leaves no folder and no row behind when a zip has no matching files', async () => {
    const foldersBefore = await prisma.mediaFolder.count();
    const filesBefore = await prisma.mediaFile.count();

    const zip = buildZip([{ name: 'readme.txt', data: Buffer.from('nothing to extract') }]);
    const { status, body } = await uploadChunked('empty-site.zip', zip, 'html');
    expect(status).toBe(400);
    expect(body.error).toMatch(/no .html page/i);

    expect(await prisma.mediaFolder.count()).toBe(foldersBefore);
    expect(await prisma.mediaFile.count()).toBe(filesBefore);
  });
});

describe('small multipart upload with ?folderId=', () => {
  // A real 1x1 PNG: the endpoint re-encodes it with sharp, so it must decode.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  async function uploadMultipart(folderId?: string) {
    const { payload, headers } = buildMultipartBody({
      filename: 'folder-upload.png',
      contentType: 'image/png',
      data: png,
    });
    return authInject(token, {
      method: 'POST',
      url: `/api/media/upload${folderId ? `?folderId=${folderId}` : ''}`,
      payload,
      headers,
    });
  }

  it('lands the upload in the folder, and 404s on an unknown folder', async () => {
    const folder = await createFolder('direct uploads');

    const ok = await uploadMultipart(folder.id);
    expect(ok.statusCode).toBe(201);
    const created = ok.json() as { id: string; folderId: string | null };
    createdMediaIds.push(created.id);
    expect(created.folderId).toBe(folder.id);
    expect((await prisma.mediaFile.findUnique({ where: { id: created.id } }))?.folderId).toBe(folder.id);

    const ghost = await uploadMultipart('00000000-0000-4000-8000-000000000000');
    expect(ghost.statusCode).toBe(404);
    expect((ghost.json() as { error: string }).error).toBe('Folder not found');

    const root = await uploadMultipart();
    expect(root.statusCode).toBe(201);
    const rootCreated = root.json() as { id: string; folderId: string | null };
    createdMediaIds.push(rootCreated.id);
    expect(rootCreated.folderId).toBeNull();
  });
});
