import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { discardPendingMedia, sweepStalePendingMedia } from '../src/services/mediaService.js';
import { buildZip } from './zip-helper.js';
import {
  authInject,
  buildMultipartBody,
  closeApp,
  createThrowawayUser,
  getApp,
  login,
  seedSession,
  THROWAWAY_PASSWORD,
} from './helpers.js';

/**
 * Staged (picker) uploads: rows created with the staging switch carry
 * pending = true, stay hidden from the Library, and only join it when the
 * uploading admin confirms them; discard deletes row and disk file. See
 * task-stage-a.
 */

// A real 1x1 PNG: the endpoint re-encodes it with sharp, so it must decode.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let token: string;
let otherToken: string;
let otherAdminId: string;
let stagedFileId = '';

const createdMediaIds: string[] = [];
const createdFolderIds: string[] = [];

type UploadResult = { status: number; body: { id?: string; pending?: boolean; error?: string; storageKey?: string } };

async function uploadStaged(filename: string, staged: boolean): Promise<UploadResult> {
  const { payload, headers } = buildMultipartBody({ filename, contentType: 'image/png', data: PNG });
  const res = await authInject(token, {
    method: 'POST',
    url: `/api/media/upload${staged ? '?staged=1' : ''}`,
    payload,
    headers,
  });
  return { status: res.statusCode, body: res.json() };
}

type ListBody = { items: Array<{ id: string; pending?: boolean }>; total: number };

async function list(query: string, withToken: string = token): Promise<ListBody> {
  const res = await authInject(withToken, { method: 'GET', url: `/api/media?${query}` });
  expect(res.statusCode).toBe(200);
  return res.json() as ListBody;
}

async function confirm(fileIds: string[], folderIds: string[] = [], withToken: string = token) {
  const res = await authInject(withToken, {
    method: 'POST',
    url: '/api/media/staged/confirm',
    payload: { fileIds, folderIds },
  });
  return { status: res.statusCode, body: res.json() as { confirmed?: number; error?: string } };
}

async function discard(fileIds: string[], folderIds: string[] = [], withToken: string = token) {
  const res = await authInject(withToken, {
    method: 'POST',
    url: '/api/media/staged/discard',
    payload: { fileIds, folderIds },
  });
  return { status: res.statusCode, body: res.json() as { discarded?: number; error?: string } };
}

