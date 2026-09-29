import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
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

async function resetListeners(): Promise<void> {
  await prisma.notificationListener.deleteMany();
  await prisma.appSetting.deleteMany({ where: { key: 'notifications' } });
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
  notifierToken = (await login(notifier.email)).token;
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

describe('Notification listener API (/api/notifications/listeners)', () => {
  it('needs manageNotifications: 401 anonymous, 403 without it, 200 with it', async () => {
    expect((await inject({ method: 'GET', url: '/api/notifications/listeners' })).statusCode).toBe(401);
    expect(
      (await authInject(viewerToken, { method: 'GET', url: '/api/notifications/listeners' })).statusCode
    ).toBe(403);

    const allowed = await authInject(notifierToken, { method: 'GET', url: '/api/notifications/listeners' });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ configured: false, listeners: [], events: ['inquiry.created'] });
  });

  it('lets a user with the permission create, update and delete a listener', async () => {
    const created = await authInject(notifierToken, {
      method: 'POST',
      url: '/api/notifications/listeners',
      payload: emailListener({ config: { toInquiryViewers: false, emails: ['Sales.Team@Example.com', EXTERNAL] } }),
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    // Normalised: lower-cased and de-duplicated.
    expect(created.json().config.emails).toEqual([EXTERNAL]);

    const updated = await authInject(notifierToken, {
      method: 'PUT',
      url: `/api/notifications/listeners/${id}`,
      payload: emailListener({ enabled: false }),
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
