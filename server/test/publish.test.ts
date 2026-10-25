import type { FastifyInstance } from 'fastify';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authInject,
  closeApp,
  getApp,
  inject,
  SEED_ADMINS,
  seedSession,
  sleep,
  waitFor,
} from './helpers.js';

let app: FastifyInstance;
let projectManagerToken: string;
let salesAgentToken: string;
let viewerToken: string;
let baseUrl = '';
const sockets: Socket[] = [];

function openSocket(token?: string): Socket {
  const socket = token
    ? connectSocket(baseUrl, { transports: ['websocket'], auth: { token } })
    : connectSocket(baseUrl, { transports: ['websocket'] });
  sockets.push(socket);
  return socket;
}

function connected(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function collect<T>(socket: Socket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

beforeAll(async () => {
  app = await getApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP address after listen()');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  projectManagerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
  salesAgentToken = (await seedSession(SEED_ADMINS.salesAgent)).token;
  viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;
});

afterAll(async () => {
  for (const socket of sockets) {
    socket.disconnect();
    socket.close();
  }
  await closeApp();
});

const sampleProjectPayload = {
  type: 'office',
  typeAr: 'مكتبي',
  title: 'مشروع النشر التجريبي',
  priceType: 'إيجار',
  area: 1200,
  city: 'الرياض',
  image: '/uploads/publish-test.webp',
};

describe('Project publishing states', () => {
  it('defaults to draft on create when publishStatus is omitted', async () => {
    const res = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع مسودة افتراضي' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: number; publishStatus: string; publishedAt: string | null };
    expect(body.publishStatus).toBe('draft');
    expect(body.publishedAt).toBeNull();
  });

  it('sets publishedAt when created explicitly as published', async () => {
    const res = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع منشور فورا', publishStatus: 'published' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: number; publishStatus: string; publishedAt: string | null };
    expect(body.publishStatus).toBe('published');
    expect(body.publishedAt).toBeTruthy();
  });

  it('excludes draft and hidden projects from anonymous project list', async () => {
    // Create draft and hidden projects
    const draftRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع مسودة للقائمة' },
    });
    const hiddenRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع مخفي للقائمة', publishStatus: 'hidden' },
    });
    const draftId = (draftRes.json() as { id: number }).id;
    const hiddenId = (hiddenRes.json() as { id: number }).id;

    // Anonymous list
    const listRes = await inject({ method: 'GET', url: '/api/projects' });
    expect(listRes.statusCode).toBe(200);
    const projects = listRes.json() as { id: number; publishStatus: string }[];

    expect(projects.every((p) => p.publishStatus === 'published')).toBe(true);
    expect(projects.some((p) => p.id === draftId)).toBe(false);
    expect(projects.some((p) => p.id === hiddenId)).toBe(false);
  });

  it('returns 404 for anonymous GET /:id when project is draft or hidden', async () => {
    const draftRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع مسودة للتفاصيل' },
    });
    const hiddenRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع مخفي للتفاصيل', publishStatus: 'hidden' },
    });
    const draftId = (draftRes.json() as { id: number }).id;
    const hiddenId = (hiddenRes.json() as { id: number }).id;

    const anonDraft = await inject({ method: 'GET', url: `/api/projects/${draftId}` });
    expect(anonDraft.statusCode).toBe(404);
    expect(anonDraft.json()).toEqual({ error: 'Project not found' });

    const anonHidden = await inject({ method: 'GET', url: `/api/projects/${hiddenId}` });
    expect(anonHidden.statusCode).toBe(404);
    expect(anonHidden.json()).toEqual({ error: 'Project not found' });

    // Compare with non-existent project: same response body so drafts cannot be probed
    const anonMissing = await inject({ method: 'GET', url: '/api/projects/999999' });
    expect(anonMissing.statusCode).toBe(404);
    expect(anonMissing.json()).toEqual({ error: 'Project not found' });
  });

  it('requires authentication for ?scope=admin (401 anon, 200 with token and includes drafts)', async () => {
    const draftRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع فحص سكوب الأدمن' },
    });
    const draftId = (draftRes.json() as { id: number }).id;

    // 401 when anonymous with ?scope=admin
    const anonList = await inject({ method: 'GET', url: '/api/projects?scope=admin' });
    expect(anonList.statusCode).toBe(401);

    const anonDetail = await inject({ method: 'GET', url: `/api/projects/${draftId}?scope=admin` });
    expect(anonDetail.statusCode).toBe(401);

    // 200 with valid admin token (even a viewer who has no manageProjects permission)
    const adminList = await authInject(viewerToken, { method: 'GET', url: '/api/projects?scope=admin' });
    expect(adminList.statusCode).toBe(200);
    const listBody = adminList.json() as { id: number; publishStatus: string }[];
    expect(listBody.some((p) => p.id === draftId)).toBe(true);

    const adminDetail = await authInject(viewerToken, { method: 'GET', url: `/api/projects/${draftId}?scope=admin` });
    expect(adminDetail.statusCode).toBe(200);
    const detailBody = adminDetail.json() as { id: number; publishStatus: string };
    expect(detailBody.id).toBe(draftId);
    expect(detailBody.publishStatus).toBe('draft');
  });

  it('filters admin project list by status (?scope=admin&status=draft|published|hidden)', async () => {
    const [draftList, publishedList, hiddenList] = await Promise.all([
      authInject(viewerToken, { method: 'GET', url: '/api/projects?scope=admin&status=draft' }),
      authInject(viewerToken, { method: 'GET', url: '/api/projects?scope=admin&status=published' }),
      authInject(viewerToken, { method: 'GET', url: '/api/projects?scope=admin&status=hidden' }),
    ]);

    expect(draftList.statusCode).toBe(200);
    expect(publishedList.statusCode).toBe(200);
    expect(hiddenList.statusCode).toBe(200);

    const drafts = draftList.json() as { publishStatus: string }[];
    const published = publishedList.json() as { publishStatus: string }[];
    const hidden = hiddenList.json() as { publishStatus: string }[];

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((p) => p.publishStatus === 'draft')).toBe(true);

    expect(published.length).toBeGreaterThan(0);
    expect(published.every((p) => p.publishStatus === 'published')).toBe(true);

    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((p) => p.publishStatus === 'hidden')).toBe(true);
  });

  it('PATCH publish sets publishedAt once and keeps it on re-publish', async () => {
    const created = (
      await authInject(projectManagerToken, {
        method: 'POST',
        url: '/api/projects',
        payload: { ...sampleProjectPayload, title: 'مشروع تاريخ النشر' },
      })
    ).json() as { id: number; publishStatus: string; publishedAt: string | null };

    expect(created.publishedAt).toBeNull();

    // 1. Publish for the first time: sets publishedAt
    const pub1 = await authInject(projectManagerToken, {
      method: 'PATCH',
      url: `/api/projects/${created.id}/publish`,
      payload: { publishStatus: 'published' },
    });
    expect(pub1.statusCode).toBe(200);
    const pub1Body = pub1.json() as { publishStatus: string; publishedAt: string | null };
    expect(pub1Body.publishStatus).toBe('published');
    expect(pub1Body.publishedAt).toBeTruthy();
    const originalPublishedAt = pub1Body.publishedAt;

    // Wait slightly to ensure a later Date() would differ
    await sleep(20);

    // 2. Hide the project
    const hide = await authInject(projectManagerToken, {
      method: 'PATCH',
      url: `/api/projects/${created.id}/publish`,
      payload: { publishStatus: 'hidden' },
    });
    expect(hide.statusCode).toBe(200);
    const hideBody = hide.json() as { publishStatus: string; publishedAt: string | null };
    expect(hideBody.publishStatus).toBe('hidden');
    expect(hideBody.publishedAt).toBe(originalPublishedAt);

    // 3. Re-publish: must preserve the original publishedAt
    const pub2 = await authInject(projectManagerToken, {
      method: 'PATCH',
      url: `/api/projects/${created.id}/publish`,
      payload: { publishStatus: 'published' },
    });
    expect(pub2.statusCode).toBe(200);
    const pub2Body = pub2.json() as { publishStatus: string; publishedAt: string | null };
    expect(pub2Body.publishStatus).toBe('published');
    expect(pub2Body.publishedAt).toBe(originalPublishedAt);
  });

  it('PUT without publishStatus preserves the existing publishStatus', async () => {
    // Create draft project
    const created = (
      await authInject(projectManagerToken, {
        method: 'POST',
        url: '/api/projects',
        payload: { ...sampleProjectPayload, title: 'مشروع فحص تحديث PUT' },
      })
    ).json() as { id: number; publishStatus: string };
    expect(created.publishStatus).toBe('draft');

    // PUT without publishStatus field
    const updated = await authInject(projectManagerToken, {
      method: 'PUT',
      url: `/api/projects/${created.id}`,
      payload: {
        ...sampleProjectPayload,
        title: 'مشروع فحص تحديث PUT (محدث العنوان)',
      },
    });
    expect(updated.statusCode).toBe(200);
    const updatedBody = updated.json() as { publishStatus: string; title: string };
    expect(updatedBody.publishStatus).toBe('draft');
    expect(updatedBody.title).toBe('مشروع فحص تحديث PUT (محدث العنوان)');

    // Verify in database / scope=admin fetch
    const getRes = await authInject(viewerToken, {
      method: 'GET',
      url: `/api/projects/${created.id}?scope=admin`,
    });
    expect((getRes.json() as { publishStatus: string }).publishStatus).toBe('draft');
  });

  it('returns 403 on PATCH /:id/publish when admin lacks manageProjects', async () => {
    const created = (
      await authInject(projectManagerToken, {
        method: 'POST',
        url: '/api/projects',
        payload: { ...sampleProjectPayload, title: 'مشروع فحص صلاحية النشر' },
      })
    ).json() as { id: number };

    // salesAgent has manageUnits but not manageProjects
    const res = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/projects/${created.id}/publish`,
      payload: { publishStatus: 'published' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects public inquiry against draft or hidden project with 404', async () => {
    const draftRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع استفسار مسودة' },
    });
    const hiddenRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع استفسار مخفي', publishStatus: 'hidden' },
    });
    const publishedRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع استفسار منشور', publishStatus: 'published' },
    });

    const draftId = (draftRes.json() as { id: number }).id;
    const hiddenId = (hiddenRes.json() as { id: number }).id;
    const publishedId = (publishedRes.json() as { id: number }).id;

    // Inquiry against draft project -> 404
    const draftInq = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: { name: 'عميل 1', interestType: 'general', projectId: draftId },
    });
    expect(draftInq.statusCode).toBe(404);
    expect(draftInq.json()).toEqual({ error: 'Project not found' });

    // Inquiry against hidden project -> 404
    const hiddenInq = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: { name: 'عميل 2', interestType: 'general', projectId: hiddenId },
    });
    expect(hiddenInq.statusCode).toBe(404);
    expect(hiddenInq.json()).toEqual({ error: 'Project not found' });

    // Inquiry against non-existent project -> 404
    const nonExistentInq = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: { name: 'عميل 3', interestType: 'general', projectId: 999999 },
    });
    expect(nonExistentInq.statusCode).toBe(404);
    expect(nonExistentInq.json()).toEqual({ error: 'Project not found' });

    // Inquiry against published project -> 201
    const publishedInq = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: { name: 'عميل 4', interestType: 'general', projectId: publishedId },
    });
    expect(publishedInq.statusCode).toBe(201);
  });

  it('does not broadcast unit status updates of unpublished projects to anonymous sockets', async () => {
    // Create draft project with floor
    const projectRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: { ...sampleProjectPayload, title: 'مشروع وحدات مسودة' },
    });
    const projectId = (projectRes.json() as { id: number }).id;

    const floorRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: `/api/projects/${projectId}/floors`,
      payload: { floorNumber: 1, floorNameAr: 'الدور الأرضي' },
    });
    const floorId = (floorRes.json() as { id: number }).id;

    const unitId = `rt-draft-${Date.now().toString(36)}`;
    await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/units',
      payload: {
        floorId,
        id: unitId,
        unitNumber: 'DR-1',
        floorNumber: 1,
        floorNameAr: 'الدور الأرضي',
        type: 'office',
        typeAr: 'مكتب',
        area: 80,
        status: 'available',
      },
    });

    const anonymousSocket = openSocket();
    const adminSocket = openSocket(salesAgentToken);
    await Promise.all([connected(anonymousSocket), connected(adminSocket)]);

    // Wait for sockets to register
    await sleep(200);

    const anonEvents = collect<{ unitId: string; status: string }>(anonymousSocket, 'unit_status_updated');
    const adminEvents = collect<{ unitId: string; status: string }>(adminSocket, 'unit_status_updated');

    const patchRes = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/units/${unitId}/status`,
      payload: { status: 'reserved' },
    });
    expect(patchRes.statusCode).toBe(200);

    await waitFor(() => adminEvents.length > 0, 'admin socket to receive status update');
    await sleep(300);

    expect(adminEvents.some((e) => e.unitId === unitId && e.status === 'reserved')).toBe(true);
    expect(anonEvents.some((e) => e.unitId === unitId)).toBe(false);
  });
});