async function uploadChunkedStaged(filename: string, file: Buffer, extract: string, staged: boolean) {
  const init = await authInject(token, {
    method: 'POST',
    url: '/api/media/upload/chunked/init',
    payload: {
      filename,
      totalSize: file.length,
      totalChunks: 1,
      extract,
      ...(staged ? { staged: true } : {}),
    },
  });
  expect(init.statusCode).toBe(201);
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

beforeAll(async () => {
  await getApp();
  token = (await seedSession('admin@ajdaa.sa')).token;
  const other = await createThrowawayUser({ permissions: { manageMedia: true } });
  otherAdminId = other.id;
  otherToken = (await login(other.email, THROWAWAY_PASSWORD)).token;
});

afterAll(async () => {
  await prisma.mediaFile.deleteMany({ where: { id: { in: createdMediaIds } } });
  if (createdFolderIds.length > 0) {
    await prisma.mediaFolder.deleteMany({ where: { id: { in: createdFolderIds } } }).catch(() => {});
  }
  await prisma.adminUser.deleteMany({ where: { id: otherAdminId } });
  await closeApp();
});

describe('staged uploads stay hidden until confirmed', () => {
  it('keeps a default (non-staged) upload visible exactly as before', async () => {
    const name = `visible-right-away-${Date.now()}.png`;
    const { status, body } = await uploadStaged(name, false);
    expect(status).toBe(201);
    expect(body.pending).toBe(false);
    createdMediaIds.push(body.id!);

    const listed = await list(`limit=100&search=${name}`);
    expect(listed.items.some((item) => item.id === body.id)).toBe(true);
  });

  it('hides a staged upload from the Library and shows it only to its owner with includePending=mine', async () => {
    const name = `staged-hidden-${Date.now()}.png`;
    const { status, body } = await uploadStaged(name, true);
    expect(status).toBe(201);
    expect(body.pending).toBe(true);
    createdMediaIds.push(body.id!);
    stagedFileId = body.id!;

    // The Library does not list it.
    expect((await list(`limit=100&search=${name}`)).items).toHaveLength(0);
    // The owner sees it in the picker through includePending=mine.
    const mine = await list(`limit=100&search=${name}&includePending=mine`);
    expect(mine.items.map((item) => item.id)).toEqual([body.id]);
    expect(mine.items[0].pending).toBe(true);
    // Another admin does not see someone else's staged rows.
    const theirs = await list(`limit=100&search=${name}&includePending=mine`, otherToken);
    expect(theirs.items).toHaveLength(0);
  });

  it('confirm makes the staged file visible and stays idempotent', async () => {
    expect(stagedFileId).toBeTruthy();

    // Another admin cannot confirm someone else's staged row.
    const foreign = await confirm([stagedFileId], [], otherToken);
    expect(foreign.body.confirmed).toBe(0);
    expect((await prisma.mediaFile.findUnique({ where: { id: stagedFileId } }))?.pending).toBe(true);

    const first = await confirm([stagedFileId]);
    expect(first.status).toBe(200);
    expect(first.body.confirmed).toBe(1);
    expect((await prisma.mediaFile.findUnique({ where: { id: stagedFileId } }))?.pending).toBe(false);

    // Now visible in the plain Library list again.
    const row = await prisma.mediaFile.findUnique({ where: { id: stagedFileId } });
    const listed = await list(`limit=100&search=${row?.originalName}`);
    expect(listed.items.some((item) => item.id === stagedFileId)).toBe(true);

    // Confirming again (or a non-pending id) changes nothing.
    const again = await confirm([stagedFileId]);
    expect(again.body.confirmed).toBe(0);
  });

  it('discard removes the row and the disk file, and ignores foreign or non-pending ids', async () => {
    const name = `staged-discard-${Date.now()}.png`;
    const { status, body } = await uploadStaged(name, true);
    expect(status).toBe(201);
    createdMediaIds.push(body.id!);
    const row = await prisma.mediaFile.findUnique({ where: { id: body.id! } });
    expect(row?.pending).toBe(true);
    const diskPath = path.join(config.uploadDir, row!.storageKey);
    expect(fs.existsSync(diskPath)).toBe(true);

    // Another admin cannot discard it.
    const foreign = await discard([body.id!], [], otherToken);
    expect(foreign.body.discarded).toBe(0);
    expect(await prisma.mediaFile.findUnique({ where: { id: body.id! } })).not.toBeNull();

    // A non-pending (already visible) id is refused by discardPendingMedia.
    const visible = await uploadStaged(`already-visible-${Date.now()}.png`, false);
    expect(visible.status).toBe(201);
    createdMediaIds.push(visible.body.id!);
    const mixed = await discard([visible.body.id!]);
    expect(mixed.body.discarded).toBe(0);
    expect(await prisma.mediaFile.findUnique({ where: { id: visible.body.id! } })).not.toBeNull();

    const own = await discard([body.id!]);
    expect(own.body.discarded).toBe(1);
    expect(await prisma.mediaFile.findUnique({ where: { id: body.id! } })).toBeNull();
    expect(fs.existsSync(diskPath)).toBe(false);

    // Idempotent: a second discard finds nothing owned and pending any more.
    const repeat = await discard([body.id!]);
    expect(repeat.body.discarded).toBe(0);
  });

  it('hides a staged zip extraction (files and folder) until both are confirmed', async () => {
    const zip = buildZip([
      { name: 'site/index.html', data: Buffer.from('<html><body>staged site</body></html>') },
      { name: 'site/app.js', data: Buffer.from('console.log(1)') },
    ]);
    const { status, body } = await uploadChunkedStaged(`staged-site-${Date.now()}.zip`, zip, 'html', true);
    expect(status).toBe(201);

    const items = body.extracted ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].pending).toBe(true);
    expect(body.pending).toBe(true);
    const folderId = items[0].folderId!;
    createdMediaIds.push(items[0].id);
    createdFolderIds.push(folderId);

    // Neither the file nor the folder appears in the Library.
    expect((await list(`limit=100&search=${items[0].originalName}`)).items).toHaveLength(0);
    const foldersRes = await authInject(token, { method: 'GET', url: '/api/media/folders' });
    const folders = (foldersRes.json() as { folders: Array<{ id: string }> }).folders;
    expect(folders.some((folder) => folder.id === folderId)).toBe(false);

    // The owner sees the extracted item in the picker list.
    const mine = await list(`limit=100&search=${items[0].originalName}&includePending=mine`);
    expect(mine.items.map((item) => item.id)).toEqual([items[0].id]);

    // Confirming file and folder together makes both visible.
    const confirmed = await confirm([items[0].id], [folderId]);
    expect(confirmed.body.confirmed).toBe(1);
    const foldersAfter = await authInject(token, { method: 'GET', url: '/api/media/folders' });
    const visibleFolders = (foldersAfter.json() as { folders: Array<{ id: string }> }).folders;
    expect(visibleFolders.some((folder) => folder.id === folderId)).toBe(true);
    expect((await list(`limit=100&search=${items[0].originalName}`)).items.some((item) => item.id === items[0].id)).toBe(true);
  });

  it('discards the pending folder of a staged extraction with its files', async () => {
    const zip = buildZip([{ name: 'one.glb', data: Buffer.from('glTF-staged-bytes') }]);
    const { status, body } = await uploadChunkedStaged(`staged-model-${Date.now()}.zip`, zip, 'model3d', true);
    expect(status).toBe(201);
    const items = body.extracted ?? [];
    expect(items).toHaveLength(1);
    const folderId = items[0].folderId!;
    createdFolderIds.push(folderId);

    const discarded = await discard([items[0].id], [folderId]);
    expect(discarded.body.discarded).toBe(1);
    expect(await prisma.mediaFile.findUnique({ where: { id: items[0].id } })).toBeNull();
    expect(await prisma.mediaFolder.findUnique({ where: { id: folderId } })).toBeNull();

    // The disk bundle folder of the extraction is gone with its last file.
    const bundle = decodeURIComponent(items[0].url.split('/')[2]);
    expect(fs.existsSync(path.join(config.uploadDir, bundle))).toBe(false);
  });
});

