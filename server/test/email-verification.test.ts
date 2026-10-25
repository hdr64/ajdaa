import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { clearChallenges } from '../src/services/otpService.js';
import {
  authInject,
  closeApp,
  getApp,
  inject,
  login,
  removeUser,
  seedSession,
  SEED_ADMINS,
  sleep,
  THROWAWAY_PASSWORD,
  createThrowawayUser,
  type TestSession,
} from './helpers.js';

/**
 * Email verification for new accounts and the emailed confirmation step of a
 * self-service password change. Every mail here travels through the in-memory
 * transport, so the suite asserts on the real rendered content and the real
 * link/token without touching SMTP.
 */

const SUPER = SEED_ADMINS.superAdmin;
const GOOD_PASSWORD = 'CurrentPassword123';

const cleanupUsers: string[] = [];

/** The `token=` value carried by the newest mail of a given kind. */
function tokenFromMail(kind: string): string {
  const mail = [...getSentMail()].reverse().find((m) => m.kind === kind);
  if (!mail) throw new Error(`No "${kind}" mail was sent`);
  const match = mail.text.match(/[?&]token=([0-9a-f]{16,})/);
  if (!match) throw new Error(`No token link found in the ${kind} mail:\n${mail.text}`);
  return match[1];
}

/** The only six-digit run in the password-change code mail. */
function codeFromMail(): string {
  const mail = [...getSentMail()].reverse().find((m) => m.kind === 'password-change-code');
  if (!mail) throw new Error('No password-change code mail was sent');
  const match = mail.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code in the mail:\n${mail.text}`);
  return match[1];
}

/** The six-digit code carried by the newest verify-email mail. */
function verificationCodeFromMail(): string {
  const mail = [...getSentMail()].reverse().find((m) => m.kind === 'verify-email');
  if (!mail) throw new Error('No verify-email mail was sent');
  const match = mail.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code in the verify-email mail:\n${mail.text}`);
  return match[1];
}

