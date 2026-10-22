import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { config } from '../src/config/env.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { clearCareersFormConfigCache } from '../src/services/careersSettings.js';
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
  sleep,
  THROWAWAY_PASSWORD,
} from './helpers.js';

const SETTING_KEYS = ['careers.form', 'careers.notifications', 'notifications', 'notifications.job_application'];

interface MultipartPart {
  name: string;
  value?: string;
  filename?: string;
  contentType?: string;
  data?: Buffer;
}

function multipartBody(parts: MultipartPart[]): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----ajdatest${crypto.randomBytes(12).toString('hex')}`;
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.filename && part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(Buffer.from(header, 'utf8'));
    chunks.push(part.filename ? (part.data ?? Buffer.alloc(0)) : Buffer.from(part.value ?? '', 'utf8'));
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

function pdfBytes(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'utf8');
}

let remoteSeq = 0;
function submitApplication(
  parts: MultipartPart[],
  options: { remoteAddress?: string } = {}
): ReturnType<typeof inject> {
  remoteSeq += 1;
  const { payload, headers } = multipartBody(parts);
  return inject({
    method: 'POST',
    url: '/api/careers/applications',
    payload,
    headers,
    remoteAddress: options.remoteAddress ?? `10.9.${remoteSeq}.1`,
  });
}

function baseFields(overrides: Record<string, string> = {}): MultipartPart[] {
  return [
    { name: 'name', value: overrides.name ?? 'أحمد المطيري' },
    { name: 'email', value: overrides.email ?? 'applicant@example.com' },
    { name: 'phone', value: overrides.phone ?? '+966501234567' },
    { name: 'jobTitle', value: overrides.jobTitle ?? 'مسؤول مبيعات' },
    { name: 'message', value: overrides.message ?? 'مهتم بالوظيفة' },
  ];
}

let superToken: string;
let viewerToken: string; // role viewer, no application permissions
let appViewer: { id: string; email: string; token: string };
let appManager: { id: string; email: string; token: string };

async function resetCareersState(): Promise<void> {
  await prisma.jobApplication.deleteMany();
  await prisma.appSetting.deleteMany({ where: { key: { in: SETTING_KEYS } } });
  await prisma.notificationListener.deleteMany();
  clearCareersFormConfigCache();
  clearSentMail();
}

async function createUsers(): Promise<void> {
  superToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;

  const viewUser = await createThrowawayUser({ permissions: { viewApplications: true } });
  const manageUser = await createThrowawayUser({ permissions: { manageApplications: true } });
  appViewer = { id: viewUser.id, email: viewUser.email, token: (await login(viewUser.email, THROWAWAY_PASSWORD)).token };
  appManager = { id: manageUser.id, email: manageUser.email, token: (await login(manageUser.email, THROWAWAY_PASSWORD)).token };
}

describe('Careers public form config', () => {
  beforeEach(async () => {
    await getApp();
    await resetCareersState();
    if (!superToken) await createUsers();
  });

  it('GET /api/careers/form returns the required flags', async () => {
    const res = await inject({ method: 'GET', url: '/api/careers/form' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      required: { name: true, email: true, phone: true, jobTitle: true, message: false, cv: false },
    });
  });

  it('stores an application and keeps the CV in the private directory only', async () => {
    const res = await submitApplication([
      ...baseFields(),
      { name: 'cv', filename: 'my cv.pdf', contentType: 'application/pdf', data: pdfBytes() },
    ]);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });

    const row = await prisma.jobApplication.findFirst();
    expect(row).not.toBeNull();
    expect(row!.cvPath).toMatch(/^cv\/[0-9a-f]{24}\.pdf$/);
    expect(row!.cvOriginalName).toBe('my cv.pdf');
    expect(row!.status).toBe('new');

    const storedPath = path.join(config.privateDir, row!.cvPath!);
    expect(fs.existsSync(storedPath)).toBe(true);
    // Never under the publicly served uploads directory.
    expect(storedPath.startsWith(config.uploadDir)).toBe(false);
    const publicGuess = path.join(config.uploadDir, row!.cvPath!);
    expect(fs.existsSync(publicGuess)).toBe(false);

    // The path is not reachable through /uploads/.
    const leaked = await inject({ method: 'GET', url: `/uploads/${row!.cvPath}` });
    expect(leaked.statusCode).toBe(404);
  });

  it('accepts an application without a CV', async () => {
    const res = await submitApplication(baseFields());
    expect(res.statusCode).toBe(201);
    const row = await prisma.jobApplication.findFirst();
    expect(row!.cvPath).toBeNull();
    expect(row!.cvOriginalName).toBeNull();
  });

  it('enforces required flags and cannot switch jobTitle off', async () => {
    // message becomes required through the settings.
    const saved = await authInject(appManager.token, {
      method: 'PUT',
      url: '/api/careers/settings',
      payload: { required: { message: true, jobTitle: false }, notificationEmails: [] },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().required).toMatchObject({ jobTitle: true, message: true });

    const missingMessage = await submitApplication(
      baseFields({ message: '' }).filter((part) => part.name !== 'message')
    );
    expect(missingMessage.statusCode).toBe(400);

    const missingJobTitle = await submitApplication([
      ...baseFields({ message: 'hello' }),
      { name: 'jobTitle', value: '' },
    ]);
    expect(missingJobTitle.statusCode).toBe(400);
  });

  it('rejects non-PDF, fake-PDF and oversized CVs', async () => {
    expect((await submitApplication([...baseFields(), { name: 'cv', filename: 'cv.txt', contentType: 'text/plain', data: Buffer.from('hello') }])).statusCode).toBe(400);
    expect(
      (await submitApplication([
        ...baseFields(),
        { name: 'cv', filename: 'cv.pdf', contentType: 'application/pdf', data: Buffer.from('this is not a real pdf') },
      ])).statusCode
    ).toBe(400);
    expect(
      (await submitApplication([...baseFields(), { name: 'cv', filename: 'big.pdf', contentType: 'application/pdf', data: Buffer.alloc(6 * 1024 * 1024, 0x20) }])).statusCode
    ).toBe(400);
  });

  it('rejects a second CV file', async () => {
    const res = await submitApplication([
      ...baseFields(),
      { name: 'cv', filename: 'a.pdf', contentType: 'application/pdf', data: pdfBytes() },
      { name: 'cv', filename: 'b.pdf', contentType: 'application/pdf', data: pdfBytes() },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('stores nothing when the honeypot is filled', async () => {
    const before = await prisma.jobApplication.count();
    const res = await submitApplication([...baseFields(), { name: 'website', value: 'spam' }]);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
    expect(await prisma.jobApplication.count()).toBe(before);
  });

  it('rate limits the 6th request from one IP', async () => {
    const ip = '10.99.99.99';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ok = await submitApplication(baseFields(), { remoteAddress: ip });
      expect(ok.statusCode).toBe(201);
    }
    const blocked = await submitApplication(baseFields(), { remoteAddress: ip });
    expect(blocked.statusCode).toBe(429);
  });
});

describe('Careers admin API', () => {
  beforeEach(async () => {
    await getApp();
    await resetCareersState();
    if (!superToken) await createUsers();
  });

  it('guards every endpoint: 401 anonymous, 403 without the permission', async () => {
    const created = await submitApplication([
      ...baseFields(),
      { name: 'cv', filename: 'cv.pdf', contentType: 'application/pdf', data: pdfBytes() },
    ]);
    expect(created.statusCode).toBe(201);
    const row = await prisma.jobApplication.findFirstOrThrow();

    const probes: { method: string; url: string; payload?: unknown }[] = [
      { method: 'GET', url: '/api/careers/applications' },
      { method: 'GET', url: `/api/careers/applications/${row.id}` },
      { method: 'GET', url: `/api/careers/applications/${row.id}/cv` },
      { method: 'PATCH', url: `/api/careers/applications/${row.id}`, payload: { status: 'reviewed' } },
      { method: 'DELETE', url: `/api/careers/applications/${row.id}` },
      { method: 'GET', url: '/api/careers/settings' },
      { method: 'PUT', url: '/api/careers/settings', payload: { notificationEmails: [] } },
    ];

    for (const probe of probes) {
      expect((await inject({ ...probe })).statusCode).toBe(401);
      expect((await authInject(viewerToken, { ...probe })).statusCode).toBe(403);
    }
  });

  it('lists, reads, downloads, updates and deletes with the right permission', async () => {
    const created = await submitApplication([
      ...baseFields(),
      { name: 'cv', filename: 'resume.pdf', contentType: 'application/pdf', data: pdfBytes() },
    ]);
    expect(created.statusCode).toBe(201);
    const row = await prisma.jobApplication.findFirstOrThrow();
    const storedPath = path.join(config.privateDir, row.cvPath!);

    const list = await authInject(appViewer.token, { method: 'GET', url: '/api/careers/applications' });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.total).toBe(1);
    expect(body.items[0]).not.toHaveProperty('message');
    expect(body.items[0]).not.toHaveProperty('adminNote');
    expect(body.items[0].hasCv).toBe(true);
    expect(body.items[0].id).toBe(row.id);

    const hit = await authInject(appViewer.token, { method: 'GET', url: '/api/careers/applications?q=APPLICANT@' });
    expect(hit.statusCode).toBe(200);
    expect(hit.json().total).toBe(1);
    const miss = await authInject(appViewer.token, { method: 'GET', url: '/api/careers/applications?q=nobody' });
    expect(miss.json().total).toBe(0);

    const detail = await authInject(appViewer.token, { method: 'GET', url: `/api/careers/applications/${row.id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).not.toHaveProperty('cvPath');
    expect(detail.json().hasCv).toBe(true);

    const cv = await authInject(appViewer.token, { method: 'GET', url: `/api/careers/applications/${row.id}/cv` });
    expect(cv.statusCode).toBe(200);
    expect(cv.headers['content-type']).toBe('application/pdf');
    expect(cv.headers['content-disposition']).toBe("attachment; filename*=UTF-8''resume.pdf");
    expect(cv.headers['x-content-type-options']).toBe('nosniff');
    expect(cv.headers['cache-control']).toBe('private, no-store');

    const patched = await authInject(appManager.token, {
      method: 'PATCH',
      url: `/api/careers/applications/${row.id}`,
      payload: { status: 'shortlisted', adminNote: 'مقابلة الأحد' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().status).toBe('shortlisted');
    expect(patched.json().adminNote).toBe('مقابلة الأحد');

    const deleted = await authInject(appManager.token, { method: 'DELETE', url: `/api/careers/applications/${row.id}` });
    expect(deleted.statusCode).toBe(200);
    expect(await prisma.jobApplication.findUnique({ where: { id: row.id } })).toBeNull();
    expect(fs.existsSync(storedPath)).toBe(false);
  });

  it('returns 404 for a path-traversal cvPath', async () => {
    await submitApplication(baseFields());
    const row = await prisma.jobApplication.findFirstOrThrow();
    await prisma.jobApplication.update({ where: { id: row.id }, data: { cvPath: '../x' } });

    const res = await authInject(appViewer.token, { method: 'GET', url: `/api/careers/applications/${row.id}/cv` });
    expect(res.statusCode).toBe(404);
  });

  it('stores and returns careers settings', async () => {
    const saved = await authInject(appManager.token, {
      method: 'PUT',
      url: '/api/careers/settings',
      payload: { required: { cv: true }, notificationEmails: ['A@Example.com', 'a@example.com', 'b@example.com'] },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().notificationEmails).toEqual(['a@example.com', 'b@example.com']);
    expect(saved.json().required.cv).toBe(true);

    const fetched = await authInject(appManager.token, { method: 'GET', url: '/api/careers/settings' });
    expect(fetched.json()).toMatchObject({ required: { cv: true, jobTitle: true }, notificationEmails: ['a@example.com', 'b@example.com'] });
  });
});

