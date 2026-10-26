import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail, getSentMail } from '../src/services/mailService.js';
import { totpCodeAt } from '../src/services/totpService.js';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  removeUser,
  seedSession,
  SEED_ADMINS,
  THROWAWAY_PASSWORD,
  type TestSession,
} from './helpers.js';

/**
 * Authenticator-app (TOTP) 2FA over the real HTTP surface: enrollment, login,
 * recovery codes, the mandatory-for-everyone switch and the admin reset. The
 * pure algorithm is covered separately in `totpService.test.ts`.
 */

const SUPER = SEED_ADMINS.superAdmin;

let superSession: TestSession;
const cleanupUsers: string[] = [];

/** The live code a device would show for a displayed secret, offset by whole steps. */
function codeFor(secretDisplay: string, offsetSteps = 0): string {
  const secret = secretDisplay.replace(/\s/g, '');
  const code = totpCodeAt(secret, Math.floor(Date.now() / 1000) + offsetSteps * 30);
  if (!code) throw new Error(`Secret is not base32: ${secretDisplay}`);
  return code;
}

/** A 6-digit value guaranteed not to be inside the ±1 window, so a rejection is meaningful. */
function wrongCode(secretDisplay: string): string {
  const inWindow = new Set([codeFor(secretDisplay, -1), codeFor(secretDisplay, 0), codeFor(secretDisplay, 1)]);
  for (let candidate = 0; candidate < 1000; candidate += 1) {
    const code = candidate.toString().padStart(6, '0');
    if (!inWindow.has(code)) return code;
  }
  throw new Error('Could not find a wrong code');
}

interface Enrolled {
  session: TestSession;
  secret: string;
  recoveryCodes: string[];
}

/** Creates an active throwaway admin, signs in, and switches authenticator 2FA on. */
async function enrolledAdmin(overrides: Parameters<typeof createThrowawayUser>[0] = {}): Promise<Enrolled> {
  const created = await createThrowawayUser(overrides);
  cleanupUsers.push(created.id);
  const session = await login(created.email, THROWAWAY_PASSWORD);
  const { secret, recoveryCodes } = await enableTotp(session.token);
  return { session, secret, recoveryCodes };
}

/** Runs setup then enable with a live code; returns the secret and the one-time codes. */
async function enableTotp(token: string, password = THROWAWAY_PASSWORD): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await authInject(token, {
    method: 'POST',
    url: '/api/auth/me/totp/setup',
    payload: { currentPassword: password },
  });
  expect(setup.statusCode).toBe(200);
  const { secret } = setup.json() as { secret: string; otpauthUri: string };

  const enable = await authInject(token, {
    method: 'POST',
    url: '/api/auth/me/totp/enable',
    payload: { code: codeFor(secret) },
  });
  expect(enable.statusCode).toBe(200);
  const { recoveryCodes } = enable.json() as { recoveryCodes: string[] };
  return { secret, recoveryCodes };
}

/** Starts a TOTP login and returns the challenge id. */
async function startTotpLogin(email: string, password = THROWAWAY_PASSWORD): Promise<string> {
  const response = await inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { totpRequired?: boolean; challengeId?: string; token?: string };
  expect(body.totpRequired).toBe(true);
  expect(body.token).toBeUndefined();
  return body.challengeId!;
}

async function setSwitch(value: boolean): Promise<void> {
  const response = await authInject(superSession.token, {
    method: 'PUT',
    url: '/api/settings/security',
    payload: { totpRequiredForAll: value },
  });
  expect(response.statusCode).toBe(200);
  expect((response.json() as { totpRequiredForAll: boolean }).totpRequiredForAll).toBe(value);
}

beforeAll(async () => {
  await getApp();
  superSession = await seedSession(SUPER);
});

beforeEach(() => {
  clearSentMail();
});

// The switch is global process state; a failing test must not leak it.
afterEach(async () => {
  await setSwitch(false);
});

afterAll(async () => {
  for (const id of cleanupUsers) {
    await removeUser(id);
  }
  await closeApp();
});

