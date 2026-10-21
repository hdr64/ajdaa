import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A mail server that is down must not look like a mail server that worked.
 *
 * `sendMail` therefore rejects when the transport fails: the queue needs the
 * rejection to mark the job as failed and retry it. The inline fallback (no
 * Redis) has no retry, so it catches the failure itself.
 */

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(async () => {
        throw new Error('SMTP connection refused');
      }),
    })),
  },
}));

// The suite never talks to a real SMTP server, so the "can this deliver?"
// check is forced on to reach the transport.
vi.mock('../src/services/mailSettings.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, canDeliver: () => true };
});

import { sendMail } from '../src/services/mailService.js';
import { dispatch, type QueueableJob } from '../src/services/queueService.js';
import { sendDeveloperNoteEmailJob } from '../src/jobs/emailJobs.js';
import { notifyPasswordChanged } from '../src/services/notificationService.js';

const MESSAGE = {
  kind: 'developer-note' as const,
  to: 'developer@ajdaa.test',
  subject: 'Broken hero image',
  html: '<p>Broken</p>',
  text: 'Broken',
};

const PAYLOAD = {
  noteId: 'note-1',
  title: 'Broken hero image',
  section: 'public',
  body: 'The hero renders at 320px wide.',
  solution: null,
  screenshotUrl: null,
  adminName: null,
  adminEmail: null,
  priority: 'medium',
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The mail service reports the failure on the console; the test output
  // should not be full of it.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('a failing mail transport', () => {
  it('makes sendMail reject', async () => {
    await expect(sendMail(MESSAGE)).rejects.toThrow('SMTP connection refused');
  });

  it('makes the job handler reject, so the queue retries the delivery', async () => {
    await expect(sendDeveloperNoteEmailJob.handle(PAYLOAD)).rejects.toThrow(
      'SMTP connection refused'
    );
  });

  it('never lets the inline fallback fail the caller', async () => {
    const exploding: QueueableJob<typeof PAYLOAD> = {
      name: 'test:exploding',
      handle: async () => {
        await sendMail(MESSAGE);
      },
    };

    await expect(dispatch(exploding, PAYLOAD)).resolves.toBeUndefined();
  });

  it('never lets a failed password-change notification reject', async () => {
    // The caller has already answered the client: the notification is
    // fire-and-forget, so it must not turn into an unhandled rejection.
    await expect(
      notifyPasswordChanged({ email: 'admin@ajdaa.test', name: 'Admin', via: 'reset' })
    ).resolves.toBeUndefined();
  });
});