describe('Careers notifications', () => {
  beforeEach(async () => {
    await getApp();
    await resetCareersState();
    clearSentMail();
    if (!superToken) await createUsers();
  });

  const sentTo = (): string[] => getSentMail().filter((mail) => mail.kind === 'job-application').map((mail) => mail.to);

  async function submitAndWait(): Promise<void> {
    const res = await submitApplication([
      ...baseFields({ phone: '0551112222', email: 'person@example.com', message: 'private message body' }),
      { name: 'cv', filename: 'cv.pdf', contentType: 'application/pdf', data: pdfBytes() },
    ]);
    expect(res.statusCode).toBe(201);
    await sleep(300);
  }

  it('mails application viewers when a listener selects them, without PII', async () => {
    await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: { event: 'job_application', channel: 'email', name: 'Recruiters', enabled: true, config: { toApplicationViewers: true, emails: [] } },
    });

    await submitAndWait();

    expect(sentTo()).toContain(appViewer.email);
    expect(sentTo()).toContain(SEED_ADMINS.superAdmin);
    const mail = getSentMail().find((m) => m.kind === 'job-application');
    expect(mail).toBeDefined();
    expect(mail!.html + mail!.text).not.toContain('0551112222');
    expect(mail!.html + mail!.text).not.toContain('person@example.com');
    expect(mail!.html + mail!.text).not.toContain('private message body');
  });

  it('falls back to the careers.notification emails', async () => {
    await authInject(appManager.token, {
      method: 'PUT',
      url: '/api/careers/settings',
      payload: { notificationEmails: ['hr@example.com'] },
    });

    await submitAndWait();

    expect(sentTo()).toEqual(['hr@example.com']);
  });

  it('falls back to active application viewers', async () => {
    await prisma.appSetting.deleteMany({ where: { key: 'careers.notifications' } });
    await submitAndWait();
    expect(sentTo()).toContain(appViewer.email);
  });

  it('ignores an inquiry listener for application recipients', async () => {
    await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: { event: 'inquiry.created', channel: 'email', name: 'Sales', enabled: true, config: { toInquiryViewers: false, emails: ['sales@example.com'] } },
    });

    await submitAndWait();

    // The job_application event is still unconfigured, so its own fallback applies.
    expect(sentTo()).toContain(appViewer.email);
    expect(sentTo()).not.toContain('sales@example.com');
  });
});

