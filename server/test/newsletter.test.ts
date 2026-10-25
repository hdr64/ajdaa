import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';
import { prisma } from '../src/services/prisma.js';

let salesAgentToken: string;
let viewerToken: string;

beforeAll(async () => {
  await getApp();
  salesAgentToken = (await seedSession(SEED_ADMINS.salesAgent)).token;
  viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;
});

afterAll(async () => {
  await closeApp();
});

describe('Newsletter API (/api/newsletter)', () => {
  it('public subscribe new + duplicate (both 200, one row)', async () => {
    const email = 'subscriber.test@ajdaa.test';

    // 1. Initial subscribe -> 200, { subscribed: true }
    const res1 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: {
        email,
        locale: 'ar',
        source: 'footer',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ subscribed: true });

    // 2. Duplicate subscribe -> 200, { subscribed: true } (idempotent, does not reveal existence)
    const res2 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: {
        email,
        locale: 'en',
        source: 'modal',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ subscribed: true });

    // 3. Database verification: exactly one row exists
    const rows = await prisma.newsletterSubscriber.findMany({
      where: { email },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(email);
  });

  it('rejects invalid email with 400', async () => {
    // Malformed email
    const res1 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: { email: 'not-an-email' },
    });
    expect(res1.statusCode).toBe(400);

    // Empty email
    const res2 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: { email: '' },
    });
    expect(res2.statusCode).toBe(400);

    // Missing email
    const res3 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: {},
    });
    expect(res3.statusCode).toBe(400);

    // Invalid locale
    const res4 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: { email: 'valid@example.com', locale: 'fr' },
    });
    expect(res4.statusCode).toBe(400);

    // Source longer than 40 chars
    const res5 = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: { email: 'valid@example.com', source: 'a'.repeat(45) },
    });
    expect(res5.statusCode).toBe(400);
  });

  it('normalises email to lowercase and trims whitespace', async () => {
    const rawEmail = '   MiXeD.CaSe@ExAmPlE.CoM   ';
    const normalised = 'mixed.case@example.com';

    const res = await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: { email: rawEmail, locale: 'en' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ subscribed: true });

    const found = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalised },
    });
    expect(found).not.toBeNull();
    expect(found?.email).toBe(normalised);

    const notFoundRaw = await prisma.newsletterSubscriber.findUnique({
      where: { email: rawEmail },
    });
    expect(notFoundRaw).toBeNull();
  });

  it('enforces permissions on list: 401 anon / 403 without exportData / 200 with it', async () => {
    // 401 Anonymous
    const anonRes = await inject({
      method: 'GET',
      url: '/api/newsletter',
    });
    expect(anonRes.statusCode).toBe(401);

    // 403 Without exportData (salesAgent has viewInquiries but exportData: false)
    const forbiddenRes = await authInject(salesAgentToken, {
      method: 'GET',
      url: '/api/newsletter',
    });
    expect(forbiddenRes.statusCode).toBe(403);

    // 200 With exportData (viewer has exportData: true)
    const okRes = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/newsletter',
    });
    expect(okRes.statusCode).toBe(200);
    const subscribers = okRes.json() as { id: string; email: string; createdAt: string }[];
    expect(Array.isArray(subscribers)).toBe(true);

    // Verify ordering: newest first
    for (let i = 0; i < subscribers.length - 1; i++) {
      const current = new Date(subscribers[i].createdAt).getTime();
      const next = new Date(subscribers[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }

    // Substring search with ?q=
    const uniqueEmail = `search-${Date.now()}@target-domain.test`;
    await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: { email: uniqueEmail },
    });

    const searchRes = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/newsletter',
      query: { q: 'target-domain' },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchResults = searchRes.json() as { email: string }[];
    expect(searchResults.some((s) => s.email === uniqueEmail)).toBe(true);

    // Case-insensitive query test
    const searchUpperRes = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/newsletter',
      query: { q: 'TARGET-DOMAIN' },
    });
    expect(searchUpperRes.statusCode).toBe(200);
    const searchUpperResults = searchUpperRes.json() as { email: string }[];
    expect(searchUpperResults.some((s) => s.email === uniqueEmail)).toBe(true);
  });

  it('export has BOM + header + escaped formula cell', async () => {
    // 401 Anonymous
    const anonRes = await inject({
      method: 'GET',
      url: '/api/newsletter/export',
    });
    expect(anonRes.statusCode).toBe(401);

    // 403 Without exportData
    const forbiddenRes = await authInject(salesAgentToken, {
      method: 'GET',
      url: '/api/newsletter/export',
    });
    expect(forbiddenRes.statusCode).toBe(403);

    // Subscribe with formula injection attempt in source
    const formulaEmail = `formula-${Date.now()}@ajdaa.test`;
    await inject({
      method: 'POST',
      url: '/api/newsletter',
      payload: {
        email: formulaEmail,
        locale: 'en',
        source: '=SUM(1,2)',
      },
    });

    // 200 With exportData
    const exportRes = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/newsletter/export',
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.headers['content-type']).toContain('charset=utf-8');
    expect(exportRes.headers['content-disposition']).toMatch(
      /^attachment; filename="newsletter-\d{4}-\d{2}-\d{2}\.csv"$/
    );

    const body = exportRes.body;

    // Must start with UTF-8 BOM
    expect(body.startsWith('\uFEFF')).toBe(true);

    const stripped = body.slice(1);
    const lines = stripped.split(/\r?\n/).filter(Boolean);

    // Header row check
    expect(lines[0]).toBe('email,locale,source,createdAt');

    // Formula injection cell defense check: prefix with single quote
    expect(body).toContain("'=SUM(1,2)");
  });

  it('delete 200 then 404', async () => {
    // Create subscriber to delete
    const sub = await prisma.newsletterSubscriber.create({
      data: {
        email: `to-delete-${Date.now()}@ajdaa.test`,
        locale: 'ar',
        source: 'footer',
      },
    });

    // 401 Anonymous
    const anonDel = await inject({
      method: 'DELETE',
      url: `/api/newsletter/${sub.id}`,
    });
    expect(anonDel.statusCode).toBe(401);

    // 403 Without exportData
    const forbiddenDel = await authInject(salesAgentToken, {
      method: 'DELETE',
      url: `/api/newsletter/${sub.id}`,
    });
    expect(forbiddenDel.statusCode).toBe(403);

    // 200 With exportData
    const okDel = await authInject(viewerToken, {
      method: 'DELETE',
      url: `/api/newsletter/${sub.id}`,
    });
    expect(okDel.statusCode).toBe(200);
    expect(okDel.json()).toEqual({ success: true });

    // 404 Subsequent delete
    const notFoundDel = await authInject(viewerToken, {
      method: 'DELETE',
      url: `/api/newsletter/${sub.id}`,
    });
    expect(notFoundDel.statusCode).toBe(404);

    // Confirm deleted in DB
    const found = await prisma.newsletterSubscriber.findUnique({
      where: { id: sub.id },
    });
    expect(found).toBeNull();
  });
});
