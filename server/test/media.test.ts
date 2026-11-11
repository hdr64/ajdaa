import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import {
  authInject,
  buildMultipartBody,
  closeApp,
  getApp,
  inject,
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

async function upload(file: { filename: string; contentType: string; data: Buffer }) {
  const { payload, headers } = buildMultipartBody(file);
  return authInject(superAdminToken, {
    method: 'POST',
    url: '/api/media/upload',
    payload,
    headers,
  });
}

describe('uploaded files are stored under a type the client cannot choose', () => {
  it('forces a .pdf extension on a PDF sent under a dangerous filename', async () => {
    // The declared mimetype and the extension are both attacker-controlled, so
    // the decision has to come from the file signature.
    const response = await upload({
      filename: 'evil.html',
      contentType: 'text/html',
      data: Buffer.from('%PDF-1.4\n<html><script>alert(1)</script></html>\n', 'utf8'),
    });

    expect(response.statusCode).toBe(201);

    const { url } = response.json() as { url: string; filename: string };
    expect(url.endsWith('-evil.pdf')).toBe(true);

    const fetched = await inject({ method: 'GET', url });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers['content-type']).toContain('application/pdf');
    // Never rendered inline on our own origin.
    expect(fetched.headers['content-disposition']).toBe('attachment');
    expect(fetched.headers['x-content-type-options']).toBe('nosniff');
  });

  it('re-encodes a real PNG to webp', async () => {
    const png = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .png()
      .toBuffer();

    const response = await upload({ filename: 'photo.png', contentType: 'image/png', data: png });

    expect(response.statusCode).toBe(201);

    const { url } = response.json() as { url: string; filename: string };
    expect(url.endsWith('.webp')).toBe(true);

    const fetched = await inject({ method: 'GET', url });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/webp');

    // And it really is a decodable webp, not a renamed original.
    const decoded = await sharp(fetched.rawPayload).metadata();
    expect(decoded.format).toBe('webp');
    expect(decoded.width).toBe(32);
  });
});

describe('unsupported uploads are rejected', () => {
  it('rejects a file that is neither an image nor a PDF', async () => {
    const response = await upload({
      filename: 'notes.txt',
      contentType: 'text/plain',
      data: Buffer.from('just some plain text, nothing to see here', 'utf8'),
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Media Library management and database indexing', () => {
  it('creates a MediaFile database record with rich metadata on upload', async () => {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .png()
      .toBuffer();

    const response = await upload({
      filename: 'tower-skyline.png',
      contentType: 'image/png',
      data: png,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      url: string;
      filename: string;
      originalName?: string;
      fileType?: string;
      mimeType?: string;
      size?: number;
    };
    expect(body.originalName).toBe('tower-skyline.png');
    expect(body.fileType).toBe('image');
    expect(body.mimeType).toBe('image/webp');
    expect(body.size).toBeGreaterThan(0);

    const record = await prisma.mediaFile.findUnique({
      where: { url: body.url },
    });
    expect(record).not.toBeNull();
    expect(record?.url).toBe(body.url);
    expect(record?.originalName).toBe('tower-skyline.png');
    expect(record?.fileType).toBe('image');
  });

  it('lists media files with pagination and usage counts via GET /api/media', async () => {
    const listRes = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/media?page=1&limit=20',
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json() as {
      items: Array<{ id: string; url: string; usageCount: number; usages: Array<{ entityTitle: string }> }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };

    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0]).toHaveProperty('usageCount');
    expect(body.items[0]).toHaveProperty('usages');
  });

  it('checks usage for a specific media URL via GET /api/media/usage', async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 50, g: 50, b: 50 } },
    })
      .png()
      .toBuffer();

    const uploadRes = await upload({
      filename: 'sample-project-hero.png',
      contentType: 'image/png',
      data: png,
    });
    const { url } = uploadRes.json() as { url: string; filename: string };

    const usageRes1 = await authInject(superAdminToken, {
      method: 'GET',
      url: `/api/media/usage?url=${encodeURIComponent(url)}`,
    });
    expect(usageRes1.statusCode).toBe(200);
    const usage1 = usageRes1.json() as { usageCount: number; usages: Array<{ entityTitle: string }> };
    expect(usage1.usageCount).toBe(0);
    expect(usage1.usages).toEqual([]);

    const project = await prisma.project.create({
      data: {
        title: 'برج الأيقونة التجاري',
        titleEn: 'The Icon Commercial Tower',
        type: 'commercial',
        typeAr: 'تجاري',
        typeEn: 'Commercial',
        priceType: 'إيجار',
        city: 'الرياض',
        area: 4500,
        status: 'متاح',
        image: url,
        gallery: JSON.stringify([url]),
      },
    });

    const usageRes2 = await authInject(superAdminToken, {
      method: 'GET',
      url: `/api/media/usage?url=${encodeURIComponent(url)}`,
    });
    expect(usageRes2.statusCode).toBe(200);
    const usage2 = usageRes2.json() as { usageCount: number; usages: Array<{ entityTitle: string }> };
    expect(usage2.usageCount).toBeGreaterThanOrEqual(1);
    expect(usage2.usages.some((u) => u.entityTitle.includes('برج الأيقونة التجاري'))).toBe(true);

    await prisma.project.delete({ where: { id: project.id } });
  });
});