describe('enrollment from the profile', () => {
  it('shows the secret and URI once, refuses a wrong password, and only enables on a live code', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);
    const session = await login(created.email, THROWAWAY_PASSWORD);

    const wrongPassword = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/setup',
      payload: { currentPassword: 'not-the-password' },
    });
    expect(wrongPassword.statusCode).toBe(401);

    const setup = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/setup',
      payload: { currentPassword: THROWAWAY_PASSWORD },
    });
    expect(setup.statusCode).toBe(200);
    const setupBody = setup.json() as { secret: string; otpauthUri: string };
    expect(setupBody.secret).toMatch(/^([A-Z2-7]{4} )+[A-Z2-7]{0,4}$/);
    expect(setupBody.otpauthUri).toContain('otpauth://totp/');
    expect(setupBody.otpauthUri).toContain('algorithm=SHA1');

    const badCode = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/enable',
      payload: { code: wrongCode(setupBody.secret) },
    });
    expect(badCode.statusCode).toBe(400);

    // Still off after a failed confirmation.
    const midway = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect((midway.json() as { user: { totpEnabled: boolean } }).user.totpEnabled).toBe(false);

    const enabled = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/enable',
      payload: { code: codeFor(setupBody.secret) },
    });
    expect(enabled.statusCode).toBe(200);
    const enabledBody = enabled.json() as { recoveryCodes: string[] };
    expect(enabledBody.recoveryCodes).toHaveLength(10);
    for (const code of enabledBody.recoveryCodes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    }
    // The enable response must never echo the secret back.
    expect(JSON.stringify(enabledBody)).not.toContain(setupBody.secret.replace(/ /g, ''));

    const me = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    const meBody = me.json() as { user: { totpEnabled: boolean; recoveryCodesLeft: number } };
    expect(meBody.user.totpEnabled).toBe(true);
    expect(meBody.user.recoveryCodesLeft).toBe(10);
    // The secret never appears in the profile payload.
    expect(me.body).not.toContain(setupBody.secret.replace(/ /g, ''));

    expect(await prisma.adminUser.findUnique({ where: { id: created.id }, select: { totpSecretEnc: true } })).not.toBeNull();
    // At rest the secret is an AES box, never the plaintext.
    const stored = await prisma.adminUser.findUnique({ where: { id: created.id } });
    expect(stored?.totpSecretEnc).not.toContain(setupBody.secret.replace(/ /g, ''));
    expect(stored?.totpEnabledAt).not.toBeNull();
  });

  it('refuses a second setup once enabled and an enable before any setup', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);
    const session = await login(created.email, THROWAWAY_PASSWORD);

    const early = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/enable',
      payload: { code: '123456' },
    });
    expect(early.statusCode).toBe(400);

    await enableTotp(session.token);

    const again = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/setup',
      payload: { currentPassword: THROWAWAY_PASSWORD },
    });
    expect(again.statusCode).toBe(409);
  });
});

describe('login with an authenticator app', () => {
  it('requires the app code, supersedes the emailed code, and issues a session on success', async () => {
    const { session, secret } = await enrolledAdmin();

    // Both factors asked for: the app code must win and no mail may be sent.
    await prisma.adminUser.update({
      where: { email: session.email },
      data: { loginOtpEnabled: true },
    });
    clearSentMail();

    const challengeId = await startTotpLogin(session.email);
    expect(getSentMail().filter((m) => m.kind === 'login-otp')).toHaveLength(0);

    const wrong = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId, code: wrongCode(secret) },
    });
    expect(wrong.statusCode).toBe(400);

    const ok = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId, code: codeFor(secret) },
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as { token: string; user: { totpEnabled: boolean } };
    expect(body.token).toBeTruthy();
    expect(body.user.totpEnabled).toBe(true);
    expect((await authInject(body.token, { method: 'GET', url: '/api/auth/me' })).statusCode).toBe(200);
  });

  it('refuses to replay a code that was already accepted', async () => {
    const { session, secret } = await enrolledAdmin();
    const code = codeFor(secret);

    const first = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code },
    });
    expect(first.statusCode).toBe(200);

    const replay = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code },
    });
    expect(replay.statusCode).toBe(410);
  });

  it('keeps the app challenge and the emailed-code challenge separate', async () => {
    const { session } = await enrolledAdmin();
    const challengeId = await startTotpLogin(session.email);

    const crossPurpose = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-otp',
      payload: { challengeId, code: '123456' },
    });
    expect(crossPurpose.statusCode).toBe(410);

    const unknown = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: 'no-such-challenge', code: '123456' },
    });
    expect(unknown.statusCode).toBe(410);
  });
});

