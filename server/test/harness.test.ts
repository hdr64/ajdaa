import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { closeApp, getApp, SEED_ADMINS, seedSession } from './helpers.js';
import { requireTestEnvironment, tempRootFromDatabaseUrl, TEMP_DIR_PREFIX } from './env.js';

afterAll(async () => {
  await closeApp();
});

describe('test harness isolation', () => {
  it('runs the workers against the temp database injected by the config, not the dev database', () => {
    const env = requireTestEnvironment();

    expect(env.DATABASE_URL.startsWith('file:')).toBe(true);
    expect(env.DATABASE_URL).toContain(TEMP_DIR_PREFIX);
    expect(path.normalize(env.UPLOAD_DIR)).toContain(TEMP_DIR_PREFIX);
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(16);

    // The app resolved the very same values, which proves the env reached the
    // module graph of `src/` and not just `process.env`.
    expect(config.databaseUrl).toBe(env.DATABASE_URL);
    expect(config.uploadDir).toBe(path.resolve(env.UPLOAD_DIR));
    expect(config.jwtSecret).toBe(env.JWT_SECRET);
    expect(config.env).toBe('test');
  });

  it('never resolves the DATABASE_URL or UPLOAD_DIR of prisma/dev.db', () => {
    const serverRoot = path.resolve(process.cwd());
    const devDb = path.join(serverRoot, 'prisma', 'dev.db');
    const tempRoot = tempRootFromDatabaseUrl(requireTestEnvironment().DATABASE_URL);

    expect(tempRoot).not.toBe(path.dirname(devDb));
    expect(config.uploadDir.startsWith(tempRoot + path.sep)).toBe(true);
    expect(config.databaseUrl).not.toContain('dev.db');
  });

  it('has a seeded database that matches the fixtures the suite relies on', async () => {
    const admins = await prisma.adminUser.findMany({
      where: { email: { in: Object.values(SEED_ADMINS) } },
      orderBy: { email: 'asc' },
    });

    expect(admins).toHaveLength(4);

    const byEmail = new Map(admins.map((admin) => [admin.email, admin]));
    const expectRole = (email: string, role: string) => {
      const admin = byEmail.get(email);
      expect(admin, `seeded admin ${email} is missing`).toBeDefined();
      expect(admin?.role).toBe(role);
      expect(admin?.status).toBe('active');
    };

    expectRole(SEED_ADMINS.superAdmin, 'super_admin');
    expectRole(SEED_ADMINS.projectManager, 'project_manager');
    expectRole(SEED_ADMINS.salesAgent, 'sales_agent');
    expectRole(SEED_ADMINS.viewer, 'viewer');

    const permissions = JSON.parse(byEmail.get(SEED_ADMINS.projectManager)?.permissions ?? '{}');
    expect(permissions.manageUsers).toBe(false);
    expect(permissions.manageProjects).toBe(true);
  });

  it('accepts the seeded credentials for every fixture account', async () => {
    await getApp();
    for (const email of Object.values(SEED_ADMINS)) {
      const session = await seedSession(email);
      expect(session.token.split('.')).toHaveLength(3);
      expect(session.email).toBe(email);
    }
  });
});