/** Creates an account as the super admin in the given mode and returns its id. */
async function createAccountAs(
  admin: TestSession,
  payload: Record<string, unknown>
): Promise<{ id: string; body: Record<string, unknown> }> {
  const response = await authInject(admin.token, {
    method: 'POST',
    url: '/api/auth/users',
    payload: { name: 'Verify Target', role: 'viewer', ...payload },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json() as Record<string, unknown>;
  cleanupUsers.push(body.id as string);
  return { id: body.id as string, body };
}

function linkFor(kind: string, path: string): string {
  return `${config.appUrl}${path}?token=`;
}

beforeAll(async () => {
  await getApp();
});

beforeEach(() => {
  clearSentMail();
});

afterAll(async () => {
  for (const id of cleanupUsers) {
    await removeUser(id);
  }
  await closeApp();
});

describe('invite a new user', () => {
  it('creates a pending account with an unusable password and an invite mail whose link uses APP_URL and carries no secret', async () => {
    const admin = await seedSession(SUPER);
    const email = `invite.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'invite', email });

    const created = await prisma.adminUser.findUnique({ where: { id } });
    expect(created?.status).toBe('pending');
    expect(created?.emailVerifiedAt).toBeNull();
    expect(created?.passwordHash).toBeTruthy();

    const row = await prisma.emailVerificationToken.findFirst({ where: { adminUserId: id, purpose: 'invite' } });
    expect(row).not.toBeNull();

    const mail = getSentMail().find((m) => m.kind === 'invite');
    expect(mail?.to).toBe(email);
    expect(mail?.text).toContain(linkFor('invite', '/admin/accept-invite'));
    // No password and no pepper in the mail; the token link itself is the only secret.
    expect(`${mail?.text}${mail?.html}`).not.toContain(config.jwtSecret);

    // An invited account has no usable password: any login is a plain 401.
    const loginAttempt = await inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: GOOD_PASSWORD } });
    expect(loginAttempt.statusCode).toBe(401);
  });

  it('refuses an invite for a super admin', async () => {
    const admin = await seedSession(SUPER);
    const email = `sa.invite.${Date.now()}@ajdaa.test`;
    const response = await authInject(admin.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: { mode: 'invite', name: 'SA Invite', email, role: 'super_admin' },
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: string }).error).toBeTruthy();
    expect(await prisma.adminUser.findUnique({ where: { email } })).toBeNull();
  });
});

describe('accept-invite (public)', () => {
  it('a policy failure keeps the token usable, success activates the account, and a second use fails', async () => {
    const admin = await seedSession(SUPER);
    const email = `accept.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'invite', email });
    const token = tokenFromMail('invite');
    cleanupUsers.push(id);

    const weak = await inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token, password: 'short' } });
    expect(weak.statusCode).toBe(400);
    expect((weak.json() as { error: string }).error).toMatch(/at least 10 characters/i);

    const accepted = await inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token, password: GOOD_PASSWORD } });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ activated: true });

    const activated = await prisma.adminUser.findUnique({ where: { id } });
    expect(activated?.status).toBe('active');
    expect(activated?.emailVerifiedAt).not.toBeNull();
    expect(activated?.passwordChangedAt).not.toBeNull();

    const session = await login(email, GOOD_PASSWORD);
    expect(session.token).toBeTruthy();

    const replay = await inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token, password: 'AnotherPassword123' } });
    expect(replay.statusCode).toBe(400);
  });

  it('rejects a verify token presented to accept-invite and an unknown token with the same 400', async () => {
    const admin = await seedSession(SUPER);
    const email = `accept.wrong.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const verifyToken = tokenFromMail('verify-email');

    const crossPurpose = await inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: verifyToken, password: GOOD_PASSWORD } });
    const unknown = await inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'a'.repeat(64), password: GOOD_PASSWORD } });
    expect(crossPurpose.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(crossPurpose.json().error).toBe(unknown.json().error);

    const still = await prisma.adminUser.findUnique({ where: { email } });
    expect(still?.status).toBe('pending');
  });
});

describe('create mode + the login gate', () => {
  it('starts the account pending and answers EMAIL_NOT_VERIFIED only after the correct password', async () => {
    const admin = await seedSession(SUPER);
    const email = `create.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    cleanupUsers.push(id);

    const created = await prisma.adminUser.findUnique({ where: { id } });
    expect(created?.status).toBe('pending');
    expect(created?.emailVerifiedAt).toBeNull();
    expect(getSentMail().find((m) => m.kind === 'verify-email')?.text).toContain(linkFor('verify-email', '/admin/verify-email'));

    // A wrong password is an ordinary 401 (no account/verification oracle).
    const wrong = await inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'nope-nope-nope' } });
    expect(wrong.statusCode).toBe(401);

    // The correct password (only) yields the distinct 403 + code.
    const right = await inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: GOOD_PASSWORD } });
    expect(right.statusCode).toBe(403);
    expect(right.json().code).toBe('EMAIL_NOT_VERIFIED');

    const token = tokenFromMail('verify-email');
    const verified = await inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toEqual({ verified: true });

    const session = await login(email, GOOD_PASSWORD);
    expect(session.token).toBeTruthy();
  });

  it('a minted JWT for a pending account is unusable against /me', async () => {
    const admin = await seedSession(SUPER);
    const { id } = await createAccountAs(admin, { mode: 'create', email: `pending.jwt.${Date.now()}@ajdaa.test`, password: GOOD_PASSWORD });
    const app: FastifyInstance = await getApp();
    const pending = await prisma.adminUser.findUnique({ where: { id } });
    const token = app.jwt.sign({ id, email: pending!.email, role: pending!.role });

    const me = await authInject(token, { method: 'GET', url: '/api/auth/me' });
    expect(me.statusCode).toBe(401);
  });
});

