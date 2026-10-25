import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { getEffectiveMailSettings, resetMailSettings } from '../src/services/mailSettings.js';
import { SITE_DEFAULTS } from '../src/services/siteSettings.js';
import { loggerService } from '../src/services/loggerService.js';
import { prisma } from '../src/services/prisma.js';
import { caseInsensitiveContains } from '../src/utils/caseInsensitive.js';
import { seedCmsDefaultsIfNeeded } from '../src/services/cmsService.js';
import {
  authInject,
  closeApp,
  getApp,
  inject,
  SEED_ADMINS,
  seedSession,
  type TestSession,
} from './helpers.js';

let superSession: TestSession;
const LOGS_KEY = config.logs.secretKey;

let tempLogDir: string;
let tempLogFile: string;
let tempErrFile: string;
let originalLogFile: string;
let originalErrFile: string;

const partnerIdsToCleanup: string[] = [];

beforeAll(async () => {
  await getApp();
  await seedCmsDefaultsIfNeeded();
  superSession = await seedSession(SEED_ADMINS.superAdmin);

  // Setup temporary log files for H-8 tests without touching real logs
  tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajda-test-hardening-'));
  tempLogFile = path.join(tempLogDir, 'prod.log');
  tempErrFile = path.join(tempLogDir, 'errors.log');

  originalLogFile = (loggerService as unknown as { logFilePath: string }).logFilePath;
  originalErrFile = (loggerService as unknown as { errorLogFilePath: string }).errorLogFilePath;

  (loggerService as unknown as { logFilePath: string }).logFilePath = tempLogFile;
  (loggerService as unknown as { errorLogFilePath: string }).errorLogFilePath = tempErrFile;
});

afterAll(async () => {
  // Restore log paths
  (loggerService as unknown as { logFilePath: string }).logFilePath = originalLogFile;
  (loggerService as unknown as { errorLogFilePath: string }).errorLogFilePath = originalErrFile;

  try {
    fs.rmSync(tempLogDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup error
  }

  // Cleanup CMS clients
  if (partnerIdsToCleanup.length > 0) {
    await prisma.cmsClient.deleteMany({ where: { id: { in: partnerIdsToCleanup } } });
  }

  await closeApp();
});

describe('H-8: Bounded log tail read and lines parameter validation', () => {
  it('reads bounded tail lines from a log file larger than 1 MiB and drops first partial line', async () => {
    // Generate a file > 1 MiB (20,000 lines * ~65 bytes = ~1.3 MB)
    const lineCount = 20000;
    const writeStream = fs.createWriteStream(tempLogFile, { encoding: 'utf-8' });
    for (let i = 0; i < lineCount; i++) {
      writeStream.write(`[2026-10-25T12:00:00.000Z] [INFO] [app] Log line number ${i}\n`);
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });

    const stat = fs.statSync(tempLogFile);
    expect(stat.size).toBeGreaterThan(1024 * 1024);

    // Read last 10 lines
    const rawTail = await loggerService.getRawFileContent(10);
    const lines = rawTail.split('\n');
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe(`[2026-10-25T12:00:00.000Z] [INFO] [app] Log line number ${lineCount - 10}`);
    expect(lines[9]).toBe(`[2026-10-25T12:00:00.000Z] [INFO] [app] Log line number ${lineCount - 1}`);

    // Verify first partial line is dropped when reading all tail lines
    const allTail = await loggerService.getRawFileContent(50000);
    const allTailLines = allTail.split('\n');
    expect(allTailLines.length).toBeGreaterThan(0);
    expect(allTailLines[0].startsWith('[2026-')).toBe(true);
  });

  it('validates lines query param on /api/logs/raw and /api/logs/errors (rejects 0, 5001, abc with 400)', async () => {
    // Create an errors.log entry so the error file exists
    fs.writeFileSync(tempErrFile, '[2026-10-25T12:00:00.000Z] [ERROR] [app] Sample error\n', 'utf-8');

    const headers = { 'x-logs-key': LOGS_KEY };

    // /api/logs/raw
    for (const badLines of ['0', '5001', 'abc']) {
      const res = await authInject(superSession.token, {
        method: 'GET',
        url: `/api/logs/raw?lines=${badLines}`,
        headers,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'Invalid lines value' });
    }

    // /api/logs/errors
    for (const badLines of ['0', '5001', 'abc']) {
      const res = await authInject(superSession.token, {
        method: 'GET',
        url: `/api/logs/errors?lines=${badLines}`,
        headers,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'Invalid lines value' });
    }

    // Valid lines value succeeds
    const rawOk = await authInject(superSession.token, {
      method: 'GET',
      url: '/api/logs/raw?lines=5',
      headers,
    });
    expect(rawOk.statusCode).toBe(200);
    expect(rawOk.headers['content-type']).toContain('text/plain');

    const errOk = await authInject(superSession.token, {
      method: 'GET',
      url: '/api/logs/errors?lines=5',
      headers,
    });
    expect(errOk.statusCode).toBe(200);
    expect(errOk.headers['content-type']).toContain('text/plain');
  });
});