describe('recovery codes at login', () => {
  it('accepts a recovery code exactly once and decrements the remaining count', async () => {
    const { session, recoveryCodes } = await enrolledAdmin();
    const [first, second] = recoveryCodes;

    const used = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code: first },
    });
    expect(used.statusCode).toBe(200);
    expect((used.json() as { recoveryCodesLeft: number }).recoveryCodesLeft).toBe(9);

    const me = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect((me.json() as { user: { recoveryCodesLeft: number } }).user.recoveryCodesLeft).toBe(9);

    // The same code must not work again…
    const reuse = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code: first },
    });
    expect(reuse.statusCode).toBe(400);

    // …while a different one still does.
    const another = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code: second },
    });
    expect(another.statusCode).toBe(200);
    expect((another.json() as { recoveryCodesLeft: number }).recoveryCodesLeft).toBe(8);
  });
});

describe('disable and regenerate', () => {
  it('disables with password + recovery code and restores password-only login', async () => {
    const { session, recoveryCodes } = await enrolledAdmin();

    const wrongPassword = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/disable',
      payload: { currentPassword: 'nope-nope', code: recoveryCodes[0] },
    });
    expect(wrongPassword.statusCode).toBe(401);

    const wrongCodeAttempt = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/disable',
      payload: { currentPassword: THROWAWAY_PASSWORD, code: 'WRONG-WRONG' },
    });
    expect(wrongCodeAttempt.statusCode).toBe(400);

    const disabled = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/disable',
      payload: { currentPassword: THROWAWAY_PASSWORD, code: recoveryCodes[0] },
    });
    expect(disabled.statusCode).toBe(200);

    const after = await login(session.email, THROWAWAY_PASSWORD);
    expect(after.token).toBeTruthy();

    const me = await authInject(after.token, { method: 'GET', url: '/api/auth/me' });
    const meBody = me.json() as { user: { totpEnabled: boolean; recoveryCodesLeft: number } };
    expect(meBody.user.totpEnabled).toBe(false);
    expect(meBody.user.recoveryCodesLeft).toBe(0);

    const stored = await prisma.adminUser.findUnique({ where: { id: session.id } });
    expect(stored?.totpSecretEnc).toBeNull();
    expect(await prisma.recoveryCode.count({ where: { adminUserId: session.id } })).toBe(0);
  });

  it('regenerates ten fresh codes, retiring the previous ones', async () => {
    const { session, recoveryCodes } = await enrolledAdmin();

    const regenerated = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/recovery-codes',
      payload: { currentPassword: THROWAWAY_PASSWORD, code: recoveryCodes[0] },
    });
    expect(regenerated.statusCode).toBe(200);
    const fresh = (regenerated.json() as { recoveryCodes: string[] }).recoveryCodes;
    expect(fresh).toHaveLength(10);
    expect(fresh.some((code) => recoveryCodes.includes(code))).toBe(false);

    const me = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect((me.json() as { user: { recoveryCodesLeft: number } }).user.recoveryCodesLeft).toBe(10);

    // An old code is dead; a fresh one works.
    const old = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code: recoveryCodes[1] },
    });
    expect(old.statusCode).toBe(400);

    const useFresh = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code: fresh[0] },
    });
    expect(useFresh.statusCode).toBe(200);
  });
});

