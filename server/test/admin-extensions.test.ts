import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

let superAdminToken: string;
let projectManagerToken: string;
let salesAgentToken: string;
let viewerToken: string;

beforeAll(async () => {
  await getApp();
  superAdminToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  projectManagerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
  salesAgentToken = (await seedSession(SEED_ADMINS.salesAgent)).token;
  viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;
});

afterAll(async () => {
  await closeApp();
});

describe('Project brochureUrl', () => {
  it('round-trips brochureUrl on project creation, retrieval, and update', async () => {
    // 1. Create project with brochureUrl
    const createRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/projects',
      payload: {
        type: 'commercial',
        typeAr: 'تجاري',
        title: 'برج البروشور التجاري',
        priceType: 'بيع',
        area: 2500,
        city: 'الرياض',
        image: '/uploads/brochure-test.webp',
        brochureUrl: 'https://example.com/docs/brochure.pdf',
        publishStatus: 'published',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: number; brochureUrl: string | null };
    expect(created.brochureUrl).toBe('https://example.com/docs/brochure.pdf');

    // 2. Fetch project by ID
    const getRes = await inject({
      method: 'GET',
      url: `/api/projects/${created.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = getRes.json() as { id: number; brochureUrl: string | null };
    expect(fetched.brochureUrl).toBe('https://example.com/docs/brochure.pdf');

    // 3. Update project brochureUrl
    const updateRes = await authInject(projectManagerToken, {
      method: 'PUT',
      url: `/api/projects/${created.id}`,
      payload: {
        type: 'commercial',
        typeAr: 'تجاري',
        title: 'برج البروشور التجاري (محدث)',
        priceType: 'بيع',
        area: 2500,
        city: 'الرياض',
        image: '/uploads/brochure-test.webp',
        brochureUrl: 'https://example.com/docs/brochure-v2.pdf',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().brochureUrl).toBe('https://example.com/docs/brochure-v2.pdf');

    // 4. Clear brochureUrl to null
    const clearRes = await authInject(projectManagerToken, {
      method: 'PUT',
      url: `/api/projects/${created.id}`,
      payload: {
        type: 'commercial',
        typeAr: 'تجاري',
        title: 'برج البروشور التجاري (محدث)',
        priceType: 'بيع',
        area: 2500,
        city: 'الرياض',
        image: '/uploads/brochure-test.webp',
        brochureUrl: null,
      },
    });
    expect(clearRes.statusCode).toBe(200);
    expect(clearRes.json().brochureUrl).toBeNull();
  });
});

describe('Inquiry notes & status update (PATCH /api/inquiries/:id)', () => {
  it('updates notes and status and preserves existing fields', async () => {
    // Create an inquiry
    const createRes = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'سارة خالد',
        phone: '0555555555',
        email: 'sara@example.com',
        interestType: 'rent',
        message: 'مهتمة بالاستئجار في البرج',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const inquiry = createRes.json() as { id: string; status: string; notes: string | null };
    expect(inquiry.status).toBe('new');
    expect(inquiry.notes).toBeNull();

    // Update notes & status as salesAgent (has viewInquiries)
    const patchRes = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/inquiries/${inquiry.id}`,
      payload: {
        notes: 'تم التواصل هاتفياً وطلب موعد زيارة',
        status: 'contacted',
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = patchRes.json() as {
      status: string;
      statusAr: string;
      notes: string;
      updatedAt: string;
    };
    expect(patched.status).toBe('contacted');
    expect(patched.statusAr).toBe('تم التواصل');
    expect(patched.notes).toBe('تم التواصل هاتفياً وطلب موعد زيارة');
    expect(patched.updatedAt).toBeDefined();

    // Update only notes
    const notesOnlyRes = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/inquiries/${inquiry.id}`,
      payload: { notes: 'ملاحظة محدثة فقط' },
    });
    expect(notesOnlyRes.statusCode).toBe(200);
    expect(notesOnlyRes.json().notes).toBe('ملاحظة محدثة فقط');
    expect(notesOnlyRes.json().status).toBe('contacted');

    // Existing legacy /:id/status endpoint still works
    const legacyStatusRes = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/inquiries/${inquiry.id}/status`,
      payload: { status: 'closed' },
    });
    expect(legacyStatusRes.statusCode).toBe(200);
    expect(legacyStatusRes.json().status).toBe('closed');
    expect(legacyStatusRes.json().statusAr).toBe('مغلق');

    // 400 when neither notes nor status provided
    const emptyPatchRes = await authInject(salesAgentToken, {
      method: 'PATCH',
      url: `/api/inquiries/${inquiry.id}`,
      payload: {},
    });
    expect(emptyPatchRes.statusCode).toBe(400);

    // 401 unauthenticated
    const anonPatchRes = await inject({
      method: 'PATCH',
      url: `/api/inquiries/${inquiry.id}`,
      payload: { notes: 'unauthenticated attempt' },
    });
    expect(anonPatchRes.statusCode).toBe(401);
  });
});

describe('Inquiry deletion (DELETE /api/inquiries/:id)', () => {
  it('allows super_admin only and returns 403 for non-super admins', async () => {
    // Create inquiry
    const createRes = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'عميل للحذف',
        interestType: 'general',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const inqId = (createRes.json() as { id: string }).id;

    // salesAgent (non-super admin) -> 403
    const salesAgentDel = await authInject(salesAgentToken, {
      method: 'DELETE',
      url: `/api/inquiries/${inqId}`,
    });
    expect(salesAgentDel.statusCode).toBe(403);

    // projectManager (non-super admin) -> 403
    const pmDel = await authInject(projectManagerToken, {
      method: 'DELETE',
      url: `/api/inquiries/${inqId}`,
    });
    expect(pmDel.statusCode).toBe(403);

    // super_admin -> 200 or 204
    const superAdminDel = await authInject(superAdminToken, {
      method: 'DELETE',
      url: `/api/inquiries/${inqId}`,
    });
    expect([200, 204]).toContain(superAdminDel.statusCode);

    // 404 on deleting a missing inquiry
    const notFoundDel = await authInject(superAdminToken, {
      method: 'DELETE',
      url: `/api/inquiries/${inqId}`,
    });
    expect(notFoundDel.statusCode).toBe(404);
  });
});

describe('Inquiry CSV export (GET /api/inquiries/export)', () => {
  it('enforces auth and exportData permission', async () => {
    // 401 anonymous
    const anonRes = await inject({
      method: 'GET',
      url: '/api/inquiries/export',
    });
    expect(anonRes.statusCode).toBe(401);

    // 403 without exportData (salesAgent has exportData: false)
    const forbiddenRes = await authInject(salesAgentToken, {
      method: 'GET',
      url: '/api/inquiries/export',
    });
    expect(forbiddenRes.statusCode).toBe(403);
  });

  it('returns 200 with BOM, header row, formula injection escaped, and quoted comma cell', async () => {
    // Create an inquiry with formula injection starting character: =SUM(1,2)
    const injectionInq = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: '=SUM(1,2)',
        phone: '+966500000000',
        interestType: 'rent',
        message: '@formula',
      },
    });
    expect(injectionInq.statusCode).toBe(201);

    // Create an inquiry with comma and quote
    const commaInq = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'علي أحمد',
        interestType: 'buy',
        message: 'ملاحظة مهمة, تحتوي على "علامات تنصيص"',
      },
    });
    expect(commaInq.statusCode).toBe(201);

    // Fetch export as viewer (has exportData permission)
    const exportRes = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/inquiries/export',
    });

    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.headers['content-type']).toContain('charset=utf-8');
    expect(exportRes.headers['content-disposition']).toMatch(/^attachment; filename="inquiries-\d{4}-\d{2}-\d{2}\.csv"$/);

    const body = exportRes.body;

    // Must start with UTF-8 BOM
    expect(body.startsWith('\uFEFF')).toBe(true);

    const stripped = body.slice(1);
    const lines = stripped.split(/\r?\n/).filter(Boolean);

    // Header row check
    expect(lines[0]).toBe('createdAt,name,phone,email,projectTitle,unitNumber,interestTypeAr,status,message,notes');

    // Formula injection cell defense check: prefix with single quote
    expect(body).toContain("'=SUM(1,2)");
    expect(body).toContain("'+966500000000");
    expect(body).toContain("'@formula");

    // RFC 4180 quoting for cell with comma and quotes
    expect(body).toContain('"ملاحظة مهمة, تحتوي على ""علامات تنصيص"""');
  });
});

