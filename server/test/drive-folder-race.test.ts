import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { ensureFolderPath } from '../src/services/driveService.js';
import { closeApp, getApp } from './helpers.js';

/** Unique names keep this file independent of whatever other Drive tests left behind. */
const tag = crypto.randomBytes(4).toString('hex');
const A = `RaceA-${tag}`;
const B = `RaceB-${tag}`;
const C = `RaceC-${tag}`;

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  // Children go with their parent (cascade).
  await prisma.driveFolder.deleteMany({ where: { name: { in: [A, B, C] }, parentId: null } });
  await closeApp();
});

describe('drive: concurrent folder creation (folder upload)', () => {
  it('ten parallel ensureFolderPath calls share one folder per path segment', async () => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => ensureFolderPath(null, [A, B])));

    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBeTruthy();
    expect(await prisma.driveFolder.count({ where: { name: A, parentId: null } })).toBe(1);
    const top = await prisma.driveFolder.findFirstOrThrow({ where: { name: A, parentId: null } });
    expect(await prisma.driveFolder.count({ where: { name: B, parentId: top.id } })).toBe(1);
    expect(ids[0]).toBe((await prisma.driveFolder.findFirstOrThrow({ where: { name: B, parentId: top.id } })).id);
  });

  it('parallel calls with different paths below a shared parent still work', async () => {
    const paths = [[A, B, C], [A, B], [A, C], [A, B, C]];
    const ids = await Promise.all(paths.map((p) => ensureFolderPath(null, p)));

    expect(ids[0]).toBe(ids[3]);
    expect(new Set(ids).size).toBe(3);
    expect(await prisma.driveFolder.count({ where: { name: A, parentId: null } })).toBe(1);
    const top = await prisma.driveFolder.findFirstOrThrow({ where: { name: A, parentId: null } });
    expect(await prisma.driveFolder.count({ where: { parentId: top.id, name: { in: [B, C] } } })).toBe(2);
  });

  it('a failed creation does not poison later calls', async () => {
    await expect(ensureFolderPath(null, ['bad/name'])).rejects.toMatchObject({ statusCode: 400 });
    await expect(ensureFolderPath(null, [`ok-${tag}`])).resolves.toBeTruthy();
    await prisma.driveFolder.deleteMany({ where: { name: `ok-${tag}` } });
  });
});
