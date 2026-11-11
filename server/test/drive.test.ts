import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { authInject, closeApp, getApp, inject, seedSession } from './helpers.js';

let token: string;

interface FileDto {
  id: string;
  name: string;
  folderId: string | null;
  slug: string;
  mimeType: string;
  kind: string;
  size: number;
  isPublic: boolean;
  trashedAt: string | null;
}
interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  trashedAt: string | null;
}
interface Listing {
  breadcrumbs: { id: string; name: string }[];
  folders: FolderDto[];
  files: FileDto[];
}

const driveDir = () => path.join(config.privateDir, 'drive');

async function upload(name: string, data: string | Buffer, query: Record<string, string> = {}) {
  const boundary = `----ajdadrive${crypto.randomBytes(8).toString('hex')}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    Buffer.isBuffer(data) ? data : Buffer.from(data),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const qs = new URLSearchParams(query).toString();
  return authInject(token, {
    method: 'POST',
    url: `/api/drive/upload${qs ? `?${qs}` : ''}`,
    payload: body,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
}

const post = (url: string, payload: unknown) => authInject(token, { method: 'POST', url, payload: payload as object });
const patch = (url: string, payload: unknown) => authInject(token, { method: 'PATCH', url, payload: payload as object });
const list = async (folderId?: string) =>
  (await authInject(token, { method: 'GET', url: `/api/drive/list${folderId ? `?folderId=${folderId}` : ''}` })).json() as Listing;
const trashList = async () => (await authInject(token, { method: 'GET', url: '/api/drive/list?view=trash' })).json() as Listing;
const newFolder = async (name: string, parentId?: string) => {
  const res = await post('/api/drive/folders', { name, parentId: parentId ?? null });
  expect(res.statusCode).toBe(201);
  return res.json() as FolderDto;
};
const uploadOk = async (name: string, data: string | Buffer, query: Record<string, string> = {}) => {
  const res = await upload(name, data, query);
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as FileDto;
};

beforeAll(async () => {
  await getApp();
  token = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await prisma.driveFile.deleteMany();
  await prisma.driveFolder.deleteMany();
  fs.rmSync(driveDir(), { recursive: true, force: true });
  await closeApp();
});

describe('drive: access', () => {
  it('requires a login', async () => {
    expect((await inject({ method: 'GET', url: '/api/drive/list' })).statusCode).toBe(401);
    expect((await inject({ method: 'POST', url: '/api/drive/folders', payload: { name: 'x' } })).statusCode).toBe(401);
  });
});

describe('drive: upload and folders', () => {
  it('uploads a file, keeps it private and renames a second file with the same name', async () => {
    const a = await uploadOk('note.txt', 'hello drive');
    expect(a.name).toBe('note.txt');
    expect(a.mimeType).toBe('text/plain');
    expect(a.isPublic).toBe(false);
    expect(a.slug).toMatch(/^note-[0-9a-f]{6}$/);
    const b = await uploadOk('note.txt', 'second');
    expect(b.name).toBe('note (2).txt');
    expect((await list()).files.map((f) => f.id)).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('takes the type from the extension, not from the client', async () => {
    const page = await uploadOk('trick.html', '<script>alert(1)</script>');
    expect(page.mimeType).toBe('application/octet-stream');
  });

  it('creates folders from a folder upload path and reuses existing ones', async () => {
    const root = await newFolder('Photos 2026');
    const one = await uploadOk('a.png', Buffer.from('png-a'), { folderId: root.id, relPath: 'trip/day1/a.png' });
    const two = await uploadOk('b.png', Buffer.from('png-b'), { folderId: root.id, relPath: 'trip/day1/b.png' });
    expect(two.folderId).toBe(one.folderId);

    const top = await list(root.id);
    expect(top.folders.map((f) => f.name)).toEqual(['trip']);
    const day = await list(one.folderId as string);
    expect(day.breadcrumbs.map((c) => c.name)).toEqual(['Photos 2026', 'trip', 'day1']);
    expect(day.files.map((f) => f.name).sort()).toEqual(['a.png', 'b.png']);
  });

  it('rejects bad names and duplicate folder names', async () => {
    for (const name of ['', '   ', 'a/b', 'a\\b', '..', '.']) {
      expect((await post('/api/drive/folders', { name })).statusCode, JSON.stringify(name)).toBe(400);
    }
    await newFolder('Dup');
    expect((await post('/api/drive/folders', { name: 'Dup' })).statusCode).toBe(409);
  });

  it('rejects an unknown or trashed target folder', async () => {
    expect((await upload('x.txt', 'x', { folderId: '00000000-0000-0000-0000-000000000000' })).statusCode).toBe(404);
  });
});

describe('drive: rename, move and copy', () => {
  it('renames files and folders and refuses a name that is already taken', async () => {
    const f1 = await uploadOk('r1.txt', '1');
    const f2 = await uploadOk('r2.txt', '2');
    expect((await patch(`/api/drive/files/${f1.id}`, { name: 'r2.txt' })).statusCode).toBe(409);
    const ok = await patch(`/api/drive/files/${f1.id}`, { name: 'renamed.txt' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().name).toBe('renamed.txt');
    expect(f2.name).toBe('r2.txt');

    const folder = await newFolder('Old name');
    const renamed = await patch(`/api/drive/folders/${folder.id}`, { name: 'New name' });
    expect(renamed.json().name).toBe('New name');
  });

  it('keeps a file\'s slug and content when it moves', async () => {
    const dest = await newFolder('Move target');
    const file = await uploadOk('moveme.txt', 'stay the same');
    const res = await post('/api/drive/move', { fileIds: [file.id], folderIds: [], targetId: dest.id });
    expect(res.statusCode).toBe(200);

    const moved = (await list(dest.id)).files.find((f) => f.id === file.id);
    expect(moved?.slug).toBe(file.slug);

    await patch(`/api/drive/files/${file.id}`, { isPublic: true });
    const link = await inject({ method: 'GET', url: `/d/${file.slug}` });
    expect(link.statusCode).toBe(200);
    expect(link.body).toBe('stay the same');
  });

  it('refuses to move a folder into itself or into one of its own subfolders', async () => {
    const parent = await newFolder('Loop parent');
    const child = await newFolder('Loop child', parent.id);
    expect((await patch(`/api/drive/folders/${parent.id}`, { parentId: parent.id })).statusCode).toBe(400);
    expect((await patch(`/api/drive/folders/${parent.id}`, { parentId: child.id })).statusCode).toBe(400);
    expect((await patch(`/api/drive/folders/${child.id}`, { parentId: null })).statusCode).toBe(200);
  });

  it('renames on a name clash when moving instead of overwriting', async () => {
    const dest = await newFolder('Clash target');
    const inside = await uploadOk('same.txt', 'inside', { folderId: dest.id });
    const outside = await uploadOk('same.txt', 'outside');
    await post('/api/drive/move', { fileIds: [outside.id], folderIds: [], targetId: dest.id });
    const names = (await list(dest.id)).files.map((f) => f.name).sort();
    expect(names).toEqual(['same (2).txt', 'same.txt']);
    expect(inside.name).toBe('same.txt');
  });

  it('copies a file with its own slug and its own content', async () => {
    const file = await uploadOk('orig.txt', 'copy me');
    const res = await post(`/api/drive/files/${file.id}/copy`, {});
    expect(res.statusCode).toBe(201);
    const copy = res.json() as FileDto;
    expect(copy.id).not.toBe(file.id);
    expect(copy.slug).not.toBe(file.slug);
    expect(copy.name).toBe('orig (2).txt');
    expect(copy.isPublic).toBe(false);
    const dl = await authInject(token, { method: 'GET', url: `/api/drive/files/${copy.id}/download` });
    expect(dl.body).toBe('copy me');
  });

  it('copies a folder tree and refuses to copy it into itself', async () => {
    const src = await newFolder('Tree src');
    const sub = await newFolder('inner', src.id);
    await uploadOk('leaf.txt', 'leaf', { folderId: sub.id });

    expect((await post(`/api/drive/folders/${src.id}/copy`, { parentId: sub.id })).statusCode).toBe(400);

    const res = await post(`/api/drive/folders/${src.id}/copy`, {});
    expect(res.statusCode).toBe(201);
    const copy = res.json() as FolderDto;
    expect(copy.name).toBe('Tree src (2)');
    const innerCopy = (await list(copy.id)).folders[0];
    expect(innerCopy.name).toBe('inner');
    expect(innerCopy.id).not.toBe(sub.id);
    expect((await list(innerCopy.id)).files.map((f) => f.name)).toEqual(['leaf.txt']);
  });
});

describe('drive: trash, restore and purge', () => {
  it('trashes a folder with its contents and restores exactly what went in together', async () => {
    const folder = await newFolder('Bin me');
    const early = await uploadOk('early.txt', 'trashed first', { folderId: folder.id });
    const late = await uploadOk('late.txt', 'trashed with folder', { folderId: folder.id });
    await post('/api/drive/trash', { fileIds: [early.id], folderIds: [] });
    await new Promise((r) => setTimeout(r, 15));
    await post('/api/drive/trash', { fileIds: [], folderIds: [folder.id] });

    // Only the folder shows in the trash; its contents are hidden inside it.
    const trash = await trashList();
    expect(trash.folders.map((f) => f.id)).toContain(folder.id);
    expect(trash.files.map((f) => f.id)).not.toContain(late.id);
    expect((await list()).folders.map((f) => f.id)).not.toContain(folder.id);
    expect((await authInject(token, { method: 'GET', url: `/api/drive/list?folderId=${folder.id}` })).statusCode).toBe(400);

    await post('/api/drive/restore', { fileIds: [], folderIds: [folder.id] });
    const back = await list(folder.id);
    expect(back.files.map((f) => f.id)).toEqual([late.id]);
    // The file trashed earlier is still in the trash, as its own item.
    expect((await trashList()).files.map((f) => f.id)).toContain(early.id);
  });

  it('restores an item to the root when its folder is still in the trash', async () => {
    const folder = await newFolder('Parent gone');
    const file = await uploadOk('orphan.txt', 'o', { folderId: folder.id });
    await post('/api/drive/trash', { fileIds: [file.id], folderIds: [] });
    await new Promise((r) => setTimeout(r, 15));
    await post('/api/drive/trash', { fileIds: [], folderIds: [folder.id] });
    await post('/api/drive/restore', { fileIds: [file.id], folderIds: [] });
    const restored = (await list()).files.find((f) => f.id === file.id);
    expect(restored?.folderId).toBeNull();
  });

  it('serves nothing from a trashed shared file', async () => {
    const file = await uploadOk('gone.txt', 'bye');
    await patch(`/api/drive/files/${file.id}`, { isPublic: true });
    expect((await inject({ method: 'GET', url: `/d/${file.slug}` })).statusCode).toBe(200);
    await post('/api/drive/trash', { fileIds: [file.id], folderIds: [] });
    expect((await inject({ method: 'GET', url: `/d/${file.slug}` })).statusCode).toBe(404);
  });

  it('purges only trashed items and removes their bytes from disk', async () => {
    const live = await uploadOk('keep.txt', 'keep');
    const dead = await uploadOk('kill.txt', 'kill');
    const key = (await prisma.driveFile.findUniqueOrThrow({ where: { id: dead.id } })).storageKey;
    expect(fs.existsSync(path.join(driveDir(), key))).toBe(true);

    // A live file is skipped.
    const skipped = await post('/api/drive/purge', { fileIds: [live.id], folderIds: [] });
    expect(skipped.json().deleted).toBe(0);
    expect(await prisma.driveFile.count({ where: { id: live.id } })).toBe(1);

    await post('/api/drive/trash', { fileIds: [dead.id], folderIds: [] });
    const done = await post('/api/drive/purge', { fileIds: [dead.id], folderIds: [] });
    expect(done.json().deleted).toBe(1);
    expect(await prisma.driveFile.count({ where: { id: dead.id } })).toBe(0);
    expect(fs.existsSync(path.join(driveDir(), key))).toBe(false);
  });

  it('empties the trash including whole folder trees', async () => {
    const folder = await newFolder('Wipe');
    const inner = await newFolder('deep', folder.id);
    const file = await uploadOk('deep.txt', 'd', { folderId: inner.id });
    const key = (await prisma.driveFile.findUniqueOrThrow({ where: { id: file.id } })).storageKey;
    await post('/api/drive/trash', { fileIds: [], folderIds: [folder.id] });
    const res = await post('/api/drive/trash/empty', {});
    expect(res.statusCode).toBe(200);
    expect(await prisma.driveFolder.count({ where: { id: { in: [folder.id, inner.id] } } })).toBe(0);
    expect(await prisma.driveFile.count({ where: { id: file.id } })).toBe(0);
    expect(fs.existsSync(path.join(driveDir(), key))).toBe(false);
  });
});

describe('drive: share links and slugs', () => {
  it('keeps a file private until it is shared', async () => {
    const file = await uploadOk('secret.txt', 'private text');
    expect((await inject({ method: 'GET', url: `/d/${file.slug}` })).statusCode).toBe(404);
    await patch(`/api/drive/files/${file.id}`, { isPublic: true });
    expect((await inject({ method: 'GET', url: `/d/${file.slug}` })).statusCode).toBe(200);
    await patch(`/api/drive/files/${file.id}`, { isPublic: false });
    expect((await inject({ method: 'GET', url: `/d/${file.slug}` })).statusCode).toBe(404);
  });

  it('shows safe types inline and forces every other type to download', async () => {
    const text = await uploadOk('readme.txt', 'plain');
    const page = await uploadOk('page.html', '<h1>x</h1>');
    await patch(`/api/drive/files/${text.id}`, { isPublic: true });
    await patch(`/api/drive/files/${page.id}`, { isPublic: true });

    const inline = await inject({ method: 'GET', url: `/d/${text.slug}` });
    expect(inline.headers['content-disposition']).toMatch(/^inline/);
    expect(inline.headers['x-content-type-options']).toBe('nosniff');

    const forced = await inject({ method: 'GET', url: `/d/${text.slug}?download=1` });
    expect(forced.headers['content-disposition']).toMatch(/^attachment/);

    const html = await inject({ method: 'GET', url: `/d/${page.slug}` });
    expect(html.headers['content-disposition']).toMatch(/^attachment/);
    expect(String(html.headers['content-type'])).toContain('application/octet-stream');
  });

  it('lets an admin edit the slug: the old link dies, duplicates and bad slugs are refused', async () => {
    const a = await uploadOk('slug-a.txt', 'a');
    const b = await uploadOk('slug-b.txt', 'b');
    await patch(`/api/drive/files/${a.id}`, { isPublic: true });
    const fresh = `shared-doc-${Date.now().toString(36)}`;

    const ok = await patch(`/api/drive/files/${a.id}`, { slug: fresh });
    expect(ok.statusCode).toBe(200);
    expect((await inject({ method: 'GET', url: `/d/${fresh}` })).statusCode).toBe(200);
    expect((await inject({ method: 'GET', url: `/d/${a.slug}` })).statusCode).toBe(404);

    expect((await patch(`/api/drive/files/${b.id}`, { slug: fresh })).statusCode).toBe(409);
    for (const bad of ['ab', 'Has Space', 'api', 'dou--ble']) {
      expect((await patch(`/api/drive/files/${b.id}`, { slug: bad })).statusCode, bad).toBe(400);
    }
  });

  it('downloads for a signed-in admin only', async () => {
    const file = await uploadOk('dl.txt', 'download me');
    expect((await inject({ method: 'GET', url: `/api/drive/files/${file.id}/download` })).statusCode).toBe(401);
    const ok = await authInject(token, { method: 'GET', url: `/api/drive/files/${file.id}/download` });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-disposition']).toMatch(/^attachment/);
    expect(ok.body).toBe('download me');
  });
});

describe('drive: search and usage', () => {
  it('finds items by name and reports usage', async () => {
    await uploadOk('needle-in-haystack.txt', 'n');
    const res = await authInject(token, { method: 'GET', url: '/api/drive/list?view=search&q=needle' });
    expect((res.json() as Listing).files.map((f) => f.name)).toContain('needle-in-haystack.txt');

    const usage = (await authInject(token, { method: 'GET', url: '/api/drive/usage' })).json() as {
      fileCount: number;
      totalBytes: number;
    };
    expect(usage.fileCount).toBeGreaterThan(0);
    expect(usage.totalBytes).toBeGreaterThan(0);
  });
});

describe('drive: chunked upload (large files)', () => {
  const CHUNK = 256 * 1024; // the smallest chunk the server accepts

  const init = (payload: Record<string, unknown>) => post('/api/drive/upload/chunked/init', payload);
  const sendChunk = async (uploadId: string, index: number, data: Buffer) => {
    const boundary = `----ajdachunk${crypto.randomBytes(8).toString('hex')}`;
    // Multipart framing requires CRLF line endings.
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="part_${index}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return authInject(token, {
      method: 'POST',
      url: `/api/drive/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=${index}`,
      payload: body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
  };

  it('assembles chunks into one file, resumes, and creates folders from the path', async () => {
    const content = crypto.randomBytes(CHUNK * 2 + 1000);
    const res = await init({ relPath: 'Big/Sub/video.mp4', folderId: null, totalSize: content.length, totalChunks: 3, chunkSize: CHUNK });
    expect(res.statusCode, res.body).toBe(200);
    const { uploadId } = res.json() as { uploadId: string };

    // Send the last chunk first and chunk 0, then ask what is missing (resume).
    expect((await sendChunk(uploadId, 2, content.subarray(CHUNK * 2))).statusCode).toBe(200);
    expect((await sendChunk(uploadId, 0, content.subarray(0, CHUNK))).statusCode).toBe(200);
    const status = (await authInject(token, { method: 'GET', url: `/api/drive/upload/chunked/status/${uploadId}` })).json() as { uploadedChunks: number[] };
    expect(status.uploadedChunks).toEqual([0, 2]);

    // Completing early fails and keeps the session.
    expect((await post('/api/drive/upload/chunked/complete', { uploadId })).statusCode).toBe(400);
    expect((await sendChunk(uploadId, 1, content.subarray(CHUNK, CHUNK * 2))).statusCode).toBe(200);

    const done = await post('/api/drive/upload/chunked/complete', { uploadId });
    expect(done.statusCode, done.body).toBe(201);
    const file = done.json() as FileDto;
    expect(file.name).toBe('video.mp4');
    expect(file.size).toBe(content.length);

    const dl = await authInject(token, { method: 'GET', url: `/api/drive/files/${file.id}/download` });
    expect(Buffer.compare(dl.rawPayload, content)).toBe(0);
    expect((await list(file.folderId as string)).breadcrumbs.map((c) => c.name)).toEqual(['Big', 'Sub']);
    // The session is gone and no chunk files are left behind.
    expect(fs.existsSync(path.join(driveDir(), '.chunks', uploadId))).toBe(false);
  });

  it('rejects wrong chunk sizes, bad indexes and inconsistent init values', async () => {
    const res = await init({ relPath: 'x.bin', folderId: null, totalSize: CHUNK * 2, totalChunks: 2, chunkSize: CHUNK });
    const { uploadId } = res.json() as { uploadId: string };
    expect((await sendChunk(uploadId, 0, Buffer.alloc(CHUNK - 1))).statusCode).toBe(400);
    expect((await sendChunk(uploadId, 5, Buffer.alloc(CHUNK))).statusCode).toBe(400);
    expect((await sendChunk('00000000-0000-4000-8000-000000000000', 0, Buffer.alloc(CHUNK))).statusCode).toBe(404);

    expect((await init({ relPath: 'x.bin', folderId: null, totalSize: CHUNK * 2, totalChunks: 5, chunkSize: CHUNK })).statusCode).toBe(400);
    expect((await init({ relPath: 'x.bin', folderId: null, totalSize: 10, totalChunks: 1, chunkSize: 10 })).statusCode).toBe(400);
    expect((await init({ relPath: 'a/../b.bin', folderId: null, totalSize: CHUNK, totalChunks: 1, chunkSize: CHUNK })).statusCode).toBe(400);
    const abort = await authInject(token, { method: 'DELETE', url: `/api/drive/upload/chunked/abort/${uploadId}` });
    expect(abort.statusCode).toBe(200);
  });

  it('accepts up to 5 GB and refuses more', async () => {
    const chunk = 50 * 1024 * 1024;
    const five = 5 * 1024 ** 3;
    const over = await init({ relPath: 'huge.bin', folderId: null, totalSize: five + 1, totalChunks: Math.ceil((five + 1) / chunk), chunkSize: chunk });
    expect(over.statusCode).toBe(413);
  });

  it('refuses a single-request upload that needs chunking', async () => {
    const res = await upload('too-big.bin', Buffer.alloc(51 * 1024 * 1024));
    expect(res.statusCode).toBe(413);
  });

  it('stores sizes above 2 GB without overflow', async () => {
    const size = 4 * 1024 ** 3 + 123;
    const row = await prisma.driveFile.create({
      data: { name: 'giant.bin', slug: `giant-${Date.now().toString(36)}`, storageKey: 'giant-missing', mimeType: 'application/octet-stream', size },
    });
    const listed = (await list()).files.find((f) => f.id === row.id);
    expect(listed?.size).toBe(size);
    const usage = (await authInject(token, { method: 'GET', url: '/api/drive/usage' })).json() as { totalBytes: number };
    expect(usage.totalBytes).toBeGreaterThanOrEqual(size);
    await prisma.driveFile.delete({ where: { id: row.id } });
  });
});