describe('H-9: Client error endpoint log forgery and field override guards', () => {
  it('strips CR/LF from message and stack, restricts source, and prevents context from overriding ip/userAgent/url', async () => {
    const maliciousPayload = {
      message: 'Uncaught error occurred\r\n[2026-10-25T00:00:00.000Z] [ERROR] [system] Forged database failure\nThird line of error',
      source: 'attacker<script>!@#$%^&*()_frontend-client',
      stack: 'Error: boom\r\n  at run (evil.js:1:1)\n  at test (evil.js:2:2)',
      context: {
        ip: '10.99.99.99',
        userAgent: 'ForgedUserAgent/1.0',
        url: '/forged-path?secret=stolen',
        legitimateData: 'retained',
      },
    };

    const response = await inject({
      method: 'POST',
      url: '/api/logs/client-error',
      payload: maliciousPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, recorded: true });

    // Inspect the logged error entry from buffer
    const recentLogs = await loggerService.getLogs({ source: 'buffer', limit: 50 });
    const clientEntry = recentLogs.entries.find((e) => e.message.includes('Uncaught error occurred'));

    expect(clientEntry).toBeDefined();

    // 1. Single line: CR/LF are replaced with space
    expect(clientEntry!.message).not.toContain('\r');
    expect(clientEntry!.message).not.toContain('\n');
    expect(clientEntry!.message).toBe(
      'Client error reported: Uncaught error occurred [2026-10-25T00:00:00.000Z] [ERROR] [system] Forged database failure Third line of error'
    );

    // 2. Safe source: only [A-Za-z0-9_-] characters remain
    expect(clientEntry!.source).toBe('attackerscript_frontend-client');

    // 3. Context cannot override trusted values
    expect(clientEntry!.context).toBeDefined();
    expect(clientEntry!.context!.ip).not.toBe('10.99.99.99');
    expect(clientEntry!.context!.userAgent).not.toBe('ForgedUserAgent/1.0');
    expect(clientEntry!.context!.legitimateData).toBe('retained');
    expect(clientEntry!.context!.stack).not.toContain('\r');
    expect(clientEntry!.context!.stack).not.toContain('\n');
  });
});

describe('M-2: Concurrent CMS section updates', () => {
  it('handles two concurrent PUT /api/cms/content/:key calls safely with either consecutive versions or 409 conflict', async () => {
    // Fetch initial contact section content
    const initial = await inject({
      method: 'GET',
      url: '/api/cms/content/contact',
    });
    expect(initial.statusCode).toBe(200);
    const initialData = (initial.json() as { content: Record<string, unknown> }).content;

    const payloadA = { ...initialData, formTitleEn: 'Inquire Now (Concurrent A)' };
    const payloadB = { ...initialData, formTitleEn: 'Inquire Now (Concurrent B)' };

    // Fire two concurrent updates
    const [resA, resB] = await Promise.all([
      authInject(superSession.token, {
        method: 'PUT',
        url: '/api/cms/content/contact',
        payload: payloadA,
      }),
      authInject(superSession.token, {
        method: 'PUT',
        url: '/api/cms/content/contact',
        payload: payloadB,
      }),
    ]);

    // Neither request must fail with 400 containing a raw Prisma error
    expect(resA.statusCode).not.toBe(400);
    expect(resB.statusCode).not.toBe(400);
    expect(resA.body).not.toContain('Prisma');
    expect(resB.body).not.toContain('Prisma');
    expect(resA.body).not.toContain('Unique constraint');
    expect(resB.body).not.toContain('Unique constraint');

    const statuses = [resA.statusCode, resB.statusCode];

    if (statuses.includes(409)) {
      // One 200 and one 409
      expect(statuses).toEqual(expect.arrayContaining([200, 409]));
      const conflictRes = resA.statusCode === 409 ? resA : resB;
      expect(conflictRes.json()).toEqual({
        error: 'A concurrent edit conflict occurred; please retry.',
      });
    } else {
      // Both 200 with consecutive versions (SQLite transaction serialized)
      expect(resA.statusCode).toBe(200);
      expect(resB.statusCode).toBe(200);
      const vA = (resA.json() as { version: number }).version;
      const vB = (resB.json() as { version: number }).version;
      expect(vA).not.toBe(vB);
      expect(Math.abs(vA - vB)).toBe(1);
    }
  });
});