describe('sweepStalePendingMedia', () => {
  it('removes an old pending row (and empty old pending folder) and keeps a fresh one and a non-pending old one', async () => {
    const old = new Date(Date.now() - 25 * 3600 * 1000);
    const oldPending = await prisma.mediaFile.create({
      data: {
        url: `/uploads/sweep-old-pending-${Date.now()}.webp`,
        filename: 'sweep-old-pending.webp',
        originalName: 'sweep-old-pending.webp',
        mimeType: 'image/webp',
        fileType: 'image',
        size: 10,
        storageKey: 'sweep-old-pending.webp',
        pending: true,
        createdAt: old,
      },
    });
    const freshPending = await prisma.mediaFile.create({
      data: {
        url: `/uploads/sweep-fresh-pending-${Date.now()}.webp`,
        filename: 'sweep-fresh-pending.webp',
        originalName: 'sweep-fresh-pending.webp',
        mimeType: 'image/webp',
        fileType: 'image',
        size: 10,
        storageKey: 'sweep-fresh-pending.webp',
        pending: true,
      },
    });
    const oldVisible = await prisma.mediaFile.create({
      data: {
        url: `/uploads/sweep-old-visible-${Date.now()}.webp`,
        filename: 'sweep-old-visible.webp',
        originalName: 'sweep-old-visible.webp',
        mimeType: 'image/webp',
        fileType: 'image',
        size: 10,
        storageKey: 'sweep-old-visible.webp',
        pending: false,
        createdAt: old,
      },
    });

    const oldFolder = await prisma.mediaFolder.create({
      data: { name: `sweep-old-folder-${Date.now()}`, pending: true, createdAt: old },
    });
    const freshFolder = await prisma.mediaFolder.create({
      data: { name: `sweep-fresh-folder-${Date.now()}`, pending: true },
    });

    try {
      await sweepStalePendingMedia();

      expect(await prisma.mediaFile.findUnique({ where: { id: oldPending.id } })).toBeNull();
      expect(await prisma.mediaFile.findUnique({ where: { id: freshPending.id } })).not.toBeNull();
      expect(await prisma.mediaFile.findUnique({ where: { id: oldVisible.id } })).not.toBeNull();
      expect(await prisma.mediaFolder.findUnique({ where: { id: oldFolder.id } })).toBeNull();
      expect(await prisma.mediaFolder.findUnique({ where: { id: freshFolder.id } })).not.toBeNull();
    } finally {
      await prisma.mediaFile.deleteMany({ where: { id: { in: [oldPending.id, freshPending.id, oldVisible.id] } } });
      await prisma.mediaFolder.deleteMany({ where: { id: { in: [oldFolder.id, freshFolder.id] } } }).catch(() => {});
    }
  });

  it('refuses to discard a visible file through the pending path', async () => {
    const name = `visible-guard-${Date.now()}.png`;
    const { body } = await uploadStaged(name, false);
    createdMediaIds.push(body.id!);
    await expect(discardPendingMedia(body.id!)).rejects.toThrow(/not pending/i);
    expect(await prisma.mediaFile.findUnique({ where: { id: body.id! } })).not.toBeNull();
  });
});