describe('Notification listeners with application viewers', () => {
  beforeEach(async () => {
    await getApp();
    await resetCareersState();
    if (!superToken) await createUsers();
  });

  it('stores the toApplicationViewers flag and keeps inquiry flags untouched', async () => {
    const created = await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: { event: 'job_application', channel: 'email', name: 'HR', enabled: true, config: { toApplicationViewers: true, emails: [] } },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().config).toMatchObject({ toApplicationViewers: true, toInquiryViewers: false });

    const row = await prisma.notificationListener.findFirstOrThrow();
    expect(JSON.parse(row.config)).toMatchObject({ toApplicationViewers: true });
  });

  it('ignores toInquiryViewers on a job_application listener', async () => {
    await prisma.appSetting.create({ data: { key: 'notifications.job_application', value: '{"listenersConfigured":true}' } });
    await prisma.notificationListener.create({
      data: {
        event: 'job_application',
        channel: 'email',
        name: 'Cross',
        enabled: true,
        config: JSON.stringify({ toInquiryViewers: true, emails: [] }),
      },
    });

    const res = await submitApplication(baseFields());
    expect(res.statusCode).toBe(201);
    await sleep(300);
    // Inquiry viewers are not mailed for an application event.
    expect(getSentMail().filter((m) => m.kind === 'job-application').map((m) => m.to)).not.toContain(SEED_ADMINS.superAdmin);
  });
});

afterAll(async () => {
  await resetCareersState();
  await removeUser(appViewer.id);
  await removeUser(appManager.id);
  await prisma.$disconnect();
  await closeApp();
});