describe('M-8: Case-insensitive contains helper query shape', () => {
  it('returns query without mode for file: datasource and with mode insensitive for postgresql datasource', () => {
    const sqliteFilter = caseInsensitiveContains('file:./dev.db', 'search-term');
    expect(sqliteFilter).toEqual({ contains: 'search-term' });
    expect('mode' in sqliteFilter).toBe(false);

    const postgresqlFilter = caseInsensitiveContains(
      'postgresql://user:pass@localhost:5432/ajda_db',
      'search-term'
    );
    expect(postgresqlFilter).toEqual({ contains: 'search-term', mode: 'insensitive' });

    const postgresFilter = caseInsensitiveContains(
      'postgres://user:pass@localhost:5432/ajda_db',
      'search-term'
    );
    expect(postgresFilter).toEqual({ contains: 'search-term', mode: 'insensitive' });
  });
});

describe('M-14: CMS partner order and visible fallbacks', () => {
  it('partner create without order gets max + 1; update without visible leaves hidden partner hidden', async () => {
    // 1. Create a baseline partner with explicit order 10
    const partner1Res = await authInject(superSession.token, {
      method: 'POST',
      url: '/api/cms/clients',
      payload: {
        nameAr: 'شريك الأساس',
        nameEn: 'Base Partner',
        sectorAr: 'عقارات',
        sectorEn: 'Real Estate',
        descAr: 'وصف الشريك',
        descEn: 'Partner description',
        logo: '/uploads/base-logo.png',
        tagsAr: ['عقارات'],
        tagsEn: ['Real Estate'],
        order: 10,
        visible: false,
      },
    });
    expect(partner1Res.statusCode).toBe(201);
    const partner1 = partner1Res.json() as { id: string; order: number; visible: boolean };
    partnerIdsToCleanup.push(partner1.id);
    expect(partner1.order).toBe(10);
    expect(partner1.visible).toBe(false);

    // 2. Create partner 2 without order: must get max + 1 (>= 11)
    const partner2Res = await authInject(superSession.token, {
      method: 'POST',
      url: '/api/cms/clients',
      payload: {
        nameAr: 'شريك ثان',
        nameEn: 'Second Partner',
        sectorAr: 'تطوير',
        sectorEn: 'Development',
        descAr: 'وصف شريك ثان',
        descEn: 'Second description',
        logo: '/uploads/second-logo.png',
        tagsAr: ['تطوير'],
        tagsEn: ['Development'],
      },
    });
    expect(partner2Res.statusCode).toBe(201);
    const partner2 = partner2Res.json() as { id: string; order: number; visible: boolean };
    partnerIdsToCleanup.push(partner2.id);
    expect(partner2.order).toBeGreaterThanOrEqual(11);
    expect(partner2.visible).toBe(true);

    // 3. Update partner 1 (hidden) without visible field: must stay hidden!
    const updateRes = await authInject(superSession.token, {
      method: 'PUT',
      url: `/api/cms/clients/${partner1.id}`,
      payload: {
        nameAr: 'شريك الأساس المحدث',
        nameEn: 'Base Partner Updated',
        sectorAr: 'عقارات',
        sectorEn: 'Real Estate',
        descAr: 'وصف محدث',
        descEn: 'Updated description',
        logo: '/uploads/base-logo.png',
        tagsAr: ['عقارات'],
        tagsEn: ['Real Estate'],
        // visible omitted!
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedPartner1 = updateRes.json() as { id: string; visible: boolean };
    expect(updatedPartner1.visible).toBe(false);
  });
});

describe('M-20: Corrupt settings row fallback to defaults', () => {
  it('returns defaults when site settings row is corrupt (GET /api/settings/site)', async () => {
    // Invalidate cached site settings and store corrupt JSON string
    await prisma.appSetting.upsert({
      where: { key: 'site' },
      create: { key: 'site', value: 'Corrupt JSON {not valid' },
      update: { value: 'Corrupt JSON {not valid' },
    });

    const response = await inject({
      method: 'GET',
      url: '/api/settings/site',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as typeof SITE_DEFAULTS;
    expect(body.phone).toBe(SITE_DEFAULTS.phone);
    expect(body.whatsapp).toBe(SITE_DEFAULTS.whatsapp);
    expect(body.socials).toEqual(SITE_DEFAULTS.socials);
  });

  it('returns env defaults when mail settings row is corrupt (getEffectiveMailSettings)', async () => {
    await resetMailSettings();

    // Store corrupt JSON string in mail settings
    await prisma.appSetting.upsert({
      where: { key: 'mail' },
      create: { key: 'mail', value: 'Corrupt JSON {not valid' },
      update: { value: 'Corrupt JSON {not valid' },
    });

    const effective = await getEffectiveMailSettings();
    expect(effective).toBeDefined();
    expect(effective.source).toBe('env');
    expect(effective.host).toBe(config.mail.host);
  });
});
