import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { acquireZipSlot, createZipTicket, releaseZipSlot } from '../src/services/driveZipService.js';
import { authInject, closeApp, getApp, inject, seedSession, sleep } from './helpers.js';

let token: string;
const driveDir = () => path.join(config.privateDir, 'drive');
const tag = crypto.randomBytes(3).toString('hex');
const unique = (name: string) => `${name}-${tag}`;

interface FileDto { id: string; name: string; folderId: string | null; storageKey?: string }
interface FolderDto { id: string; name: string }

async function upload(name: string, data: string | Buffer, query: Record<string, string> = {}) {
  const boundary = `----ajdazip${crypto.randomBytes(8).toString('hex')}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    Buffer.isBuffer(data) ? data : Buffer.from(data),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const qs = new URLSearchParams(query).toString();
  const res = await authInject(token, {
    method: 'POST',
    url: `/api/drive/upload${qs ? `?${qs}` : ''}`,
    payload: body,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as FileDto;
}

const post = (url: string, payload: unknown) => authInject(token, { method: 'POST', url, payload: payload as object });
const newFolder = async (name: string, parentId?: string) => {
  const res = await post('/api/drive/folders', { name, parentId: parentId ?? null });
  expect(res.statusCode).toBe(201);
  return res.json() as FolderDto;
};

/** Reads a zip with stored or deflated entries into name -> bytes (directories map to an empty buffer). */
function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd).toBeGreaterThan(-1);
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    out.set(name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const getZip = (url: string) => inject({ method: 'GET', url }); // no Authorization header on purpose
async function ticketFor(payload: object): Promise<string> {
  const res = await post('/api/drive/zip/ticket', payload);
  expect(res.statusCode, res.body).toBe(200);
  const { url } = res.json() as { url: string };
  expect(url).toMatch(/^\/api\/drive\/zip\/[0-9a-f]{48}$/);
  return url;
}

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

describe('drive zip: tickets', () => {
  it('needs a login, a non-empty selection and live items', async () => {
    expect((await inject({ method: 'POST', url: '/api/drive/zip/ticket', payload: { folderIds: [], fileIds: [] } })).statusCode).toBe(401);
    expect((await post('/api/drive/zip/ticket', { folderIds: [], fileIds: [] })).statusCode).toBe(400);
    expect((await post('/api/drive/zip/ticket', { folderIds: ['00000000-0000-0000-0000-000000000000'], fileIds: [] })).statusCode).toBe(404);

    const file = await upload(`${unique('gone')}.txt`, 'bye');
    expect((await post('/api/drive/trash', { folderIds: [], fileIds: [file.id] })).statusCode).toBe(200);
    expect((await post('/api/drive/zip/ticket', { folderIds: [], fileIds: [file.id] })).statusCode).toBe(404);
  });

  it('a ticket works once and then answers 404', async () => {
    const file = await upload(`${unique('once')}.txt`, 'once');
    const url = await ticketFor({ folderIds: [], fileIds: [file.id] });
    const first = await getZip(url);
    expect(first.statusCode).toBe(200);
    expect((await getZip(url)).statusCode).toBe(404);
  });

  it('an expired ticket answers 404', async () => {
    const file = await upload(`${unique('late')}.txt`, 'late');
    const expired = await createZipTicket({ folderIds: [], fileIds: [file.id] }, undefined, 1);
    await sleep(20);
    expect((await getZip(`/api/drive/zip/${expired}`)).statusCode).toBe(404);
  });

  it('an unknown or malformed ticket answers 404', async () => {
    expect((await getZip(`/api/drive/zip/${'a'.repeat(48)}`)).statusCode).toBe(404);
    expect((await getZip('/api/drive/zip/not-a-ticket')).statusCode).toBe(404);
  });

  it('an item trashed after the ticket was issued answers 404 instead of streaming it', async () => {
    const file = await upload(`${unique('late-trash')}.txt`, 'x');
    const url = await ticketFor({ folderIds: [], fileIds: [file.id] });
    await post('/api/drive/trash', { folderIds: [], fileIds: [file.id] });
    expect((await getZip(url)).statusCode).toBe(404);
  });
});

describe('drive zip: archive content', () => {
  it('zips a folder tree with nested files, an empty folder and the right headers', async () => {
    const docs = await newFolder(unique('Docs'));
    const inner = await newFolder('inner', docs.id);
    await newFolder('empty', docs.id);
    await upload('hello.txt', 'hello from inner', { folderId: inner.id });
    const png = Buffer.from('not-really-a-png-but-stored-as-is');
    await upload('top.png', png, { folderId: docs.id });

    const res = await getZip(await ticketFor({ folderIds: [docs.id], fileIds: [] }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain(`filename="${docs.name}.zip"`);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');

    const body = res.rawPayload;
    expect(body.subarray(0, 2).toString()).toBe('PK');
    expect(body.includes(Buffer.from(`${docs.name}/inner/hello.txt`))).toBe(true);

    const entries = readZip(body);
    expect([...entries.keys()].sort()).toEqual(
      [`${docs.name}/empty/`, `${docs.name}/inner/hello.txt`, `${docs.name}/top.png`].sort()
    );
    expect(entries.get(`${docs.name}/inner/hello.txt`)?.toString()).toBe('hello from inner');
    expect(entries.get(`${docs.name}/top.png`)?.equals(png)).toBe(true);
  });

  it('puts selected files at the root and renames clashes with (2)', async () => {
    const name = unique('Same');
    const folder = await newFolder(name);
    await upload('x.txt', 'in folder', { folderId: folder.id });
    const clash = await upload(name, 'file named like the folder');
    const other = await upload(`${unique('other')}.txt`, 'other');

    const res = await getZip(await ticketFor({ folderIds: [folder.id], fileIds: [clash.id, other.id], name: 'my export' }));
    expect(res.headers['content-disposition']).toContain('filename="my export.zip"');
    const entries = readZip(res.rawPayload);
    expect([...entries.keys()].sort()).toEqual([`${name}/x.txt`, `${name} (2)`, other.name].sort());
    expect(entries.get(`${name} (2)`)?.toString()).toBe('file named like the folder');
  });

  it('does not repeat a folder that is selected together with its parent', async () => {
    const parent = await newFolder(unique('Parent'));
    const child = await newFolder('Child', parent.id);
    const file = await upload('c.txt', 'child file', { folderId: child.id });

    const res = await getZip(await ticketFor({ folderIds: [parent.id, child.id], fileIds: [file.id] }));
    expect([...readZip(res.rawPayload).keys()]).toEqual([`${parent.name}/Child/c.txt`]);
  });

  it('skips a file whose bytes are missing on disk instead of failing the download', async () => {
    const folder = await newFolder(unique('Broken'));
    await upload('kept.txt', 'kept', { folderId: folder.id });
    const lost = await upload('lost.txt', 'lost', { folderId: folder.id });
    const row = await prisma.driveFile.findUniqueOrThrow({ where: { id: lost.id } });
    fs.unlinkSync(path.join(driveDir(), row.storageKey));

    const res = await getZip(await ticketFor({ folderIds: [folder.id], fileIds: [] }));
    expect(res.statusCode).toBe(200);
    expect([...readZip(res.rawPayload).keys()]).toEqual([`${folder.name}/kept.txt`]);
  });

  it('keeps trashed items out of the archive', async () => {
    const folder = await newFolder(unique('Trashy'));
    await upload('live.txt', 'live', { folderId: folder.id });
    const dead = await upload('dead.txt', 'dead', { folderId: folder.id });
    await post('/api/drive/trash', { folderIds: [], fileIds: [dead.id] });

    const res = await getZip(await ticketFor({ folderIds: [folder.id], fileIds: [] }));
    expect([...readZip(res.rawPayload).keys()]).toEqual([`${folder.name}/live.txt`]);
  });
});

describe('drive zip: limits', () => {
  it('answers 429 when two archives are already streaming and frees the slot afterwards', async () => {
    const file = await upload(`${unique('busy')}.txt`, 'busy');
    expect(acquireZipSlot()).toBe(true);
    expect(acquireZipSlot()).toBe(true);
    try {
      const blocked = await getZip(await ticketFor({ folderIds: [], fileIds: [file.id] }));
      expect(blocked.statusCode).toBe(429);
    } finally {
      releaseZipSlot();
      releaseZipSlot();
    }
    const ok = await getZip(await ticketFor({ folderIds: [], fileIds: [file.id] }));
    expect(ok.statusCode).toBe(200);
  });
});
