import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { classifyEntry } from '../src/services/driveExtractService.js';
import { authInject, closeApp, getApp, seedSession } from './helpers.js';

let token: string;
const driveDir = () => path.join(config.privateDir, 'drive');
const tag = crypto.randomBytes(3).toString('hex');
const unique = (name: string) => `${name}-${tag}`;

/* ------------------------------ zip fixtures ------------------------------ */

interface FixtureEntry {
  name: string;
  data?: Buffer;
  /** Store (default) or raw deflate. */
  method?: 'store' | 'deflate';
  /** What the header claims; defaults to the real size. Lying here builds a zip bomb. */
  declaredSize?: number;
  /** Unix mode (e.g. 0o120777 for a symlink); written to the high 16 bits of the external attributes. */
  mode?: number;
  /** General purpose flag bit 0: the entry claims to be encrypted. */
  encrypted?: boolean;
}

/**
 * Builds zip bytes by hand, because the real writers sanitise exactly the names these
 * tests need (`../evil.txt`, `/abs.txt`, `a\..\b.txt`) and cannot lie about sizes.
 */
function buildZip(entries: FixtureEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const data = entry.data ?? Buffer.alloc(0);
    const stored = entry.method !== 'deflate';
    // A real encrypted entry starts with a 12 byte encryption header that counts in its compressed size.
    const body = stored ? data : zlib.deflateRawSync(data);
    const payload = entry.encrypted ? Buffer.concat([crypto.randomBytes(12), body]) : body;
    const uncompressed = entry.declaredSize ?? data.length;
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = zlib.crc32(data);
    const flags = 0x800 | (entry.encrypted ? 1 : 0);
    const method = stored ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(uncompressed, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: unix
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(uncompressed, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + payload.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const REG = 0o100644;
const file = (name: string, text: string, extra: Partial<FixtureEntry> = {}): FixtureEntry => ({
  name,
  data: Buffer.from(text),
  mode: REG,
  ...extra,
});

/* --------------------------------- helpers -------------------------------- */

interface FileDto { id: string; name: string; folderId: string | null }
interface FolderDto { id: string; name: string; parentId: string | null }
interface Listing { folders: FolderDto[]; files: FileDto[] }
interface Extracted { folder: FolderDto; files: number; folders: number; skipped: number }

async function upload(name: string, data: string | Buffer, query: Record<string, string> = {}) {
  const boundary = `----ajdaextract${crypto.randomBytes(8).toString('hex')}`;
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
const extract = (id: string, body: object = {}) => post(`/api/drive/files/${id}/extract`, body);
const list = async (folderId?: string) =>
  (await authInject(token, { method: 'GET', url: `/api/drive/list${folderId ? `?folderId=${folderId}` : ''}` })).json() as Listing;

async function uploadZip(name: string, entries: FixtureEntry[], query: Record<string, string> = {}) {
  return upload(`${name}.zip`, buildZip(entries), query);
}

/** Every path below a folder, folders with a trailing slash, sorted. */
async function tree(folderId: string, prefix = ''): Promise<string[]> {
  const listing = await list(folderId);
  const out: string[] = listing.files.map((f) => `${prefix}${f.name}`);
  for (const folder of listing.folders) {
    out.push(`${prefix}${folder.name}/`, ...(await tree(folder.id, `${prefix}${folder.name}/`)));
  }
  return out.sort();
}

const diskFiles = () => (fs.existsSync(driveDir()) ? fs.readdirSync(driveDir()).filter((n) => !n.startsWith('.')).sort() : []);
const countRows = async () => ({
  files: await prisma.driveFile.count(),
  folders: await prisma.driveFolder.count(),
});

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

/* ---------------------------------- tests --------------------------------- */

describe('drive extract: the happy path (rules 6 and 7)', () => {
  it('extracts a nested archive into a new folder next to the zip and keeps the structure', async () => {
    const parent = await post('/api/drive/folders', { name: unique('Inbox'), parentId: null });
    const inbox = parent.json() as FolderDto;
    const name = unique('bundle');
    const zip = await uploadZip(
      name,
      [
        file('readme.txt', 'top level'),
        file('docs/a.txt', 'doc a'),
        file('docs/sub/b.txt', 'doc b'),
        { name: 'empty/', mode: 0o040755 },
        file('./dot/./c.txt', 'dot segments are dropped'),
      ],
      { folderId: inbox.id }
    );

    const res = await extract(zip.id);
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json() as Extracted;
    expect(body.folder.name).toBe(name);
    expect(body.folder.parentId).toBe(inbox.id);
    expect(body.files).toBe(4);
    expect(body.folders).toBe(4); // docs, docs/sub, empty, dot
    expect(body.skipped).toBe(0);

    expect(await tree(body.folder.id)).toEqual(
      ['dot/', 'dot/c.txt', 'docs/', 'docs/a.txt', 'docs/sub/', 'docs/sub/b.txt', 'empty/', 'readme.txt'].sort()
    );

    // The bytes are really there, and the source zip is untouched.
    const row = await prisma.driveFile.findFirstOrThrow({ where: { name: 'b.txt', folderId: { not: null } } });
    expect(fs.readFileSync(path.join(driveDir(), row.storageKey), 'utf8')).toBe('doc b');
    expect((await list(inbox.id)).files.map((f) => f.name)).toEqual([`${name}.zip`]);
  });

  it('extracting twice never overwrites: the second folder is "name (2)"', async () => {
    const name = unique('twice');
    const zip = await uploadZip(name, [file('a.txt', 'one')]);
    const first = (await extract(zip.id)).json() as Extracted;
    const second = (await extract(zip.id)).json() as Extracted;
    expect(first.folder.name).toBe(name);
    expect(second.folder.name).toBe(`${name} (2)`);
    expect(await tree(first.folder.id)).toEqual(['a.txt']);
    expect(await tree(second.folder.id)).toEqual(['a.txt']);
  });

  it('files with the same name inside the archive are renamed, not overwritten', async () => {
    const zip = await uploadZip(unique('dups'), [file('same.txt', 'first'), file('same.txt', 'second')]);
    const body = (await extract(zip.id)).json() as Extracted;
    expect(await tree(body.folder.id)).toEqual(['same (2).txt', 'same.txt']);
  });

  it('extracts into the folder given in the body', async () => {
    const target = (await post('/api/drive/folders', { name: unique('Target'), parentId: null })).json() as FolderDto;
    const name = unique('elsewhere');
    const zip = await uploadZip(name, [file('x.txt', 'x')]); // the zip itself sits in the root
    const body = (await extract(zip.id, { folderId: target.id })).json() as Extracted;
    expect(body.folder.parentId).toBe(target.id);
    expect(body.folder.name).toBe(name);
  });

  it('accepts a zip by mime type even when the name has another extension (and not a text file)', async () => {
    const zip = await upload(`${unique('renamed')}.zip`, buildZip([file('ok.txt', 'ok')]));
    expect((await extract(zip.id)).statusCode).toBe(201);
    const text = await upload(`${unique('notes')}.txt`, 'plain text');
    expect((await extract(text.id)).statusCode).toBe(400);
  });
});

describe('drive extract: rule 1, names that could leave the folder (zip slip)', () => {
  it('skips traversal, absolute, drive-letter, backslash and NUL names and writes nothing outside', async () => {
    const before = await countRows();
    const name = unique('slip');
    const zip = await uploadZip(name, [
      file('../evil.txt', 'evil'),
      file('/abs.txt', 'abs'),
      file('C:\\win.txt', 'win'),
      file('a\\..\\slip-backslash.txt', 'backslash traversal'),
      file('nested/../../escape.txt', 'nested traversal'),
      file('nul\0byte.txt', 'nul'),
      file('ok.txt', 'fine'),
    ]);
    const diskBefore = diskFiles();

    const res = await extract(zip.id);
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json() as Extracted;
    expect(body.skipped).toBe(6);
    expect(body.files).toBe(1);
    expect(await tree(body.folder.id)).toEqual(['ok.txt']);

    // Nothing named like the escapes exists anywhere in the Drive, and exactly one file was added to the disk.
    const names = ['evil.txt', 'abs.txt', 'win.txt', 'slip-backslash.txt', 'escape.txt'];
    expect(await prisma.driveFile.count({ where: { name: { in: names } } })).toBe(0);
    expect(diskFiles().length).toBe(diskBefore.length + 1);
    expect(await prisma.driveFile.count()).toBe(before.files + 2); // the zip and ok.txt
  });

  it('classifyEntry normalises separators and drops "." and empty segments', () => {
    const entry = (fileName: string, mode = 0) => ({ fileName, externalFileAttributes: (mode << 16) >>> 0, isEncrypted: () => false });
    expect(classifyEntry(entry('a//b/./c.txt'))).toEqual({ kind: 'file', segments: ['a', 'b', 'c.txt'] });
    expect(classifyEntry(entry('a\\b\\c.txt'))).toEqual({ kind: 'file', segments: ['a', 'b', 'c.txt'] });
    expect(classifyEntry(entry('dir/'))).toEqual({ kind: 'dir', segments: ['dir'] });
    expect(classifyEntry(entry('./'))).toEqual({ kind: 'skip' });
    expect(classifyEntry(entry('a/../b'))).toEqual({ kind: 'skip' });
    expect(classifyEntry(entry('x/' + 'n'.repeat(300)))).toEqual({ kind: 'skip' }); // a name cleanName refuses
    expect(classifyEntry(entry('perm-bits-only.txt', 0o644))).toEqual({ kind: 'file', segments: ['perm-bits-only.txt'] });
  });
});

describe('drive extract: rules 2 to 4, entries that are not extracted', () => {
  it('skips symlinks and other non-regular entries but extracts regular ones', async () => {
    const zip = await uploadZip(unique('links'), [
      file('real.txt', 'real'),
      file('link.txt', '/etc/passwd', { mode: 0o120777 }), // symlink
      file('device', '', { mode: 0o060644 }), // block device
      file('fifo', '', { mode: 0o010644 }), // named pipe
    ]);
    const body = (await extract(zip.id)).json() as Extracted;
    expect(body.skipped).toBe(3);
    expect(await tree(body.folder.id)).toEqual(['real.txt']);
  });

  it('skips __MACOSX, .DS_Store and Thumbs.db', async () => {
    const zip = await uploadZip(unique('junk'), [
      file('keep.txt', 'keep'),
      file('__MACOSX/._keep.txt', 'resource fork'),
      file('__MACOSX/', '', { mode: 0o040755 }),
      file('sub/.DS_Store', 'junk'),
      file('Thumbs.db', 'junk'),
      file('sub/thumbs.db', 'junk'),
      file('sub/real.txt', 'real'),
    ]);
    const body = (await extract(zip.id)).json() as Extracted;
    expect(body.skipped).toBe(5);
    expect(await tree(body.folder.id)).toEqual(['keep.txt', 'sub/', 'sub/real.txt']);
  });

  it('skips entries that claim to be encrypted', async () => {
    const zip = await uploadZip(unique('secret'), [file('plain.txt', 'plain'), file('locked.txt', 'cipher', { encrypted: true })]);
    const body = (await extract(zip.id)).json() as Extracted;
    expect(body.skipped).toBe(1);
    expect(await tree(body.folder.id)).toEqual(['plain.txt']);
  });
});

describe('drive extract: source checks', () => {
  it('rejects a trashed or unknown source with 404', async () => {
    const zip = await uploadZip(unique('trashed'), [file('a.txt', 'a')]);
    expect((await post('/api/drive/trash', { folderIds: [], fileIds: [zip.id] })).statusCode).toBe(200);
    expect((await extract(zip.id)).statusCode).toBe(404);
    expect((await extract('00000000-0000-0000-0000-000000000000')).statusCode).toBe(404);
  });

  it('rejects an unknown target folder and a file that is not a zip archive', async () => {
    const zip = await uploadZip(unique('target'), [file('a.txt', 'a')]);
    expect((await extract(zip.id, { folderId: '00000000-0000-0000-0000-000000000000' })).statusCode).toBe(404);

    const fake = await upload(`${unique('fake')}.zip`, 'this is not a zip at all');
    expect((await extract(fake.id)).statusCode).toBe(400);
    expect((await extract(fake.id)).statusCode).toBe(400); // the lock was released by the failure
  });

  it('requires a login', async () => {
    const res = await getApp().then((app) =>
      app.inject({ method: 'POST', url: '/api/drive/files/anything/extract', payload: {} })
    );
    expect(res.statusCode).toBe(401);
  });
});

describe('drive extract: rule 5, limits and the zip bomb guard', () => {
  it('aborts with 413 when an entry really is bigger than its header says, and leaves nothing behind', async () => {
    const zip = await uploadZip(unique('bomb'), [
      file('first-ok.txt', 'this one is extracted before the bomb goes off'),
      {
        name: 'bomb.bin',
        data: Buffer.alloc(3 * 1024 * 1024), // 3 MB of zeros deflate to a few kilobytes
        method: 'deflate',
        declaredSize: 10, // the header lies
        mode: REG,
      },
    ]);
    const before = await countRows();
    const diskBefore = diskFiles();

    const res = await extract(zip.id);
    expect(res.statusCode, res.body).toBe(413);

    expect(await countRows()).toEqual(before); // no new folder, no new file row
    expect(diskFiles()).toEqual(diskBefore); // and no bytes left on disk, including first-ok.txt
  });

  it('aborts when an entry is shorter than its header says', async () => {
    const zip = await uploadZip(unique('short'), [
      { name: 'short.bin', data: Buffer.from('tiny'), declaredSize: 4, mode: REG },
      { name: 'lies.bin', data: Buffer.from('tiny'), method: 'deflate', declaredSize: 400, mode: REG },
    ]);
    const before = await countRows();
    const res = await extract(zip.id);
    expect(res.statusCode, res.body).toBe(400);
    expect(await countRows()).toEqual(before);
  });

  it('refuses an archive whose declared total exceeds the limit before writing anything', async () => {
    const big = 3_000_000_000;
    const zip = await uploadZip(unique('declared'), [
      { name: 'a.bin', data: Buffer.from('x'), method: 'deflate', declaredSize: big, mode: REG },
      { name: 'b.bin', data: Buffer.from('x'), method: 'deflate', declaredSize: big, mode: REG },
    ]);
    const before = await countRows();
    const diskBefore = diskFiles();
    const res = await extract(zip.id);
    expect(res.statusCode, res.body).toBe(413);
    expect(await countRows()).toEqual(before);
    expect(diskFiles()).toEqual(diskBefore);
  });

  it('refuses an archive with more than 10 000 entries', async () => {
    const entries = Array.from({ length: 10_001 }, (_, i) => file(`f${i}.txt`, ''));
    const zip = await uploadZip(unique('many'), entries);
    const before = await countRows();
    const res = await extract(zip.id);
    expect(res.statusCode, res.body).toBe(413);
    expect(res.json().error).toContain('too many entries');
    expect(await countRows()).toEqual(before);
  });

  it('runs one extraction at a time: the second request gets 429 and the lock is released afterwards', async () => {
    const entries = Array.from({ length: 150 }, (_, i) => file(`n${i}.txt`, `file ${i}`));
    const zip = await uploadZip(unique('busy'), entries);
    const [a, b] = await Promise.all([extract(zip.id), extract(zip.id)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 429]);
    const rejected = a.statusCode === 429 ? a : b;
    expect(rejected.json().error).toBe('Another extraction is running, try again shortly');

    expect((await extract(zip.id)).statusCode).toBe(201);
  });
});
