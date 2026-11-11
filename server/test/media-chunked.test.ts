import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import {
  authInject,
  buildMultipartBody,
  closeApp,
  getApp,
  seedSession,
} from './helpers.js';

let superAdminToken: string;

beforeAll(async () => {
  await getApp();
  superAdminToken = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await closeApp();
});

describe('Resumable Chunked Upload API', () => {
  it('initializes, uploads chunks, checks status, completes, and creates MediaFile record', async () => {
    const filename = 'promo-video.mp4';
    const chunkSize = 1024 * 1024; // 1MB
    const totalSize = 2.5 * 1024 * 1024; // 2.5MB -> 3 chunks
    const totalChunks = 3;

    // 1. Init
    const initRes = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/media/upload/chunked/init',
      payload: {
        filename,
        totalSize,
        totalChunks,
        chunkSize,
        mimeType: 'video/mp4',
      },
    });

    expect(initRes.statusCode).toBe(201);
    const { uploadId } = initRes.json() as { uploadId: string };
    expect(uploadId).toBeDefined();

    // 2. Upload Chunk 0
    const chunk0 = Buffer.alloc(chunkSize, 'A');
    const { payload: p0, headers: h0 } = buildMultipartBody({
      filename: 'chunk0.bin',
      contentType: 'application/octet-stream',
      data: chunk0,
    });
    const c0Res = await authInject(superAdminToken, {
      method: 'POST',
      url: `/api/media/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=0`,
      payload: p0,
      headers: h0,
    });
    expect(c0Res.statusCode).toBe(200);

    // 3. Check status: chunk 0 is recorded
    const s1Res = await authInject(superAdminToken, {
      method: 'GET',
      url: `/api/media/upload/chunked/status/${uploadId}`,
    });
    expect(s1Res.statusCode).toBe(200);
    expect(s1Res.json().uploadedChunks).toEqual([0]);

    // 4. Upload Chunk 1 & 2
    const chunk1 = Buffer.alloc(chunkSize, 'B');
    const { payload: p1, headers: h1 } = buildMultipartBody({
      filename: 'chunk1.bin',
      contentType: 'application/octet-stream',
      data: chunk1,
    });
    await authInject(superAdminToken, {
      method: 'POST',
      url: `/api/media/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=1`,
      payload: p1,
      headers: h1,
    });

    const chunk2 = Buffer.alloc(0.5 * 1024 * 1024, 'C');
    const { payload: p2, headers: h2 } = buildMultipartBody({
      filename: 'chunk2.bin',
      contentType: 'application/octet-stream',
      data: chunk2,
    });
    await authInject(superAdminToken, {
      method: 'POST',
      url: `/api/media/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=2`,
      payload: p2,
      headers: h2,
    });

    // 5. Check status: all 3 chunks uploaded
    const s2Res = await authInject(superAdminToken, {
      method: 'GET',
      url: `/api/media/upload/chunked/status/${uploadId}`,
    });
    expect(s2Res.statusCode).toBe(200);
    expect(s2Res.json().uploadedChunks).toEqual([0, 1, 2]);

    // 6. Complete
    const completeRes = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/media/upload/chunked/complete',
      payload: { uploadId },
    });

    expect(completeRes.statusCode).toBe(201);
    const media = completeRes.json();
    expect(media.fileType).toBe('video');
    expect(media.mimeType).toBe('video/mp4');
    expect(media.originalName).toBe(filename);
    expect(media.size).toBe(totalSize);

    // Verify DB
    const dbRecord = await prisma.mediaFile.findUnique({ where: { id: media.id } });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.fileType).toBe('video');

    // 7. Verify filtering by video
    const listRes = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/media?type=video',
    });
    expect(listRes.statusCode).toBe(200);
    const listJson = listRes.json();
    expect(listJson.items.some((i: any) => i.id === media.id)).toBe(true);
  });
});

describe('Chunked upload safeguards', () => {
  const init = (payload: Record<string, unknown>) =>
    authInject(superAdminToken, { method: 'POST', url: '/api/media/upload/chunked/init', payload });

  const sendChunk = (uploadId: string, index: number, data: Buffer) => {
    const { payload, headers } = buildMultipartBody({ filename: 'c.bin', contentType: 'application/octet-stream', data });
    return authInject(superAdminToken, {
      method: 'POST',
      url: `/api/media/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=${index}`,
      payload,
      headers,
    });
  };

  const oneChunk = { totalSize: 300 * 1024, totalChunks: 1, chunkSize: 1024 * 1024 };

  it('refuses extensions outside the allow list, including svg', async () => {
    for (const filename of ['logo.svg', 'run.exe', 'noext']) {
      const res = await init({ filename, ...oneChunk });
      expect(res.statusCode, filename).toBe(400);
    }
  });

  it('refuses inconsistent init values', async () => {
    expect((await init({ filename: 'a.mp4', totalSize: 3 * 1024 * 1024, totalChunks: 1, chunkSize: 1024 * 1024 })).statusCode).toBe(400);
    expect((await init({ filename: 'a.mp4', ...oneChunk, chunkSize: 1024 })).statusCode).toBe(400);
  });

  it('rejects a wrong chunk size and an out-of-range index, answers 404 for an unknown session', async () => {
    const res = await init({ filename: 'a.mp4', ...oneChunk });
    expect(res.statusCode).toBe(201);
    const { uploadId } = res.json() as { uploadId: string };

    expect((await sendChunk(uploadId, 0, Buffer.alloc(100))).statusCode).toBe(400);
    expect((await sendChunk(uploadId, 5, Buffer.alloc(oneChunk.totalSize))).statusCode).toBe(400);

    // Nothing was stored, so completing reports the missing chunk.
    const complete = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/media/upload/chunked/complete',
      payload: { uploadId },
    });
    expect(complete.statusCode).toBe(400);

    const unknown = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/media/upload/chunked/status/00000000-0000-4000-8000-000000000000',
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('takes the stored mime from the extension, not from the client', async () => {
    const res = await init({ filename: 'photo.jpg', ...oneChunk, mimeType: 'text/html' });
    const { uploadId } = res.json() as { uploadId: string };
    expect((await sendChunk(uploadId, 0, Buffer.alloc(oneChunk.totalSize, 'x'))).statusCode).toBe(200);
    const done = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/media/upload/chunked/complete',
      payload: { uploadId },
    });
    expect(done.statusCode).toBe(201);
    const media = done.json() as { id: string; mimeType: string; fileType: string };
    expect(media.mimeType).toBe('image/jpeg');
    expect(media.fileType).toBe('image');
    await authInject(superAdminToken, { method: 'DELETE', url: `/api/media/${media.id}` });
  });
});
