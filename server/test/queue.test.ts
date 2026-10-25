import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeApp, inject } from './helpers.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { config } from '../src/config/env.js';
import {
  closeQueueService,
  dispatch,
  initQueueService,
  isQueueReady,
  queueDriver,
  type QueueableJob,
} from '../src/services/queueService.js';
import { sendDeveloperNoteEmailJob } from '../src/jobs/emailJobs.js';

/**
 * The point of the fallback is that a deployment without Redis still works, so
 * these tests deliberately run with nothing listening on the Redis port.
 *
 * `REDIS_URL` points at a closed port on 127.0.0.1, which fails with ECONNREFUSED
 * immediately rather than hanging until the connect timeout — that keeps the
 * suite fast while still exercising the real probe and its real failure path.
 */
const DEAD_REDIS_URL = 'redis://127.0.0.1:1';

describe('queue fallback (Option C)', () => {
  beforeEach(async () => {
    await closeQueueService();
    config.queue.redisUrl = DEAD_REDIS_URL;
    clearSentMail();
  });

  afterAll(async () => {
    await closeQueueService();
  });

  it('skips the Redis probe entirely when QUEUE_DRIVER=sync', async () => {
    config.queue.driver = 'sync';

    await initQueueService();

    expect(isQueueReady()).toBe(true);
    expect(queueDriver()).toBe('sync');
  });

  it('degrades to the synchronous driver when Redis is unreachable', async () => {
    config.queue.driver = 'auto';

    // Must resolve rather than reject: booting is what this guards.
    await expect(initQueueService()).resolves.toBeUndefined();

    expect(isQueueReady()).toBe(true);
    expect(queueDriver()).toBe('sync');
  });

  it('runs the job inline in auto mode with Redis down, so mail is still sent', async () => {
    config.queue.driver = 'auto';
    await initQueueService();
    clearSentMail();

    await dispatch(sendDeveloperNoteEmailJob, {
      noteId: 'note-1',
      title: 'Broken hero image',
      section: 'public',
      body: 'The hero renders at 320px wide.',
      solution: null,
      screenshotUrl: null,
      adminName: null,
      adminEmail: null,
      priority: 'normal',
    });

    const sent = getSentMail();
    expect(sent).toHaveLength(config.developer.emails.length);
    expect(config.developer.emails.length).toBeGreaterThan(0);
    expect(sent[0]).toMatchObject({ kind: 'developer-note', to: config.developer.emails[0] });
    expect(sent[0].subject).toContain('Broken hero image');
  });

  it('never lets a failing job reject the caller', async () => {
    config.queue.driver = 'auto';
    await initQueueService();

    const exploding: QueueableJob = {
      name: 'test:exploding',
      handle: async () => {
        throw new Error('handler blew up');
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(dispatch(exploding, {})).resolves.toBeUndefined();

    spy.mockRestore();
  });

  it('reports the active driver on the health endpoint', async () => {
    config.queue.driver = 'auto';
    await initQueueService();

    const res = await inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', queueDriver: 'sync' });
  });
});

describe('route integration', () => {
  afterAll(async () => {
    // `inject()` builds the app, which boots the queue; release it so the worker
    // and Prisma connection are torn down before the run ends.
    await closeApp();
  });

  it('still delivers the inquiry notification with Redis down', async () => {
    config.queue.driver = 'auto';
    config.queue.redisUrl = DEAD_REDIS_URL;
    await initQueueService();
    clearSentMail();

    const res = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'Queue Fallback Tester',
        phone: '+966500000001',
        email: 'fallback@example.test',
        interestType: 'buy',
        message: 'Please send details for unit 12B.',
      },
    });

    expect(res.statusCode).toBe(201);

    // Synchronous fallback means the mail is already in the outbox by the time
    // the 201 returns — that is the behaviour the whole feature exists to
    // guarantee when Redis is down.
    const inquiries = getSentMail().filter((mail) => mail.kind === 'new-inquiry');
    expect(inquiries.length).toBeGreaterThan(0);
    expect(inquiries[0].subject).toContain('Queue Fallback Tester');
  });
});
