import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { loginFailureTracker } from '../src/services/loginFailureService.js';
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
  sleep,
  waitFor,
  type TestSession,
} from './helpers.js';

/**
 * Every message here travels through the in-memory transport, so the suite
 * never touches SMTP while still asserting on the real rendered content.
 */

const PASSWORD = 'ValidPassword123';
const NEW_PASSWORD = 'BrandNewPassword123';

const cleanupUsers: string[] = [];
const cleanupInquiries: string[] = [];

interface OtpLoginBody {
  otpRequired?: boolean;
  challengeId?: string;
  emailHint?: string;
}

interface SentMailShape {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** The only six-digit run in a message is the code itself. */
function extractCode(mail: SentMailShape): string {
  const match = mail.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code found in: ${mail.text}`);
  return match[1];
}

async function enableLoginOtp(userId: string): Promise<void> {
  await prisma.adminUser.update({ where: { id: userId }, data: { loginOtpEnabled: true } });
}

/** POST /login for an account with OTP enabled; returns the challenge id. */
async function startOtpLogin(email: string, password: string): Promise<OtpLoginBody> {
  const response = await inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  return response.json() as OtpLoginBody;
}

async function createOtpUser(label: string): Promise<TestSession> {
  const user = await createThrowawayUser({ name: label, password: PASSWORD });
  cleanupUsers.push(user.id);
  loginFailureTracker.recordSuccess(user.email);
  await enableLoginOtp(user.id);
  return user;
}

async function verifyOtp(challengeId: string, code: string) {
  return inject({
    method: 'POST',
    url: '/api/auth/login/verify-otp',
    payload: { challengeId, code },
  });
}

/**
 * `LOGIN_OTP_REQUIRED` is resolved when `src/config/env.ts` is imported, so the
 * flag cannot be changed through the environment at this point in the run. The
 * exported config object is a plain object literal, so flipping the flag around
 * a request exercises the same branch the environment would.
 */
async function withLoginOtpRequired<T>(value: boolean, run: () => Promise<T>): Promise<T> {
  const mutable = config as { loginOtpRequired: boolean };
  const previous = mutable.loginOtpRequired;
  mutable.loginOtpRequired = value;
  try {
    return await run();
  } finally {
    mutable.loginOtpRequired = previous;
  }
}

beforeAll(async () => {
  await getApp();
});

beforeEach(() => {
  clearSentMail();
});

afterAll(async () => {
  for (const id of cleanupInquiries) {
    await prisma.customerInquiry.deleteMany({ where: { id } });
  }
  for (const id of cleanupUsers) {
    await removeUser(id);
  }
  await closeApp();
});

describe('Login OTP', () => {
  it('answers otpRequired and emails exactly one 6-digit code when OTP is enabled', async () => {
    const user = await createThrowawayUser({
      name: 'Otp Login',
      email: 'otp.hint@ajdaa.test',
      password: PASSWORD,
    });
    cleanupUsers.push(user.id);
    loginFailureTracker.recordSuccess(user.email);
    await enableLoginOtp(user.id);

    const body = await startOtpLogin(user.email, PASSWORD);
    expect(body.otpRequired).toBe(true);
    expect(typeof body.challengeId).toBe('string');
    expect(body.emailHint).toBe('ot***@ajdaa.test');
    expect(body).not.toHaveProperty('token');

    const sent = getSentMail();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].html).toContain('dir="rtl"');
    expect(extractCode(sent[0])).toMatch(/^\d{6}$/);

    const challenge = await prisma.otpChallenge.findUnique({ where: { id: body.challengeId! } });
    expect(challenge?.purpose).toBe('login');
    // The code itself is never persisted.
    expect(JSON.stringify(challenge)).not.toContain(extractCode(sent[0]));
  });

  it('still returns a session directly for an account without OTP', async () => {
    const user = await createThrowawayUser({ name: 'No Otp', password: PASSWORD });
    cleanupUsers.push(user.id);
    loginFailureTracker.recordSuccess(user.email);

    const body = await startOtpLogin(user.email, PASSWORD);
    expect(body.otpRequired).toBeUndefined();
    expect(getSentMail()).toHaveLength(0);

    const session = await login(user.email, PASSWORD);
    expect(session.token).toBeTruthy();
  });

  it('rejects a wrong code with attemptsLeft, then issues a token for the right one and refuses reuse', async () => {
    const user = await createOtpUser('Otp Verify');
    const { challengeId } = await startOtpLogin(user.email, PASSWORD);
    const realCode = extractCode(getSentMail()[0]);

    const wrong = await verifyOtp(challengeId!, '000000');
    expect(wrong.statusCode).toBe(400);
    const wrongBody = wrong.json() as { error: string; attemptsLeft: number };
    expect(wrongBody.error).toBeTruthy();
    expect(wrongBody.attemptsLeft).toBe(4);

    const correct = await verifyOtp(challengeId!, realCode);
    expect(correct.statusCode).toBe(200);
    const session = correct.json() as { token: string; user: { email: string } };
    expect(session.token).toBeTruthy();
    expect(session.user.email).toBe(user.email);

    const me = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(me.statusCode).toBe(200);

    // The challenge is consumed: the same code cannot mint a second session.
    const reuse = await verifyOtp(challengeId!, realCode);
    expect(reuse.statusCode).toBe(410);
  });

  it('kills the challenge once the attempt cap is reached', async () => {
    const user = await createOtpUser('Otp Attempts');
    const { challengeId } = await startOtpLogin(user.email, PASSWORD);

    for (const attemptsLeft of [4, 3, 2, 1]) {
      const response = await verifyOtp(challengeId!, '111111');
      expect(response.statusCode).toBe(400);
      expect((response.json() as { attemptsLeft: number }).attemptsLeft).toBe(attemptsLeft);
    }

    // Fifth wrong code exhausts the budget...
    const fifth = await verifyOtp(challengeId!, '111111');
    expect(fifth.statusCode).toBe(410);

    // ...and even the correct code cannot revive it.
    const sixth = await verifyOtp(challengeId!, extractCode(getSentMail()[0]));
    expect(sixth.statusCode).toBe(410);
  });

  it('answers 410 for an expired challenge', async () => {
    const user = await createOtpUser('Otp Expired');
    const { challengeId } = await startOtpLogin(user.email, PASSWORD);
    const code = extractCode(getSentMail()[0]);

    await prisma.otpChallenge.update({
      where: { id: challengeId! },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await verifyOtp(challengeId!, code);
    expect(response.statusCode).toBe(410);
  });

  it('throttles a resend inside the cooldown and supersedes the old challenge afterwards', async () => {
    const user = await createOtpUser('Otp Resend');
    const { challengeId } = await startOtpLogin(user.email, PASSWORD);
    const firstCode = extractCode(getSentMail()[0]);

    const throttled = await inject({
      method: 'POST',
      url: '/api/auth/login/resend-otp',
      payload: { challengeId },
    });
    expect(throttled.statusCode).toBe(429);
    expect(throttled.headers['retry-after']).toBeDefined();
    expect(getSentMail()).toHaveLength(1);

    // The test environment compresses the 60s production cooldown.
    await sleep(Number(process.env.LOGIN_OTP_RESEND_COOLDOWN_MS) + 250);

    const resent = await inject({
      method: 'POST',
      url: '/api/auth/login/resend-otp',
      payload: { challengeId },
    });
    expect(resent.statusCode).toBe(200);
    expect(resent.json()).toEqual({ sent: true });

    const sent = getSentMail();
    expect(sent).toHaveLength(2);
    expect(sent[1].to).toBe(user.email);
    expect(extractCode(sent[1])).toMatch(/^\d{6}$/);

    // Only one challenge is ever live: the superseded code is dead.
    const stale = await verifyOtp(challengeId!, firstCode);
    expect(stale.statusCode).toBe(410);
  });

  it('honours LOGIN_OTP_REQUIRED for accounts that have not opted in', async () => {
    const user = await createThrowawayUser({ name: 'Otp Required', password: PASSWORD });
    cleanupUsers.push(user.id);
    loginFailureTracker.recordSuccess(user.email);

    const inDb = await prisma.adminUser.findUnique({ where: { id: user.id } });
    expect(inDb?.loginOtpEnabled).toBe(false);

    const body = await withLoginOtpRequired(true, () => startOtpLogin(user.email, PASSWORD));
    expect(body.otpRequired).toBe(true);
    expect(getSentMail()).toHaveLength(1);
  });

  it('does not let a verified code bypass the per-email login lockout', async () => {
    const user = await createOtpUser('Otp Lockout');
    const { challengeId } = await startOtpLogin(user.email, PASSWORD);
    const code = extractCode(getSentMail()[0]);

    // Locked out of band, exactly as a burst of bad passwords would.
    for (let i = 0; i < 5; i += 1) {
      loginFailureTracker.recordFailure(user.email);
    }

    const verified = await verifyOtp(challengeId!, code);
    expect(verified.statusCode).toBe(429);

    // A locked-out owner must not burn the code: the 429 is not an attempt.
    loginFailureTracker.recordSuccess(user.email);
    const accepted = await verifyOtp(challengeId!, code);
    expect(accepted.statusCode).toBe(200);
    expect((accepted.json() as { token: string }).token).toBeTruthy();

    const loginAttempt = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: PASSWORD },
    });
    expect(loginAttempt.statusCode).toBe(200);
    expect(getSentMail()).toHaveLength(2);
  });
});

describe('Email OTP settings', () => {
  it('PATCH /api/auth/me/login-otp requires the current password and then persists the flag', async () => {
    const user = await createThrowawayUser({ name: 'Otp Settings', password: PASSWORD });
    cleanupUsers.push(user.id);
    loginFailureTracker.recordSuccess(user.email);
    const session = await login(user.email, PASSWORD);

    const wrongPassword = await authInject(session.token, {
      method: 'PATCH',
      url: '/api/auth/me/login-otp',
      payload: { enabled: true, password: 'WrongPassword123' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(
      (await prisma.adminUser.findUnique({ where: { id: user.id } }))?.loginOtpEnabled
    ).toBe(false);

    const enabled = await authInject(session.token, {
      method: 'PATCH',
      url: '/api/auth/me/login-otp',
      payload: { enabled: true, password: PASSWORD },
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json()).toEqual({ loginOtpEnabled: true });

    // The next login is now OTP-gated.
    expect((await startOtpLogin(user.email, PASSWORD)).otpRequired).toBe(true);

    const disabled = await authInject(session.token, {
      method: 'PATCH',
      url: '/api/auth/me/login-otp',
      payload: { enabled: false, password: PASSWORD },
    });
    expect(disabled.json()).toEqual({ loginOtpEnabled: false });
    expect((await startOtpLogin(user.email, PASSWORD)).otpRequired).toBeUndefined();
  });

  it('requires authentication', async () => {
    const response = await inject({
      method: 'PATCH',
      url: '/api/auth/me/login-otp',
      payload: { enabled: true, password: PASSWORD },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('Password reset by email', () => {
  it('answers 200 without sending anything for an unknown address', async () => {
    const response = await inject({
      method: 'POST',
      url: '/api/auth/password/forgot',
      payload: { email: 'nobody.here@ajdaa.test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sent: true });
    expect(getSentMail()).toHaveLength(0);
  });

  it('resets the password, kills old tokens and emails the admin', async () => {
    const user = await createThrowawayUser({ name: 'Reset Target', password: PASSWORD });
    cleanupUsers.push(user.id);
    loginFailureTracker.recordSuccess(user.email);
    const session = await login(user.email, PASSWORD);

    const forgot = await inject({
      method: 'POST',
      url: '/api/auth/password/forgot',
      payload: { email: user.email },
    });
    expect(forgot.statusCode).toBe(200);

    const code = extractCode(getSentMail()[0]);
    expect(getSentMail()[0].to).toBe(user.email);

    // Weak passwords are rejected before the code is spent.
    const weak = await inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { email: user.email, code, newPassword: 'short1' },
    });
    expect(weak.statusCode).toBe(400);

    const wrongCode = await inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { email: user.email, code: '000000', newPassword: NEW_PASSWORD },
    });
    expect(wrongCode.statusCode).toBe(400);
    expect((wrongCode.json() as { error: string }).error).toBeTruthy();

    // Wait for the next integer second so the iat comparison is strictly less.
    await sleep(1100);

    const reset = await inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { email: user.email, code, newPassword: NEW_PASSWORD },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ reset: true });

    // Every token issued before the reset is dead.
    const oldToken = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(oldToken.statusCode).toBe(401);

    const oldPassword = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: PASSWORD },
    });
    expect(oldPassword.statusCode).toBe(401);

    loginFailureTracker.recordSuccess(user.email);
    const newSession = await login(user.email, NEW_PASSWORD);
    expect(newSession.token).toBeTruthy();

    // The admin is told their password changed.
    // The reset mail does not count: only the "changed" notice does.
    await waitFor(
      () => getSentMail().filter((mail) => mail.kind === 'password-changed').length === 1,
      'the password-changed notification'
    );
    const changed = getSentMail().find((mail) => mail.kind === 'password-changed')!;
    expect(changed.to).toBe(user.email);
    expect(changed.text).toContain('تم تغيير كلمة المرور');

    // The challenge is consumed, so the same code cannot be replayed.
    const replay = await inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { email: user.email, code, newPassword: 'AnotherPassword123' },
    });
    expect(replay.statusCode).toBe(400);
  });

  it('notifies on a self-service password change too', async () => {
    const user = await createThrowawayUser({ name: 'Change Notify', password: PASSWORD });
    cleanupUsers.push(user.id);
    loginFailureTracker.recordSuccess(user.email);
    const session = await login(user.email, PASSWORD);

    clearSentMail();
    const changed = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password',
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    });
    expect(changed.statusCode).toBe(200);

    await waitFor(
      () => getSentMail().some((mail) => mail.to === user.email),
      'the password-changed notification'
    );
  });
});

describe('New inquiry notifications', () => {
  it('emails only the active admins who can view inquiries', async () => {
    const blind = await createThrowawayUser({ name: 'No Inquiry Access', password: PASSWORD });
    cleanupUsers.push(blind.id);

    const suspended = await createThrowawayUser({
      name: 'Suspended Access',
      password: PASSWORD,
      permissions: { viewInquiries: true },
    });
    cleanupUsers.push(suspended.id);
    const superAdmin = await login(SEED_ADMINS.superAdmin, 'password');
    const suspendedRes = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/auth/users/${suspended.id}`,
      payload: { status: 'suspended' },
    });
    expect(suspendedRes.statusCode).toBe(200);

    const created = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'Customer <b>Name</b>',
        phone: '+966500000000',
        email: 'customer@ajdaa.test',
        projectTitle: 'برج Ajda',
        unitNumber: 'A-1201',
        interestType: 'buy',
        message: 'أرغب في حجز وحدة.',
      },
    });
    expect(created.statusCode).toBe(201);
    cleanupInquiries.push((created.json() as { id: string }).id);

    await waitFor(
      () => getSentMail().length >= 4,
      'inquiry notifications to the seeded admins'
    );

    const recipients = getSentMail().map((mail) => mail.to);
    for (const seeded of Object.values(SEED_ADMINS)) {
      expect(recipients).toContain(seeded);
    }
    expect(recipients).not.toContain(blind.email);
    expect(recipients).not.toContain(suspended.email);

    const notification = getSentMail().find((mail) => mail.to === SEED_ADMINS.superAdmin)!;
    expect(notification.text).toContain('Customer <b>Name</b>');
    expect(notification.text).toContain('+966500000000');
    expect(notification.text).toContain('https://ajda.weghetk.com/admin/inquiries');
    // Public form input must never reach the inbox as markup.
    expect(notification.html).toContain('&lt;b&gt;Name&lt;/b&gt;');
    expect(notification.html).not.toContain('<b>Name</b>');
  });

  it('sends nothing for a spam-dropped submission', async () => {
    const response = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'Spam Bot',
        email: 'bot@spam.test',
        interestType: 'general',
        message: 'Cheap watches',
        website: 'https://spam.example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    await sleep(300);
    expect(getSentMail()).toHaveLength(0);
  });
});
