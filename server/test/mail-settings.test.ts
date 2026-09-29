import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { decryptSecret, encryptSecret } from '../src/services/secretBox.js';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, seedSession } from './helpers.js';

const SMTP_PASSWORD = 'smtp-app-password-123';

const validSettings = {
  host: 'smtp.example.com',
  port: 587,
  username: 'mailer@example.com',
  encryption: 'tls' as const,
  fromAddress: 'noreply@example.com',
  fromName: 'Ajda Test',
};

let superToken: string;
let managerToken: string;

beforeAll(async () => {
  await getApp();
  superToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  managerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
});

beforeEach(() => {
  clearSentMail();
});

afterAll(async () => {
  await prisma.appSetting.deleteMany({ where: { key: 'mail' } });
  await closeApp();
});

const getMail = () => authInject(superToken, { method: 'GET', url: '/api/settings/mail' });
const putMail = (payload: Record<string, unknown>) =>
  authInject(superToken, { method: 'PUT', url: '/api/settings/mail', payload });

describe('secretBox', () => {
  it('round-trips a secret and never stores it in plaintext', () => {
    const box = encryptSecret(SMTP_PASSWORD);
    expect(box).not.toContain(SMTP_PASSWORD);
    expect(decryptSecret(box)).toBe(SMTP_PASSWORD);
  });

  it('returns null for a tampered or malformed box instead of throwing', () => {
    const box = encryptSecret(SMTP_PASSWORD);
    const tampered = box.slice(0, -2) + (box.endsWith('A') ? 'B' : 'A') + box.slice(-1);
    expect(decryptSecret(tampered)).toBeNull();
    expect(decryptSecret('not-a-box')).toBeNull();
  });
});

describe('Mail settings API (/api/settings/mail)', () => {
  it('is super-admin only: 401 anonymous, 403 for other roles', async () => {
    expect((await inject({ method: 'GET', url: '/api/settings/mail' })).statusCode).toBe(401);

    const forbidden = [
      authInject(managerToken, { method: 'GET', url: '/api/settings/mail' }),
      authInject(managerToken, { method: 'PUT', url: '/api/settings/mail', payload: validSettings }),
      authInject(managerToken, { method: 'DELETE', url: '/api/settings/mail' }),
      authInject(managerToken, {
        method: 'POST',
        url: '/api/settings/mail/test',
        payload: { to: 'someone@example.com' },
      }),
    ];
    for (const response of await Promise.all(forbidden)) {
      expect(response.statusCode).toBe(403);
    }
  });

  it('reports .env values until something is saved', async () => {
    await prisma.appSetting.deleteMany({ where: { key: 'mail' } });

    const response = await getMail();

    expect(response.statusCode).toBe(200);
    const view = response.json();
    expect(view.source).toBe('env');
    expect(view).not.toHaveProperty('password');
    expect(view).not.toHaveProperty('passwordBox');
    // The suite runs with NODE_ENV=test, which never delivers real mail.
    expect(view.deliveryEnabled).toBe(false);
  });

  it('saves settings, encrypts the password at rest and never returns it', async () => {
    const response = await putMail({ ...validSettings, password: SMTP_PASSWORD });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(SMTP_PASSWORD);
    expect(response.json()).toMatchObject({ ...validSettings, source: 'database', passwordSet: true });

    const row = await prisma.appSetting.findUnique({ where: { key: 'mail' } });
    expect(row).not.toBeNull();
    expect(row!.value).not.toContain(SMTP_PASSWORD);

    const reread = await getMail();
    expect(reread.body).not.toContain(SMTP_PASSWORD);
    expect(reread.json()).toMatchObject({ host: validSettings.host, source: 'database', passwordSet: true });
  });

  it('keeps the stored password when it is omitted and clears it on an empty string', async () => {
    await putMail({ ...validSettings, password: SMTP_PASSWORD });

    const kept = await putMail({ ...validSettings, fromName: 'Renamed' });
    expect(kept.json()).toMatchObject({ fromName: 'Renamed', passwordSet: true });

    const cleared = await putMail({ ...validSettings, password: '' });
    expect(cleared.json().passwordSet).toBe(false);
  });

  it('rejects invalid settings with 400', async () => {
    expect((await putMail({ ...validSettings, port: 70000 })).statusCode).toBe(400);
    expect((await putMail({ ...validSettings, encryption: 'starttls' })).statusCode).toBe(400);
    expect((await putMail({ ...validSettings, fromAddress: 'not-an-email' })).statusCode).toBe(400);
  });

  it('reset deletes the saved row and falls back to .env', async () => {
    await putMail({ ...validSettings, password: SMTP_PASSWORD });

    const response = await authInject(superToken, { method: 'DELETE', url: '/api/settings/mail' });

    expect(response.statusCode).toBe(200);
    expect(response.json().source).toBe('env');
    expect(await prisma.appSetting.findUnique({ where: { key: 'mail' } })).toBeNull();
  });
});

