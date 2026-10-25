import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

let projectManagerToken: string;
let salesAgentToken: string;

interface FloorDto {
  floorNumber: number;
  floorNameAr: string;
  floorNameEn: string | null;
  units: { id: string; floorNameAr: string; floorNameEn: string | null }[];
}

/** A seeded floor that has units, so the rename has copies to propagate to. */
async function floorWithUnits(): Promise<{ projectId: number; floor: FloorDto }> {
  const res = await inject({ method: 'GET', url: '/api/projects' });
  const projects = res.json() as { id: number; floors: FloorDto[] }[];
  for (const project of projects) {
    const floor = project.floors.find((f) => f.units.length > 0);
    if (floor) return { projectId: project.id, floor };
  }
  throw new Error('seed has no floor with units');
}

beforeAll(async () => {
  await getApp();
  projectManagerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
  salesAgentToken = (await seedSession(SEED_ADMINS.salesAgent)).token;
});

afterAll(async () => {
  await closeApp();
});

describe('Floor rename', () => {
  it('renames the floor and the floor name copied onto its units', async () => {
    const { projectId, floor } = await floorWithUnits();
    const url = `/api/projects/${projectId}/floors/${floor.floorNumber}`;

    const res = await authInject(projectManagerToken, {
      method: 'PUT',
      url,
      payload: { floorNameAr: 'الدور المعاد تسميته', floorNameEn: 'Renamed floor' },
    });
    expect(res.statusCode).toBe(200);

    const after = (await inject({ method: 'GET', url: `/api/projects/${projectId}` })).json() as { floors: FloorDto[] };
    const renamed = after.floors.find((f) => f.floorNumber === floor.floorNumber)!;
    expect(renamed.floorNameAr).toBe('الدور المعاد تسميته');
    expect(renamed.floorNameEn).toBe('Renamed floor');
    expect(renamed.units.length).toBe(floor.units.length);
    for (const unit of renamed.units) {
      expect(unit.floorNameAr).toBe('الدور المعاد تسميته');
      expect(unit.floorNameEn).toBe('Renamed floor');
    }

    // restore
    await authInject(projectManagerToken, {
      method: 'PUT',
      url,
      payload: { floorNameAr: floor.floorNameAr, floorNameEn: floor.floorNameEn ?? undefined },
    });
  });

  it('leaves unit floor names alone when only the description changes', async () => {
    const { projectId, floor } = await floorWithUnits();
    const res = await authInject(projectManagerToken, {
      method: 'PUT',
      url: `/api/projects/${projectId}/floors/${floor.floorNumber}`,
      payload: { descriptionAr: 'وصف جديد' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as FloorDto;
    expect(body.units.every((u) => u.floorNameAr === floor.units[0].floorNameAr)).toBe(true);
  });

  it('requires manageProjects', async () => {
    const { projectId, floor } = await floorWithUnits();
    const res = await authInject(salesAgentToken, {
      method: 'PUT',
      url: `/api/projects/${projectId}/floors/${floor.floorNumber}`,
      payload: { floorNameAr: 'غير مسموح' },
    });
    expect(res.statusCode).toBe(403);
  });
});