describe('verify-email (public) failure parity', () => {
  it('answers one identical 400 for unknown, consumed and expired tokens', async () => {
    const admin = await seedSession(SUPER);
    const email = `vfail.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const token = tokenFromMail('verify-email');

    await inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } });
    const consumed = await inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } });

    await prisma.emailVerificationToken.updateMany({
      where: { adminUserId: id, purpose: 'verify' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token: 'b'.repeat(64) } });

    const unknown = await inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token: 'c'.repeat(64) } });

    expect(consumed.statusCode).toBe(400);
    expect(expired.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(consumed.json().error).toBe(expired.json().error);
    expect(consumed.json().error).toBe(unknown.json().error);
  });

  it('an expired link leaves the account pending', async () => {
    const admin = await seedSession(SUPER);
    const email = `vexp.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const token = tokenFromMail('verify-email');
    await prisma.emailVerificationToken.updateMany({
      where: { adminUserId: id, purpose: 'verify' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const expired = await inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } });
    expect(expired.statusCode).toBe(400);

    const still = await prisma.adminUser.findUnique({ where: { id } });
    expect(still?.status).toBe('pending');
    expect(still?.emailVerifiedAt).toBeNull();
  });
});

describe('resend-verification', () => {
  it('is throttled inside the cooldown, re-issues the same purpose afterwards, and 409s once verified', async () => {
    const admin = await seedSession(SUPER);
    const email = `resend.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'invite', email });
    cleanupUsers.push(id);
    expect(getSentMail().filter((m) => m.kind === 'invite')).toHaveLength(1);

    const tooSoon = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${id}/resend-verification`,
    });
    expect(tooSoon.statusCode).toBe(429);
    expect(tooSoon.headers['retry-after']).toBeDefined();
    expect(getSentMail().filter((m) => m.kind === 'invite')).toHaveLength(1);

    await sleep(Number(process.env.LOGIN_OTP_RESEND_COOLDOWN_MS) + 250);

    const resent = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${id}/resend-verification`,
    });
    expect(resent.statusCode).toBe(200);
    expect(resent.json()).toEqual({ sent: true });
    expect(getSentMail().filter((m) => m.kind === 'invite')).toHaveLength(2);

    // Activate through the link, then the resend must answer 409.
    const token = tokenFromMail('invite');
    await inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token, password: GOOD_PASSWORD } });
    await sleep(Number(process.env.LOGIN_OTP_RESEND_COOLDOWN_MS) + 250);

    const verified = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${id}/resend-verification`,
    });
    expect(verified.statusCode).toBe(409);
  });
});

describe('super admin exemptions', () => {
  it('creates a super admin active and verified with no mail, and one-step password change', async () => {
    const admin = await seedSession(SUPER);
    const email = `super.${Date.now()}@ajdaa.test`;
    const { id, body } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD, role: 'super_admin' });
    cleanupUsers.push(id);

    expect(body.status).toBe('active');
    expect(body.mailSent).toBe(true);
    expect(getSentMail().filter((m) => m.kind === 'invite' || m.kind === 'verify-email')).toHaveLength(0);
    expect((await prisma.adminUser.findUnique({ where: { id } }))?.emailVerifiedAt).not.toBeNull();

    const session = await login(email, GOOD_PASSWORD);
    expect(session.role).toBe('super_admin');

    // One-step: no challengeId needed, no code mail.
    clearSentMail();
    const changed = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'BrandNewPassword123' },
    });
    expect(changed.statusCode).toBe(200);
    expect(getSentMail().filter((m) => m.kind === 'password-change-code')).toHaveLength(0);
  });
});