describe('mandatory for everyone', () => {
  it('is off by default', async () => {
    const view = await authInject(superSession.token, { method: 'GET', url: '/api/settings/security' });
    expect(view.statusCode).toBe(200);
    const body = view.json() as { totpRequiredForAll: boolean; loginOtpRequired: boolean };
    expect(body.totpRequiredForAll).toBe(false);
    // An unrelated switch still round-trips through the same endpoint.
    expect(typeof body.loginOtpRequired).toBe('boolean');
  });

  it('forces enrollment for a non-enrolled admin, super admins included', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);

    await setSwitch(true);

    const blocked = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: created.email, password: THROWAWAY_PASSWORD },
    });
    expect(blocked.statusCode).toBe(200);
    const body = blocked.json() as { totpEnrollmentRequired?: boolean; enrollToken?: string; token?: string };
    expect(body.totpEnrollmentRequired).toBe(true);
    expect(body.enrollToken).toBeTruthy();
    expect(body.token).toBeUndefined();

    // The seeded super admin is not exempt either.
    const superLogin = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: SUPER, password: 'password' },
    });
    expect(superLogin.statusCode).toBe(200);
    expect((superLogin.json() as { totpEnrollmentRequired?: boolean }).totpEnrollmentRequired).toBe(true);
  });

  it('enrolls through the scope-limited token and refuses that token everywhere else', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);
    await setSwitch(true);

    const login = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: created.email, password: THROWAWAY_PASSWORD },
    });
    const { enrollToken } = login.json() as { enrollToken: string };

    // The enrollment token is useless as a session.
    expect((await authInject(enrollToken, { method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
    expect(
      (
        await authInject(enrollToken, {
          method: 'POST',
          url: '/api/auth/me/totp/setup',
          payload: { currentPassword: THROWAWAY_PASSWORD },
        })
      ).statusCode
    ).toBe(401);

    const setup = await authInject(enrollToken, { method: 'POST', url: '/api/auth/login/enroll-totp/setup' });
    expect(setup.statusCode).toBe(200);
    const { secret } = setup.json() as { secret: string; otpauthUri: string };

    const verify = await authInject(enrollToken, {
      method: 'POST',
      url: '/api/auth/login/enroll-totp/verify',
      payload: { code: codeFor(secret) },
    });
    expect(verify.statusCode, `enroll verify body: ${verify.body}`).toBe(200);
    const verified = verify.json() as { token: string; recoveryCodes: string[]; user: { totpEnabled: boolean } };
    expect(verified.token).toBeTruthy();
    expect(verified.recoveryCodes).toHaveLength(10);
    expect(verified.user.totpEnabled).toBe(true);

    // The real session works; the enrollment token still does not.
    expect((await authInject(verified.token, { method: 'GET', url: '/api/auth/me' })).statusCode).toBe(200);
    expect((await authInject(enrollToken, { method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
  });

  it('does not let a plain session token reach the enrollment endpoints', async () => {
    const response = await authInject(superSession.token, { method: 'POST', url: '/api/auth/login/enroll-totp/setup' });
    expect(response.statusCode).toBe(401);
  });

  it('stops forcing enrollment once the switch is turned back off', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);

    await setSwitch(true);
    const forced = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: created.email, password: THROWAWAY_PASSWORD },
    });
    expect((forced.json() as { totpEnrollmentRequired?: boolean }).totpEnrollmentRequired).toBe(true);

    await setSwitch(false);
    const free = await login(created.email, THROWAWAY_PASSWORD);
    expect(free.token).toBeTruthy();
  });

  it('keeps a non-super-admin from switching it off by disabling their own TOTP', async () => {
    const { session, recoveryCodes } = await enrolledAdmin({ role: 'project_manager', permissions: { manageUsers: true } });
    await setSwitch(true);

    const attempt = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/disable',
      payload: { currentPassword: THROWAWAY_PASSWORD, code: recoveryCodes[0] },
    });
    expect(attempt.statusCode).toBe(403);

    // A super admin may still opt out for themselves.
    const superDisable = await authInject(superSession.token, {
      method: 'POST',
      url: '/api/auth/me/totp/disable',
      payload: { currentPassword: 'password', code: '000000' },
    });
    // The super admin has no TOTP, so this is a "not enabled" rejection, not a 403.
    expect(superDisable.statusCode).toBe(400);
  });
});

