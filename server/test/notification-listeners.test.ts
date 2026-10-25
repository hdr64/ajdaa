import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { loggerService } from '../src/services/loggerService.js';
import {
  emailRecipientsFor,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_LABELS,
} from '../src/services/notificationListeners.js';
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

const EXTERNAL = 'sales.team@example.com';

const emailListener = (overrides: Record<string, unknown> = {}) => ({
  event: 'inquiry.created',
  channel: 'email',
  name: 'Sales inbox',
  enabled: true,
  config: { toInquiryViewers: false, emails: [EXTERNAL] },
  ...overrides,
});

let superToken: string;
let viewerToken: string;
let notifierId: string;
let notifierToken: string;

const CONFIGURED_KEYS = ['notifications', 'notifications.job_application'];

async function resetListeners(): Promise<void> {
  await prisma.notificationListener.deleteMany();
  await prisma.appSetting.deleteMany({ where: { key: { in: CONFIGURED_KEYS } } });
}

async function submitInquiry(): Promise<void> {
  const response = await inject({
    method: 'POST',
    url: '/api/inquiries',
    payload: { name: 'Listener Test', interestType: 'general', elapsedMs: 5000 },
  });
  expect(response.statusCode).toBe(201);
  // Notifications are fire-and-forget after the response.
  await sleep(300);
}

const recipients = () => getSentMail().filter((mail) => mail.kind === 'new-inquiry').map((mail) => mail.to);

beforeAll(async () => {
  await getApp();
  superToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  viewerToken = (await seedSession(SEED_ADMINS.viewer)).token;
  const notifier = await createThrowawayUser({ permissions: { manageNotifications: true } });
  notifierId = notifier.id;
  notifierToken = (await login(notifier.email, THROWAWAY_PASSWORD)).token;
});

beforeEach(async () => {
  await resetListeners();
  clearSentMail();
});

afterAll(async () => {
  await resetListeners();
  await removeUser(notifierId);
  await prisma.customerInquiry.deleteMany({ where: { name: 'Listener Test' } });
  await closeApp();
});

describe('Notification events', () => {
  it('labels every event, including the new job application event', () => {
    expect(NOTIFICATION_EVENTS).toContain('job_application');

    for (const event of NOTIFICATION_EVENTS) {
      expect(NOTIFICATION_EVENT_LABELS[event].labelAr.trim()).not.toBe('');
      expect(NOTIFICATION_EVENT_LABELS[event].labelEn.trim()).not.toBe('');
    }
  });
});

describe('Notification listener API (/api/notifications/listeners)', () => {
  it('needs manageNotifications: 401 anonymous, 403 without it, 200 with it', async () => {
    expect((await inject({ method: 'GET', url: '/api/notifications/listeners' })).statusCode).toBe(401);
    expect(
      (await authInject(viewerToken, { method: 'GET', url: '/api/notifications/listeners' })).statusCode
    ).toBe(403);

    const allowed = await authInject(notifierToken, { method: 'GET', url: '/api/notifications/listeners' });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      configured: false,
      listeners: [],
      events: ['inquiry.created', 'job_application'],
    });
  });

  it('lets a user with the permission create, update and delete a listener without explicit emails', async () => {
    const created = await authInject(notifierToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: true, toApplicationViewers: false, emails: [] } }),
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    expect(created.json().config.toInquiryViewers).toBe(true);
    expect(created.json().config.emails).toEqual([]);

    const updated = await authInject(notifierToken, {
      method: 'PUT',
      url: `/api/notifications/listeners/${id}`,
      payload: emailListener({ enabled: false, config: { toInquiryViewers: true, toApplicationViewers: false, emails: [] } }),
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().enabled).toBe(false);

    const removed = await authInject(notifierToken, { method: 'DELETE', url: `/api/notifications/listeners/${id}` });
    expect(removed.statusCode).toBe(200);
    const missing = await authInject(notifierToken, { method: 'DELETE', url: `/api/notifications/listeners/${id}` });
    expect(missing.statusCode).toBe(404);
  });

  it('rejects a listener without recipients, with a bad address, or with too many addresses', async () => {
    const post = (payload: unknown) =>
      authInject(superToken, { method: 'POST', url: '/api/notifications/listeners', payload });

    expect((await post(emailListener({ config: { toInquiryViewers: false, emails: [] } }))).statusCode).toBe(400);
    expect((await post(emailListener({ config: { toInquiryViewers: false, emails: ['nope'] } }))).statusCode).toBe(400);
    const many = Array.from({ length: 21 }, (_, i) => `person${i}@example.com`);
    expect((await post(emailListener({ config: { toInquiryViewers: false, emails: many } }))).statusCode).toBe(400);
    expect((await post(emailListener({ event: 'unit.sold' }))).statusCode).toBe(400);
  });
});

describe('New-inquiry email recipients', () => {
  it('uses the original rule until a listener exists (active viewInquiries admins)', async () => {
    await submitInquiry();

    expect(recipients()).toContain(SEED_ADMINS.superAdmin);
    expect(recipients()).not.toContain(EXTERNAL);
  });

  it('mails exactly the enabled listeners recipients once one exists', async () => {
    await authInject(superToken, { method: 'POST', url: '/api/notifications/listeners', payload: emailListener() });

    await submitInquiry();

    expect(recipients()).toEqual([EXTERNAL]);
  });

  it('can combine the inquiry viewers with extra addresses, without duplicates', async () => {
    await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: true, emails: [EXTERNAL, SEED_ADMINS.superAdmin] } }),
    });

    await submitInquiry();

    const sent = recipients();
    expect(sent).toContain(EXTERNAL);
    expect(sent).toContain(SEED_ADMINS.superAdmin);
    expect(new Set(sent).size).toBe(sent.length);
  });

  it('sends nothing when the only listener is disabled or every listener was deleted', async () => {
    const created = await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ enabled: false }),
    });
    await submitInquiry();
    expect(recipients()).toEqual([]);

    await authInject(superToken, { method: 'DELETE', url: `/api/notifications/listeners/${created.json().id}` });
    clearSentMail();
    await submitInquiry();
    // Deleting the last listener does not revert to the original recipients.
    expect(recipients()).toEqual([]);
  });
});