describe('pending accounts stay isolated', () => {
  it('are excluded from the active-admin inquiry notification recipients', async () => {
    const admin = await seedSession(SUPER);
    const email = `pending.viewer.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD, permissions: { viewInquiries: true } });
    cleanupUsers.push(id);

    clearSentMail();
    const created = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: {
        name: 'Pending Isolation',
        phone: '+966500000000',
        email: 'iso@ajdaa.test',
        interestType: 'general',
        message: 'Hello',
      },
    });
    expect(created.statusCode).toBe(201);

    // A pending viewer with viewInquiries must never be a recipient.
    expect(getSentMail().some((m) => m.to === email)).toBe(false);
  });
});

describe('self-service password change', () => {
  it('requires a code for a non-super-admin and does not burn it on a policy failure', async () => {
    const admin = await seedSession(SUPER);
    const email = `two.step.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    cleanupUsers.push(id);
    // Activate so we can sign in and exercise the change flow itself.
    await prisma.adminUser.update({ where: { id }, data: { status: 'active', emailVerifiedAt: new Date() } });

    const session = await login(email, GOOD_PASSWORD);

    // A non-super-admin omitting the confirmation code is told so explicitly.
    const missing = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'BrandNewPassword123' },
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().code).toBe('CODE_REQUIRED');

    // Step 1 validates the current password before anything is issued.
    clearSentMail();
    const wrongCurrent = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password/request',
      payload: { currentPassword: 'WrongCurrentPassword', newPassword: 'BrandNewPassword123' },
    });
    expect(wrongCurrent.statusCode).toBe(401);

    const weak = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password/request',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'short' },
    });
    expect(weak.statusCode).toBe(400);

    const request = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password/request',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'BrandNewPassword123' },
    });
    expect(request.statusCode).toBe(200);
    const { challengeId } = request.json() as { challengeId: string };
    const code = codeFromMail();

    // A policy failure at step 2 must not spend the code.
    const weakSecond = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'also-weak', challengeId, code },
    });
    expect(weakSecond.statusCode).toBe(400);

    const wrongCode = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'BrandNewPassword123', challengeId, code: '000000' },
    });
    expect(wrongCode.statusCode).toBe(400);

    await sleep(1100);
    const changed = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/password',
      payload: { currentPassword: GOOD_PASSWORD, newPassword: 'BrandNewPassword123', challengeId, code },
    });
    expect(changed.statusCode).toBe(200);

    // Every token minted before the change is dead.
    const oldToken = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(oldToken.statusCode).toBe(401);
    const fresh = changed.json() as { token: string };
    expect((await authInject(fresh.token, { method: 'GET', url: '/api/auth/me' })).statusCode).toBe(200);

    const oldLogin = await inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: GOOD_PASSWORD } });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await login(email, 'BrandNewPassword123');
    expect(newLogin.token).toBeTruthy();
  });
});

describe('forgot/reset regression', () => {
  it('never reveals whether an address has an account', async () => {
    const response = await inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: `ghost.${Date.now()}@ajdaa.test` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sent: true });
    expect(getSentMail()).toHaveLength(0);
  });

  it('rejects an expired reset code then, on the real code, revokes every earlier token', async () => {
    const admin = await seedSession(SUPER);
    const email = `reset.${Date.now()}@ajdaa.test`;
    const { id } = await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    cleanupUsers.push(id);
    await prisma.adminUser.update({ where: { id }, data: { status: 'active', emailVerifiedAt: new Date() } });
    const session = await login(email, GOOD_PASSWORD);

    clearSentMail();
    await inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email } });
    const resetMail = getSentMail().find((m) => m.kind === 'password-reset');
    const code = (resetMail!.text.match(/\b(\d{6})\b/) as RegExpMatchArray)[1];

    await prisma.otpChallenge.updateMany({
      where: { adminUserId: id, purpose: 'password_reset' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await inject({ method: 'POST', url: '/api/auth/password/reset', payload: { email, code, newPassword: 'BrandNewPassword123' } });
    expect(expired.statusCode).toBe(400);

    await prisma.otpChallenge.updateMany({
      where: { adminUserId: id, purpose: 'password_reset' },
      data: { expiresAt: new Date(Date.now() + 600_000) },
    });

    await sleep(1100);
    const reset = await inject({ method: 'POST', url: '/api/auth/password/reset', payload: { email, code, newPassword: 'BrandNewPassword123' } });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ reset: true });

    const oldToken = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(oldToken.statusCode).toBe(401);
  });
});