describe('Test email (/api/settings/mail/test)', () => {
  const sendTest = (payload: Record<string, unknown>) =>
    authInject(superToken, { method: 'POST', url: '/api/settings/mail/test', payload });

  it('sends a test message with unsaved form values to the given recipient', async () => {
    const response = await sendTest({
      to: 'owner@example.com',
      settings: { ...validSettings, password: SMTP_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().sent).toBe(true);
    const sent = getSentMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'test', to: 'owner@example.com' });
    expect(sent[0].html).not.toContain(SMTP_PASSWORD);
    expect(sent[0].text).not.toContain(SMTP_PASSWORD);
    // Testing does not save anything.
    expect(await prisma.appSetting.findUnique({ where: { key: 'mail' } })).toBeNull();
  });

  it('rejects an invalid recipient with 400 and sends nothing', async () => {
    const response = await sendTest({ to: 'not-an-email' });

    expect(response.statusCode).toBe(400);
    expect(getSentMail()).toHaveLength(0);
  });

  it('is rate limited', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await sendTest({ to: 'owner@example.com', settings: validSettings })).statusCode);
    }
    expect(statuses).toContain(429);
  });
});

describe('Site settings (/api/settings/site)', () => {
  const siteSettings = {
    phone: '+966 50 000 0000',
    whatsapp: '966500000000',
    email: 'hello@example.com',
    addressAr: 'جدة',
    addressEn: 'Jeddah',
    hoursAr: 'يومياً',
    hoursEn: 'Daily',
    socials: {
      x: 'https://x.com/example',
      instagram: '',
      tiktok: '',
      snapchat: '',
      linkedin: 'https://www.linkedin.com/company/example',
      youtube: '',
    },
  };
  const putSite = (token: string, payload: unknown) =>
    authInject(token, { method: 'PUT', url: '/api/settings/site', payload });

  afterAll(async () => {
    await prisma.appSetting.deleteMany({ where: { key: 'site' } });
  });

  it('is public to read and falls back to the built-in values', async () => {
    await prisma.appSetting.deleteMany({ where: { key: 'site' } });

    const response = await inject({ method: 'GET', url: '/api/settings/site' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ whatsapp: '966580484528', email: 'info@ajdaa.sa' });
  });

  it('only a super admin can change it', async () => {
    expect((await inject({ method: 'PUT', url: '/api/settings/site', payload: siteSettings })).statusCode).toBe(401);
    expect((await putSite(managerToken, siteSettings)).statusCode).toBe(403);

    const saved = await putSite(superToken, siteSettings);
    expect(saved.statusCode).toBe(200);

    const reread = await inject({ method: 'GET', url: '/api/settings/site' });
    expect(reread.json()).toEqual(siteSettings);
  });

  it('rejects links that are not https and a malformed WhatsApp number', async () => {
    const scriptLink = { ...siteSettings, socials: { ...siteSettings.socials, x: 'javascript:alert(1)' } };
    const plainHttp = { ...siteSettings, socials: { ...siteSettings.socials, x: 'http://x.com/example' } };

    expect((await putSite(superToken, scriptLink)).statusCode).toBe(400);
    expect((await putSite(superToken, plainHttp)).statusCode).toBe(400);
    expect((await putSite(superToken, { ...siteSettings, whatsapp: '+966 50' })).statusCode).toBe(400);
  });
});