describe('Deletion constraints and SEO protection', () => {
  it('strictly blocks deletion of media linked to an active project (409 Conflict)', async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const uploadRes = await upload({
      filename: 'seo-protected-image.png',
      contentType: 'image/png',
      data: png,
    });
    const { url } = uploadRes.json() as { url: string; filename: string };

    const record = await prisma.mediaFile.findUnique({ where: { url } });
    expect(record).not.toBeNull();

    const project = await prisma.project.create({
      data: {
        title: 'مشروع حماية الروابط SEO',
        titleEn: 'SEO Permanent Project',
        type: 'commercial',
        typeAr: 'تجاري',
        typeEn: 'Commercial',
        priceType: 'بيع',
        city: 'الرياض',
        area: 2500,
        status: 'متاح',
        image: url,
        gallery: JSON.stringify([url]),
      },
    });

    const deleteRes = await authInject(superAdminToken, {
      method: 'DELETE',
      url: `/api/media/${record!.id}`,
    });

    expect(deleteRes.statusCode).toBe(409);
    const errorBody = deleteRes.json() as { error: string; usages?: Array<{ entityTitle: string }> };
    expect(errorBody.error).toContain('SEO');
    expect(errorBody.usages?.some((u) => u.entityTitle.includes('مشروع حماية الروابط SEO'))).toBe(true);

    const stillExists = await prisma.mediaFile.findUnique({ where: { url } });
    expect(stillExists).not.toBeNull();

    await prisma.project.delete({ where: { id: project.id } });

    const deleteRes2 = await authInject(superAdminToken, {
      method: 'DELETE',
      url: `/api/media/${record!.id}`,
    });
    expect(deleteRes2.statusCode).toBe(200);

    const deletedRecord = await prisma.mediaFile.findUnique({ where: { url } });
    expect(deletedRecord).toBeNull();
  });

  it('retrieves disk storage stats and space warning via GET /api/media/storage-stats', async () => {
    const res = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/media/storage-stats',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      freeBytes: number;
      totalBytes: number;
      freeGb: number;
      totalGb: number;
      isLowSpace: boolean;
      percentUsed: number;
      mediaCount: number;
      mediaTotalBytes: number;
    };

    expect(typeof body.freeBytes).toBe('number');
    expect(typeof body.totalBytes).toBe('number');
    expect(typeof body.freeGb).toBe('number');
    expect(typeof body.totalGb).toBe('number');
    expect(typeof body.percentUsed).toBe('number');
    expect(typeof body.isLowSpace).toBe('boolean');
    expect(body.isLowSpace).toBe(body.freeBytes < 10 * 1024 * 1024 * 1024);
    expect(typeof body.mediaCount).toBe('number');
    expect(typeof body.mediaTotalBytes).toBe('number');
  });
});

describe('Media list: database pagination and status filter', () => {
  type ListBody = { items: Array<{ id: string; usageCount: number }>; total: number; page: number; totalPages: number };
  const list = async (query: string) =>
    (await authInject(superAdminToken, { method: 'GET', url: `/api/media?${query}` })).json() as ListBody;

  it('splits the library into pages that do not overlap and add up to the total', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    for (let i = 0; i < 3; i++) {
      expect((await upload({ filename: `page-test-${i}.png`, contentType: 'image/png', data: png })).statusCode).toBe(201);
    }

    const first = await list('page=1&limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.totalPages).toBe(Math.ceil(first.total / 2));

    const second = await list('page=2&limit=2');
    const firstIds = new Set(first.items.map((i) => i.id));
    expect(second.items.every((i) => !firstIds.has(i.id))).toBe(true);

    const beyond = await list(`page=${first.totalPages + 1}&limit=2`);
    expect(beyond.items).toHaveLength(0);
  });

  it('filters by linked / orphaned status and keeps the totals consistent', async () => {
    const all = await list('limit=100');
    const linked = await list('status=linked&limit=100');
    const orphaned = await list('status=orphaned&limit=100');

    expect(linked.items.every((i) => i.usageCount > 0)).toBe(true);
    expect(orphaned.items.every((i) => i.usageCount === 0)).toBe(true);
    expect(linked.total + orphaned.total).toBe(all.total);
  });
});