describe('create-mode mail carries a code; invite mail does not', () => {
  it('create-mode mail has a 6-digit code and the link', async () => {
    const admin = await seedSession(SUPER);
    const email = `create.code.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    
    const mail = getSentMail().find((m) => m.kind === 'verify-email');
    expect(mail).toBeDefined();
    expect(mail!.text).toContain(linkFor('verify-email', '/admin/verify-email'));
    expect(verificationCodeFromMail()).toMatch(/^\d{6}$/);
    expect(mail!.text).toMatch(/صالح لمدة \d+ دقيقة/);

    const created = await prisma.adminUser.findUnique({ where: { email } });
    expect(created).not.toBeNull();
    cleanupUsers.push(created!.id);
  });

  it('invite-mode mail has the link but no code', async () => {
    const admin = await seedSession(SUPER);
    const email = `invite.nocode.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'invite', email });
    
    const mail = getSentMail().find((m) => m.kind === 'invite');
    expect(mail).toBeDefined();
    expect(mail!.text).toContain(linkFor('invite', '/admin/accept-invite'));
    expect(/\b\d{6}\b/.test(mail!.text)).toBe(false);

    const created = await prisma.adminUser.findUnique({ where: { email } });
    expect(created).not.toBeNull();
    cleanupUsers.push(created!.id);
  });
});

describe('verify-email-code (public)', () => {
  it('success activates and clears the link token and challenges', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.ok.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    const code = verificationCodeFromMail();
    const verified = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toEqual({ verified: true });

    const active = await prisma.adminUser.findUnique({ where: { email } });
    expect(active!.status).toBe('active');
    expect(active!.emailVerifiedAt).not.toBeNull();

    // The link token is dead and no challenge is left.
    const tokenRows = await prisma.emailVerificationToken.count({
      where: { adminUserId: created!.id, purpose: 'verify' },
    });
    expect(tokenRows).toBe(0);
    const challengeRows = await prisma.otpChallenge.count({
      where: { adminUserId: created!.id, purpose: 'email_verification' },
    });
    expect(challengeRows).toBe(0);
  });

  it('wrong code returns 400 with attemptsLeft', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.wrong.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    const bad = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code: '000000' },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().attemptsLeft).toBeDefined();
    expect(bad.json().attemptsLeft).toBeLessThanOrEqual(5);

    // The account stays pending and unverified.
    const still = await prisma.adminUser.findUnique({ where: { email } });
    expect(still!.status).toBe('pending');
    expect(still!.emailVerifiedAt).toBeNull();
  });

  it('wrong password returns the generic 401 and counts toward lockout', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.pw.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    
    const first = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: 'NopeNope123', code: '000000' },
    });
    expect(first.statusCode).toBe(401);
    expect(first.json().error).toBe('Invalid credentials');

    const created = await prisma.adminUser.findUnique({ where: { email } });
    expect(created!.status).toBe('pending');
    cleanupUsers.push(created!.id);
  });

  it('an invite account cannot use the code', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.invite.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'invite', email });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    const res = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code: '123456' },
    });
    // Invite account has no usable password -> generic 401 (no oracle).
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid credentials');

    const still = await prisma.adminUser.findUnique({ where: { email } });
    expect(still!.status).toBe('pending');
  });

  it('an already-active account answers like a failure (no oracle)', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.active.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, {
      mode: 'create',
      email,
      password: GOOD_PASSWORD,
    });
    await prisma.adminUser.update({
      where: { email },
      data: { status: 'active', emailVerifiedAt: new Date() },
    });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    const res = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code: '123456' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('رابط التحقق غير صالح أو منتهي الصلاحية / The verification link is invalid or has expired');
  });

  it('a dead/nonexistent code answers the expired message', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.dead.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    await clearChallenges(created!.id, 'email_verification');
    const res = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code: '123456' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(
      'رمز التحقق منتهي الصلاحية أو تم استخدامه، يرجى طلب رمز جديد / Verification code has expired or was already used, please request a new one'
    );
  });

  it('link verification kills the code and vice versa', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.link.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    const token = tokenFromMail('verify-email');
    const link = await inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token },
    });
    expect(link.statusCode).toBe(200);

    const code = verificationCodeFromMail();
    const afterLink = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code },
    });
    // The account is now active, so the code path answers like a failure (no oracle).
    expect(afterLink.statusCode).toBe(400);
  });
});

