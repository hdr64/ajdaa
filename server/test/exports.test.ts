import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCsv } from '../src/services/csv.js';
import { prisma } from '../src/services/prisma.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  removeUser,
  SEED_ADMINS,
  seedSession,
} from './helpers.js';

let superToken: string;
let draftId: number;
let exportOnlyToken: string;
let usersOnlyToken: string;
const throwaway: string[] = [];

beforeAll(async () => {
  await getApp();
  superToken = (await seedSession(SEED_ADMINS.superAdmin)).token;

  const exportOnly = await createThrowawayUser({ permissions: { exportData: true } });
  const usersOnly = await createThrowawayUser({ permissions: { manageUsers: true } });
  throwaway.push(exportOnly.id, usersOnly.id);
  exportOnlyToken = (await login(exportOnly.email)).token;

  const draft = await prisma.project.create({
    data: { type: 'office', typeAr: 'إداري', title: 'مسودة للتصدير', priceType: 'إيجار', area: 10, city: 'جدة', image: '/x.webp', publishStatus: 'draft' },
  });
  draftId = draft.id;
  usersOnlyToken = (await login(usersOnly.email)).token;
});

afterAll(async () => {
  for (const id of throwaway) await removeUser(id);
  await prisma.project.deleteMany({ where: { id: draftId } });
  await closeApp();
});

const get = (token: string, url: string) => authInject(token, { method: 'GET', url });

/** Rows without the BOM, split on CRLF, trailing empty line dropped. */
const csvLines = (body: string) => body.replace(/^﻿/, '').split('\r\n').filter(Boolean);

describe('buildCsv', () => {
  it('adds a BOM, CRLF lines, escapes cells and neutralises formulas', () => {
    const csv = buildCsv(['a', 'b'], [['x,y', '=SUM(A1)'], [3, null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const lines = csvLines(csv);
    expect(lines[0]).toBe('a,b');
    expect(lines[1]).toContain('"x,y"');
    expect(lines[1]).not.toMatch(/,=SUM/);
    expect(lines[2]).toBe('3,');
  });
});

describe('GET /api/projects/export', () => {
  it('needs exportData', async () => {
    expect((await inject({ method: 'GET', url: '/api/projects/export' })).statusCode).toBe(401);
    expect((await get(usersOnlyToken, '/api/projects/export')).statusCode).toBe(403);
  });

  it('returns every project, drafts included, with unit counts', async () => {
    const response = await get(exportOnlyToken, '/api/projects/export');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toMatch(/attachment; filename="?projects-\d{4}-\d{2}-\d{2}\.csv/);

    const lines = csvLines(response.body);
    expect(lines[0].split(',')).toEqual([
      'id', 'title', 'titleEn', 'type', 'city', 'publishStatus', 'priceType', 'area',
      'unitsTotal', 'unitsAvailable', 'unitsReserved', 'unitsRented', 'unitsSold',
      'lat', 'lng', 'createdAt', 'updatedAt',
    ]);
    const draftRow = lines.find((line) => line.startsWith(`${draftId},`));
    expect(draftRow).toBeDefined();
    expect(draftRow).toContain('draft');
    // Unit counts: the draft has no floors, so every count is 0.
    expect(draftRow!.split(',').slice(8, 13)).toEqual(['0', '0', '0', '0', '0']);
  });
});

describe('GET /api/units/export', () => {
  it('needs exportData and validates projectId', async () => {
    expect((await get(usersOnlyToken, '/api/units/export')).statusCode).toBe(403);
    expect((await get(exportOnlyToken, '/api/units/export?projectId=abc')).statusCode).toBe(400);
  });

  it('lists units, optionally for one project', async () => {
    const all = csvLines((await get(exportOnlyToken, '/api/units/export')).body);
    expect(all[0].split(',').slice(0, 6)).toEqual(['projectId', 'projectTitle', 'floorNumber', 'floorNameAr', 'unitId', 'unitNumber']);
    expect(all.length).toBeGreaterThan(1);

    const firstProjectId = all[1].split(',')[0];
    const one = csvLines((await get(exportOnlyToken, `/api/units/export?projectId=${firstProjectId}`)).body);
    expect(one.length).toBeGreaterThan(1);
    expect(one.slice(1).every((line) => line.split(',')[0] === firstProjectId)).toBe(true);
  });
});

describe('GET /api/auth/users/export', () => {
  it('needs both manageUsers and exportData', async () => {
    expect((await get(exportOnlyToken, '/api/auth/users/export')).statusCode).toBe(403);
    expect((await get(usersOnlyToken, '/api/auth/users/export')).statusCode).toBe(403);
    expect((await get(superToken, '/api/auth/users/export')).statusCode).toBe(200);
  });

  it('never leaks secrets', async () => {
    const body = (await get(superToken, '/api/auth/users/export')).body;
    const header = csvLines(body)[0];
    expect(header).toContain('email');
    expect(body).not.toMatch(/\$2[aby]\$/); // bcrypt hashes
    expect(header).not.toMatch(/password|permissions|preferences|token|otp(?!Enabled)/i);
    expect(body).toContain(SEED_ADMINS.superAdmin);
  });
});
