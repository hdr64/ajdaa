import { expect } from 'vitest';
import { authInject, buildMultipartBody } from './helpers.js';

/** Builds zip files for tests (stored entries, no compression). */

const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Builds a zip with stored (uncompressed) entries. */
export function buildZip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
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


export interface Extracted {
  slug: string | null;
  id: string;
  url: string;
  fileType: string;
  originalName: string;
  /** Library folder the extraction created (named after the zip). */
  folderId?: string | null;
  folderName?: string | null;
}

/** Uploads `file` through the chunked API; returns the HTTP status and body. */
export async function uploadChunked(token: string, filename: string, file: Buffer, extract?: string) {
  const init = await authInject(token, {
    method: 'POST',
    url: '/api/media/upload/chunked/init',
    payload: { filename, totalSize: file.length, totalChunks: 1, ...(extract ? { extract } : {}) },
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
  return { status: complete.statusCode, body: complete.json() as { extracted?: Extracted[]; error?: string } };
}