describe('Categories API (/api/categories)', () => {
  it('public GET returns 5 seeded categories including cat-hotel, sorted by id', async () => {
    const res = await inject({
      method: 'GET',
      url: '/api/categories',
    });

    expect(res.statusCode).toBe(200);
    const categories = res.json() as { id: string; nameAr: string; nameEn: string; type: string; tags: string[] }[];
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThanOrEqual(5);

    const hotel = categories.find((c) => c.id === 'cat-hotel');
    expect(hotel).toBeDefined();
    expect(hotel?.type).toBe('hotel');
    expect(hotel?.nameAr).toBe('فنادق وأجنحة فندقية');
    expect(Array.isArray(hotel?.tags)).toBe(true);

    // Verify sorted by id
    const ids = categories.map((c) => c.id);
    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
  });

  it('enforces manageProjects permission on POST, PUT, DELETE', async () => {
    // salesAgent has manageProjects: false
    const postRes = await authInject(salesAgentToken, {
      method: 'POST',
      url: '/api/categories',
      payload: {
        nameAr: 'فئة غير مصرحة',
        nameEn: 'Unauthorized Cat',
        type: 'commercial',
        tags: ['tag'],
      },
    });
    expect(postRes.statusCode).toBe(403);

    const putRes = await authInject(salesAgentToken, {
      method: 'PUT',
      url: '/api/categories/cat-hotel',
      payload: {
        nameAr: 'تعديل غير مصرح',
        nameEn: 'Unauthorized Edit',
        type: 'hotel',
        tags: ['tag'],
      },
    });
    expect(putRes.statusCode).toBe(403);

    const delRes = await authInject(salesAgentToken, {
      method: 'DELETE',
      url: '/api/categories/cat-hotel',
    });
    expect(delRes.statusCode).toBe(403);
  });

  it('rejects invalid category type with 400', async () => {
    const res = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/categories',
      payload: {
        nameAr: 'فئة بنوع غير صالح',
        nameEn: 'Invalid Type Category',
        type: 'industrial', // Not in commercial|office|logistics|residential|hotel
        tags: ['tag'],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates, updates, and deletes categories with manageProjects', async () => {
    // Duplicate id -> 409
    const dupRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/categories',
      payload: {
        id: 'cat-hotel',
        nameAr: 'فندق مكرر',
        nameEn: 'Duplicate Hotel',
        type: 'hotel',
        tags: ['tag'],
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // Create with custom id, trimmed and deduplicated tags
    const createRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/categories',
      payload: {
        id: 'cat-retail-hub',
        nameAr: 'مراكز التجزئة',
        nameEn: 'Retail Hubs',
        type: 'commercial',
        tags: ['  متاجر  ', 'متاجر', 'تسوق ', 'مطاعم'],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      id: string;
      nameAr: string;
      nameEn: string;
      type: string;
      tags: string[];
    };
    expect(created.id).toBe('cat-retail-hub');
    expect(created.nameAr).toBe('مراكز التجزئة');
    expect(created.type).toBe('commercial');
    expect(created.tags).toEqual(['متاجر', 'تسوق', 'مطاعم']);

    // Create without id -> generates cat-<random>
    const autoGenRes = await authInject(projectManagerToken, {
      method: 'POST',
      url: '/api/categories',
      payload: {
        nameAr: 'مستودعات ذكية',
        nameEn: 'Smart Warehouses',
        type: 'logistics',
        tags: ['أتمتة', 'لوجستيات'],
      },
    });
    expect(autoGenRes.statusCode).toBe(201);
    const autoGen = autoGenRes.json() as { id: string };
    expect(autoGen.id).toMatch(/^cat-[a-z0-9-]+$/);

    // Update category
    const updateRes = await authInject(projectManagerToken, {
      method: 'PUT',
      url: '/api/categories/cat-retail-hub',
      payload: {
        nameAr: 'مراكز التجزئة والترفيه',
        nameEn: 'Retail & Entertainment Hubs',
        type: 'commercial',
        tags: ['ترفيه', 'سينما'],
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json() as { nameAr: string; tags: string[] };
    expect(updated.nameAr).toBe('مراكز التجزئة والترفيه');
    expect(updated.tags).toEqual(['ترفيه', 'سينما']);

    // Delete category
    const delRes = await authInject(projectManagerToken, {
      method: 'DELETE',
      url: '/api/categories/cat-retail-hub',
    });
    expect(delRes.statusCode).toBe(200);

    // Subsequent delete returns 404
    const notFoundRes = await authInject(projectManagerToken, {
      method: 'DELETE',
      url: '/api/categories/cat-retail-hub',
    });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
