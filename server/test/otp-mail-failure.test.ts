import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import {
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  removeUser,
  sleep,
  THROWAWAY_PASSWORD,
  type TestSession,
} from './helpers.js';

/**
 * A dead SMTP server must not look like a working one.
 *
 * The OTP codes are the only mails the login depends on: when the transport
 * fails, the endpoint says so (503) instead of claiming that a code was sent.
 * The password-reset request keeps answering 200, because a different answer
 * for an existing and a non-existing address would turn it into an oracle.
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

let user: TestSession | undefined;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  consoleError?.mockRestore();
  if (user) await removeUser(user.id);
  await closeApp();
});

describe('a dead SMTP server during the OTP login', () => {
  it('answers 503 instead of pretending a code was sent', async () => {
    await getApp();
    user = await createThrowawayUser({ role: 'viewer' });
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { loginOtpEnabled: true },
    });

    const response = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: THROWAWAY_PASSWORD },
    });

    expect(response.statusCode).toBe(503);
    expect((response.json() as { error: string }).error).toMatch(/verification email/i);
  });

  it('answers 503 when the code cannot be re-sent', async () => {
    await getApp();
    user = await createThrowawayUser({ role: 'viewer' });
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { loginOtpEnabled: true },
    });

    // The first login issues the challenge; the mail then fails.
    await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: THROWAWAY_PASSWORD },
    });

    const challenge = await prisma.otpChallenge.findFirst({
      where: { adminUserId: user.id, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });
    expect(challenge).not.toBeNull();

    // A resend is throttled right after the challenge was issued.
    await sleep(1700);

    const resend = await inject({
      method: 'POST',
      url: '/api/auth/login/resend-otp',
      payload: { challengeId: challenge!.id },
    });

    expect(resend.statusCode).toBe(503);
  });

  it('keeps the password-reset request silent about the failure', async () => {
    await getApp();
    user = await createThrowawayUser({ role: 'viewer' });

    const response = await inject({
      method: 'POST',
      url: '/api/auth/password/forgot',
      payload: { email: user.email },
    });

    // Always 200, so the endpoint cannot be used to discover which addresses
    // have an account.
    expect(response.statusCode).toBe(200);
  });
});
