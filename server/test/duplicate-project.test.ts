import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

let managerToken: string;
let salesToken: string;
let sourceId: number;
const createdIds: number[] = [];

beforeAll(async () => {
  await getApp();
  managerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
  salesToken = (await seedSession(SEED_ADMINS.salesAgent)).token;

  const source = await prisma.project.create({
    data: {
      type: 'commercial',
      typeAr: 'تجاري',
      title: 'مصدر النسخ',
      titleEn: 'Copy Source',
      priceType: 'إيجار',
      area: 1200,
      city: 'الرياض',
      image: '/uploads/seed/ajda1/vera.webp',
      gallery: JSON.stringify(['/uploads/a.webp', '/uploads/b.webp']),
      features: JSON.stringify(['مواقف']),
      lat: 24.7,
      lng: 46.6,
      publishStatus: 'published',
      publishedAt: new Date(),
      floors: {
        create: [
          {
            floorNumber: 0,
            floorNameAr: 'الأرضي',
            units: {
              create: [
                {
                  id: `dup-src-${Date.now()}-1`,
                  unitNumber: '101',
                  floorNumber: 0,
                  floorNameAr: 'الأرضي',
                  type: 'showroom',
                  typeAr: 'معرض تجاري',
                  area: 150,
                  status: 'sold',
                  statusAr: 'مباع',
                  statusEn: 'Sold',
                },
                {
                  id: `dup-src-${Date.now()}-2`,
                  unitNumber: '102',
                  floorNumber: 0,
                  floorNameAr: 'الأرضي',
                  type: 'showroom',
                  typeAr: 'معرض تجاري',
                  area: 90,
                },
              ],
            },
          },
          { floorNumber: 1, floorNameAr: 'الأول', units: { create: [] } },
        ],
      },
    },
  });
  sourceId = source.id;
  createdIds.push(source.id);
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { id: { in: createdIds } } });
  await closeApp();
});

const duplicate = (token: string, id: number | string) =>
  authInject(token, { method: 'POST', url: `/api/projects/${id}/duplicate` });

describe('POST /api/projects/:id/duplicate', () => {
  it('needs manageProjects', async () => {
    expect((await inject({ method: 'POST', url: `/api/projects/${sourceId}/duplicate` })).statusCode).toBe(401);
    expect((await duplicate(salesToken, sourceId)).statusCode).toBe(403);
  });

  it('answers 404 for a missing project and 400 for a bad id', async () => {
    expect((await duplicate(managerToken, 999999)).statusCode).toBe(404);
    expect((await duplicate(managerToken, 'abc')).statusCode).toBe(400);
  });

  it('turns a bad id on any route into 400, not 500', async () => {
    expect((await inject({ method: 'GET', url: '/api/projects/abc' })).statusCode).toBe(400);
  });

  it('copies content, floors and units into a new draft with fresh unit ids and reset statuses', async () => {
    const response = await duplicate(managerToken, sourceId);
    expect(response.statusCode).toBe(201);
    const copy = response.json();
    createdIds.push(copy.id);

    expect(copy.id).not.toBe(sourceId);
    expect(copy.title).toBe('مصدر النسخ (نسخة)');
    expect(copy.titleEn).toBe('Copy Source (copy)');
    expect(copy.publishStatus).toBe('draft');
    expect(copy.area).toBe(1200);
    expect(copy.city).toBe('الرياض');
    expect(copy.gallery).toEqual(['/uploads/a.webp', '/uploads/b.webp']);

    const stored = await prisma.project.findUniqueOrThrow({
      where: { id: copy.id },
      include: { floors: { include: { units: true }, orderBy: { floorNumber: 'asc' } } },
    });
    expect(stored.publishedAt).toBeNull();
    expect(stored.lat).toBe(24.7);
    expect(stored.floors.map((f) => f.floorNameAr)).toEqual(['الأرضي', 'الأول']);

    const units = stored.floors[0].units;
    expect(units.map((u) => u.unitNumber).sort()).toEqual(['101', '102']);
    expect(units.every((u) => u.status === 'available' && u.statusAr === 'متاح')).toBe(true);

    const sourceUnitIds = (
      await prisma.propertyUnit.findMany({ where: { floor: { projectId: sourceId } }, select: { id: true } })
    ).map((u) => u.id);
    expect(units.some((u) => sourceUnitIds.includes(u.id))).toBe(false);
  });

  it('leaves the source untouched and keeps drafts off the public list', async () => {
    const source = await prisma.project.findUniqueOrThrow({
      where: { id: sourceId },
      include: { floors: { include: { units: true } } },
    });
    expect(source.publishStatus).toBe('published');
    expect(source.floors.flatMap((f) => f.units).find((u) => u.unitNumber === '101')?.status).toBe('sold');

    const second = await duplicate(managerToken, sourceId);
    createdIds.push(second.json().id);
    const publicList = (await inject({ method: 'GET', url: '/api/projects' })).json() as { id: number }[];
    expect(publicList.some((p) => p.id === second.json().id)).toBe(false);
  });
});