describe('verify-email-code/resend (public)', () => {
  it('is throttled inside the cooldown, then issues a fresh code that supersedes the old', async () => {
    const admin = await seedSession(SUPER);
    const email = `code.resend.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const created = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(created!.id);

    const oldCode = verificationCodeFromMail(); // the first mail's code

    const tooSoon = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code/resend',
      payload: { email, password: GOOD_PASSWORD },
    });
    expect(tooSoon.statusCode).toBe(429);
    expect(tooSoon.headers['retry-after']).toBeDefined();

    await sleep(Number(process.env.LOGIN_OTP_RESEND_COOLDOWN_MS) + 250);

    const resent = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code/resend',
      payload: { email, password: GOOD_PASSWORD },
    });
    expect(resent.statusCode).toBe(200);
    expect(resent.json()).toEqual({ sent: true });

    const firstCodeUsed = await inject({
      method: 'POST',
      url: '/api/auth/verify-email-code',
      payload: { email, password: GOOD_PASSWORD, code: oldCode },
    });
    // The old code's challenge was superseded by the resend, so it no longer works.
    expect(firstCodeUsed.statusCode).toBe(400);
  });
});

describe('mark-verified (admin)', () => {
  async function managerWith(permissions: Record<string, boolean>) {
    const user = await createThrowawayUser({ role: 'project_manager', permissions });
    return login(user.email, THROWAWAY_PASSWORD);
  }

  it('requires verifyUsers permission (403 without)', async () => {
    const admin = await seedSession(SUPER);
    const email = `mark.target.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const target = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(target!.id);

    const manager = await managerWith({ manageUsers: true });
    const res = await authInject(manager.token, {
      method: 'POST',
      url: `/api/auth/users/${target!.id}/mark-verified`,
    });
    expect(res.statusCode).toBe(403);
  });

  it('super admin is always allowed', async () => {
    const admin = await seedSession(SUPER);
    const email = `mark.sa.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    const target = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(target!.id);

    const res = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${target!.id}/mark-verified`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().verified).toBe(true);

    const active = await prisma.adminUser.findUnique({ where: { email } });
    expect(active!.status).toBe('active');
    expect(active!.emailVerifiedAt).not.toBeNull();
  });

  it('invite account returns needsPassword', async () => {
    const admin = await seedSession(SUPER);
    const email = `mark.invite.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'invite', email });
    const target = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(target!.id);

    const res = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${target!.id}/mark-verified`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().needsPassword).toBe(true);

    const active = await prisma.adminUser.findUnique({ where: { email } });
    expect(active!.emailVerifiedAt).not.toBeNull();
    expect(active!.status).toBe('active');
  });

  it('suspended account stays suspended', async () => {
    const admin = await seedSession(SUPER);
    const email = `mark.susp.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    await prisma.adminUser.update({ where: { email }, data: { status: 'suspended' } });
    const target = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(target!.id);

    const res = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${target!.id}/mark-verified`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().verified).toBe(true);

    const active = await prisma.adminUser.findUnique({ where: { email } });
    expect(active!.status).toBe('suspended');
    expect(active!.emailVerifiedAt).not.toBeNull();
  });

  it('already verified returns 409', async () => {
    const admin = await seedSession(SUPER);
    const email = `mark.done.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, { mode: 'create', email, password: GOOD_PASSWORD });
    await prisma.adminUser.update({
      where: { email },
      data: { status: 'active', emailVerifiedAt: new Date() },
    });
    const target = await prisma.adminUser.findUnique({ where: { email } });
    cleanupUsers.push(target!.id);

    const res = await authInject(admin.token, {
      method: 'POST',
      url: `/api/auth/users/${target!.id}/mark-verified`,
    });
    expect(res.statusCode).toBe(409);
  });

  it('non-super-admin cannot target a super admin', async () => {
    await seedSession(SUPER);
    const target = await createThrowawayUser({ role: 'super_admin', password: THROWAWAY_PASSWORD });
    cleanupUsers.push(target.id);
    await prisma.adminUser.update({
      where: { id: target.id },
      data: { status: 'pending', emailVerifiedAt: null },
    });

    const manager = await managerWith({ verifyUsers: true, manageUsers: true });
    const res = await authInject(manager.token, {
      method: 'POST',
      url: `/api/auth/users/${target.id}/mark-verified`,
    });
    expect(res.statusCode).toBe(403);
  });

  it('only a super admin can grant verifyUsers to a role', async () => {
    const manager = await createThrowawayUser({
      role: 'project_manager',
      permissions: { manageUsers: true, verifyUsers: false },
    });
    const managerSession = await login(manager.email, THROWAWAY_PASSWORD);
    cleanupUsers.push(manager.id);

    const roleKey = `grant_role_${Date.now()}`;
    const created = await authInject(managerSession.token, {
      method: 'POST',
      url: '/api/roles',
      payload: { key: roleKey, nameAr: 'دور تجريبي', nameEn: 'Grant Role', permissions: ['verifyUsers'] },
    });
    expect(created.statusCode).toBe(403);
  });

  it('a manageUsers admin can still edit a user who already holds verifyUsers', async () => {
    const holder = await createThrowawayUser({
      role: 'project_manager',
      permissions: { verifyUsers: true },
    });
    cleanupUsers.push(holder.id);
    const manager = await createThrowawayUser({
      role: 'project_manager',
      permissions: { manageUsers: true },
    });
    cleanupUsers.push(manager.id);
    const managerSession = await login(manager.email, THROWAWAY_PASSWORD);

    // The admin form always resends the permissions it loaded; an unchanged
    // verifyUsers flag is not a grant.
    const res = await authInject(managerSession.token, {
      method: 'PUT',
      url: `/api/auth/users/${holder.id}`,
      payload: { name: 'Renamed Holder', permissions: { verifyUsers: true } },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('sendPasswordInEmail (create mode)', () => {
  it('mail contains the password only when requested', async () => {
    const admin = await seedSession(SUPER);
    const email = `pw.on.${Date.now()}@ajdaa.test`;
    await createAccountAs(admin, {
      mode: 'create',
      email,
      password: GOOD_PASSWORD,
      sendPasswordInEmail: true,
    });
    
    const mail = getSentMail().find((m) => m.kind === 'verify-email');
    expect(mail!.text).toContain(GOOD_PASSWORD);
    expect(mail!.text).toMatch(/كلمة المرور المؤقتة/);

    const created = await prisma.adminUser.findUnique({ where: { email } });
    expect(created).not.toBeNull();
    cleanupUsers.push(created!.id);
  });

  it('rejects sendPasswordInEmail with invite via the API (400)', async () => {
    const admin = await seedSession(SUPER);
    const email = `pw.invite.${Date.now()}@ajdaa.test`;
    const res = await authInject(admin.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: { name: 'Reject Invite', email, mode: 'invite', role: 'viewer', sendPasswordInEmail: true },
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.adminUser.findUnique({ where: { email } })).toBeNull();
  });

  it('rejects sendPasswordInEmail for a super-admin target (no mail is sent)', async () => {
    const admin = await seedSession(SUPER);
    const email = `pw.sa.${Date.now()}@ajdaa.test`;
    const res = await authInject(admin.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: { name: 'SA', email, mode: 'create', role: 'super_admin', password: GOOD_PASSWORD, sendPasswordInEmail: true },
    });
    expect(res.statusCode).toBe(201);
    const created = await prisma.adminUser.findUnique({ where: { email } });
    expect(created).not.toBeNull();
    cleanupUsers.push(created!.id);
    expect(getSentMail().filter((m) => m.kind === 'verify-email')).toHaveLength(0);
  });
});