describe('admin reset', () => {
  it('requires manageUsers and forbids a non-super-admin from touching a super admin', async () => {
    const { session } = await enrolledAdmin();

    const viewer = await createThrowawayUser({ role: 'viewer' });
    cleanupUsers.push(viewer.id);
    const viewerSession = await login(viewer.email, THROWAWAY_PASSWORD);
    const forbidden = await authInject(viewerSession.token, {
      method: 'POST',
      url: `/api/auth/users/${session.id}/reset-totp`,
    });
    expect(forbidden.statusCode).toBe(403);

    await prisma.adminUser.update({ where: { id: session.id }, data: { role: 'super_admin' } });
    const manager = await createThrowawayUser({ role: 'project_manager', permissions: { manageUsers: true } });
    cleanupUsers.push(manager.id);
    const managerSession = await login(manager.email, THROWAWAY_PASSWORD);
    const superTarget = await authInject(managerSession.token, {
      method: 'POST',
      url: `/api/auth/users/${session.id}/reset-totp`,
    });
    expect(superTarget.statusCode).toBe(403);
  });

  it('wipes the second factor, mails the target, and lets them log in with a password again', async () => {
    const { session } = await enrolledAdmin();

    const blocked = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: session.email, password: THROWAWAY_PASSWORD },
    });
    expect((blocked.json() as { totpRequired?: boolean }).totpRequired).toBe(true);

    clearSentMail();
    const reset = await authInject(superSession.token, {
      method: 'POST',
      url: `/api/auth/users/${session.id}/reset-totp`,
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ reset: true });

    const mail = getSentMail().find((m) => m.kind === 'totp-reset');
    expect(mail?.to).toBe(session.email);

    const target = await prisma.adminUser.findUnique({ where: { id: session.id } });
    expect(target?.totpEnabledAt).toBeNull();
    expect(target?.totpSecretEnc).toBeNull();
    expect(await prisma.recoveryCode.count({ where: { adminUserId: session.id } })).toBe(0);

    // Password-only login works again.
    const after = await login(session.email, THROWAWAY_PASSWORD);
    expect(after.token).toBeTruthy();
  });

  it('rejects a reset for an account without TOTP and an unknown id', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);

    const notEnabled = await authInject(superSession.token, {
      method: 'POST',
      url: `/api/auth/users/${created.id}/reset-totp`,
    });
    expect(notEnabled.statusCode).toBe(400);

    const missing = await authInject(superSession.token, {
      method: 'POST',
      url: '/api/auth/users/no-such-user/reset-totp',
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('review fixes', () => {
  it('accepts any of the ten recovery codes to regenerate or disable, not just the first', async () => {
    const { session, recoveryCodes } = await enrolledAdmin();

    const regenerated = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/recovery-codes',
      payload: { currentPassword: THROWAWAY_PASSWORD, code: recoveryCodes[7] },
    });
    expect(regenerated.statusCode).toBe(200);
    const fresh = (regenerated.json() as { recoveryCodes: string[] }).recoveryCodes;

    const disabled = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/disable',
      payload: { currentPassword: THROWAWAY_PASSWORD, code: fresh[4] },
    });
    expect(disabled.statusCode).toBe(200);
  });

  it('refuses enable on a live account and keeps its recovery codes', async () => {
    const { session, secret, recoveryCodes } = await enrolledAdmin();

    const again = await authInject(session.token, {
      method: 'POST',
      url: '/api/auth/me/totp/enable',
      payload: { code: codeFor(secret) },
    });
    expect(again.statusCode).toBe(409);

    const stillValid = await inject({
      method: 'POST',
      url: '/api/auth/login/verify-totp',
      payload: { challengeId: await startTotpLogin(session.email), code: recoveryCodes[9] },
    });
    expect(stillValid.statusCode).toBe(200);
  });

  it('answers a suspended account like any wrong login until the password is right', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);
    await prisma.adminUser.update({ where: { id: created.id }, data: { status: 'suspended' } });

    const wrongPassword = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: created.email, password: 'definitely-wrong-1' },
    });
    expect(wrongPassword.statusCode).toBe(401);

    const rightPassword = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: created.email, password: THROWAWAY_PASSWORD },
    });
    expect(rightPassword.statusCode).toBe(403);
  });

  it('revokes the target\'s live session when an admin sets their password', async () => {
    const created = await createThrowawayUser();
    cleanupUsers.push(created.id);
    const session = await login(created.email, THROWAWAY_PASSWORD);

    // Tokens carry whole-second timestamps; the change must land in a later second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const changed = await authInject(superSession.token, {
      method: 'PUT',
      url: `/api/auth/users/${created.id}`,
      payload: { password: 'Another-Strong-Pass-42' },
    });
    expect(changed.statusCode).toBe(200);

    const stale = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(stale.statusCode).toBe(401);
  });
});