describe('Per-event listener configuration', () => {
  it('keeps the inquiry recipients on the legacy rule when a job_application listener exists', async () => {
    const created = await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ event: 'job_application', name: 'Recruitment' }),
    });
    expect(created.statusCode).toBe(201);

    // Only the job_application event is marked as configured.
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: CONFIGURED_KEYS } },
      select: { key: true },
    });
    expect(settings.map((row) => row.key)).toEqual(['notifications.job_application']);

    // The inquiry notifications keep the original rule: the inquiry viewers.
    await submitInquiry();
    expect(recipients()).toContain(SEED_ADMINS.superAdmin);
    expect(recipients()).not.toContain(EXTERNAL);
  });

  it('leaves the job_application event unconfigured when only an inquiry listener exists', async () => {
    await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener(),
    });

    // The inquiry event took over; the job_application event did not.
    expect(await emailRecipientsFor('job_application')).toBeNull();
    expect(await emailRecipientsFor('inquiry.created')).toEqual([EXTERNAL]);
  });
});

describe('H-7: super admin required for explicit emails', () => {
  it('non-super-admin POST with emails is 403 and nothing is stored', async () => {
    const res = await authInject(notifierToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['injected@attacker.test'] } }),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Only a super admin can send notifications to explicit email addresses');
    const stored = await prisma.notificationListener.findMany();
    expect(stored.length).toBe(0);
  });

  it('non-super-admin POST with only toInquiryViewers is 201', async () => {
    const res = await authInject(notifierToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: true, toApplicationViewers: false, emails: [] } }),
    });
    expect(res.statusCode).toBe(201);
    const stored = await prisma.notificationListener.findMany();
    expect(stored.length).toBe(1);
    expect(stored[0].createdById).toBe(notifierId);
  });

  it('non-super-admin PUT that changes emails is 403 while a PUT that only renames is 200', async () => {
    const created = await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: false, emails: [EXTERNAL] } }),
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    // Renaming keeping same email set (case-insensitive) is 200
    const rename = await authInject(notifierToken, {
      method: 'PUT',
      url: `/api/notifications/listeners/${id}`,
      payload: emailListener({
        name: 'Renamed Listener',
        config: { toInquiryViewers: false, emails: [EXTERNAL.toUpperCase()] },
      }),
    });
    expect(rename.statusCode).toBe(200);
    expect(rename.json().name).toBe('Renamed Listener');

    // Changing emails is 403
    const changeEmails = await authInject(notifierToken, {
      method: 'PUT',
      url: `/api/notifications/listeners/${id}`,
      payload: emailListener({
        name: 'Renamed Listener',
        config: { toInquiryViewers: false, emails: ['injected@attacker.test'] },
      }),
    });
    expect(changeEmails.statusCode).toBe(403);
    expect(changeEmails.json().error).toBe('Only a super admin can send notifications to explicit email addresses');
  });

  it('super admin does both (POST with emails and PUT changing emails)', async () => {
    const created = await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['super1@ajdaa.sa'] } }),
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().config.emails).toEqual(['super1@ajdaa.sa']);

    const updated = await authInject(superToken, {
      method: 'PUT',
      url: `/api/notifications/listeners/${created.json().id}`,
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['super2@ajdaa.sa'] } }),
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().config.emails).toEqual(['super2@ajdaa.sa']);
  });

  it('no inquiry mail reaches an address a refused request tried to inject', async () => {
    // Attempt injection as non-super-admin
    const injection = await authInject(notifierToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['exfiltrate@evil.tld'] } }),
    });
    expect(injection.statusCode).toBe(403);

    // Now submit an inquiry
    await submitInquiry();
    expect(recipients()).not.toContain('exfiltrate@evil.tld');
  });

  it('audit logs every listener create, update, and delete with actor id and emails', async () => {
    const created = await authInject(superToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['audit@ajdaa.sa'] } }),
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    await authInject(superToken, {
      method: 'PUT',
      url: `/api/notifications/listeners/${id}`,
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['audit-updated@ajdaa.sa'] } }),
    });

    await authInject(superToken, {
      method: 'DELETE',
      url: `/api/notifications/listeners/${id}`,
    });

    // Check loggerService buffer
    const logs = await loggerService.getLogs({ source: 'buffer', limit: 20 });
    const notificationLogs = logs.entries.filter((e) => e.source === 'notifications');
    expect(
      notificationLogs.some(
        (e) =>
          e.message === 'Notification listener created' &&
          (e.context?.emails as string[])?.includes('audit@ajdaa.sa')
      )
    ).toBe(true);
    expect(
      notificationLogs.some(
        (e) =>
          e.message === 'Notification listener updated' &&
          (e.context?.emails as string[])?.includes('audit-updated@ajdaa.sa')
      )
    ).toBe(true);
    expect(
      notificationLogs.some(
        (e) => e.message === 'Notification listener deleted' && e.context?.listenerId === id
      )
    ).toBe(true);
  });
});

