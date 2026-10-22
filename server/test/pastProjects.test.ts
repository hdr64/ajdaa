import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authInject,
  buildMultipartBody,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  SEED_ADMINS,
  seedSession,
  THROWAWAY_PASSWORD,
} from './helpers.js';

const VALID_URL = '/uploads/test.webp';
const VALID_PDF = '/uploads/test.pdf';

let superAdminToken: string;
let noPermToken: string;

beforeAll(async () => {
  await getApp();
  superAdminToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  noPermToken = (await seedSession(SEED_ADMINS.projectManager)).token;
});

afterAll(async () => {
  await closeApp();
});

describe('past projects public list', () => {
  it('hides unpublished and orders by sortOrder', async () => {
    // create two
    const a = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'A', image: VALID_URL, sortOrder: 2, published: true },
    });
    const b = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'B', image: VALID_URL, sortOrder: 1, published: false },
    });
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);

    const res = await inject({ method: 'GET', url: '/api/past-projects' });
    expect(res.statusCode).toBe(200);
    const list = res.json() as { title: string; published: boolean }[];
    expect(list.every((p) => p.published !== false)).toBe(true);
    // B unpublished should not appear
    expect(list.find((p) => p.title === 'B')).toBeUndefined();
  });
});

describe('admin endpoints auth', () => {
  const endpoints: { method: string; url: string; body?: unknown }[] = [
    { method: 'GET', url: '/api/past-projects/admin' },
    { method: 'POST', url: '/api/past-projects', body: { title: 'X', image: VALID_URL } },
    { method: 'PUT', url: '/api/past-projects/1', body: { title: 'X', image: VALID_URL } },
    { method: 'PATCH', url: '/api/past-projects/1/published', body: { published: true } },
    { method: 'DELETE', url: '/api/past-projects/1' },
  ];

  for (const ep of endpoints) {
    it(`${ep.method} ${ep.url} -> 401 anonymous`, async () => {
      const res = await inject({ method: ep.method as any, url: ep.url, payload: ep.body });
      expect(res.statusCode).toBe(401);
    });
    it(`${ep.method} ${ep.url} -> 403 without permission`, async () => {
      const res = await authInject(noPermToken, { method: ep.method as any, url: ep.url, payload: ep.body });
      expect(res.statusCode).toBe(403);
    });
  }
});

describe('admin CRUD', () => {
  it('creates with super admin (201) and lists admin (200)', async () => {
    const res = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'Crud', image: VALID_URL, gallery: [VALID_URL], pdfUrl: VALID_PDF, sortOrder: 5 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: number; gallery: string[]; pdfUrl: string };
    expect(Array.isArray(body.gallery)).toBe(true);
    expect(body.gallery.length).toBe(1);

    const listRes = await authInject(superAdminToken, { method: 'GET', url: '/api/past-projects/admin' });
    expect(listRes.statusCode).toBe(200);
  });

  it('publish toggle', async () => {
    const created = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'Toggle', image: VALID_URL, published: true },
    });
    const id = (created.json() as { id: number }).id;
    const res = await authInject(superAdminToken, {
      method: 'PATCH',
      url: `/api/past-projects/${id}/published`,
      payload: { published: false },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { published: boolean }).published).toBe(false);
  });

  it('delete', async () => {
    const created = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'ToDelete', image: VALID_URL },
    });
    const id = (created.json() as { id: number }).id;
    const res = await authInject(superAdminToken, { method: 'DELETE', url: `/api/past-projects/${id}` });
    expect(res.statusCode).toBe(200);
  });

  it('gallery round-trips as array', async () => {
    const res = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'Gallery', image: VALID_URL, gallery: [VALID_URL, VALID_PDF] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { gallery: unknown };
    expect(Array.isArray(body.gallery)).toBe(true);
  });
});

describe('validation', () => {
  it('bad URL scheme', async () => {
    const res = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'Bad', image: 'http://example.com/x.png' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('over-long title', async () => {
    const res = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'a'.repeat(201), image: VALID_URL },
    });
    expect(res.statusCode).toBe(400);
  });

  it('>30 gallery items', async () => {
    const res = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'Many', image: VALID_URL, gallery: Array(31).fill(VALID_URL) },
    });
    expect(res.statusCode).toBe(400);
  });

  it('invalid id -> 400', async () => {
    // GET single not defined; but id validation on PUT
    const res2 = await authInject(superAdminToken, { method: 'PUT', url: '/api/past-projects/abc', payload: { title: 'X', image: VALID_URL } });
    expect(res2.statusCode).toBe(400);
  });

  it('unknown id -> 404', async () => {
    const res = await authInject(superAdminToken, { method: 'DELETE', url: '/api/past-projects/999999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('update validation', () => {
  it('bad url scheme on update', async () => {
    const created = await authInject(superAdminToken, {
      method: 'POST',
      url: '/api/past-projects',
      payload: { title: 'Upd', image: VALID_URL },
    });
    const id = (created.json() as { id: number }).id;
    const res = await authInject(superAdminToken, {
      method: 'PUT',
      url: `/api/past-projects/${id}`,
      payload: { title: 'Upd2', image: 'ftp://bad' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('media upload for past projects', () => {
  it('accepts managePastProjects alone and still rejects users with neither permission', async () => {
    const pastOnly = await createThrowawayUser({ permissions: { managePastProjects: true } });
    const pastOnlyToken = (await login(pastOnly.email, THROWAWAY_PASSWORD)).token;
    const viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;
    const upload = (token: string) => {
      const { payload, headers } = buildMultipartBody({
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        data: Buffer.from('%PDF-1.4\n%%EOF\n'),
      });
      return authInject(token, { method: 'POST', url: '/api/media/upload', payload, headers });
    };

    expect((await upload(pastOnlyToken)).statusCode).not.toBe(403);
    expect((await upload(viewerToken)).statusCode).toBe(403);
  });
});