import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authInject,
  closeApp,
  createThrowawayUser,
  getApp,
  inject,
  login,
  readJwtTimes,
  removeUser,
  SEED_ADMINS,
  SEED_PASSWORD,
  seedSession,
  type TestSession,
} from './helpers.js';

const TWELVE_HOURS_IN_SECONDS = 12 * 60 * 60;

let throwaways: TestSession[] = [];

/**
 * `exp` is a registered claim, so an already-expired token is byte-for-byte the
 * shape the app itself issues. The claims object is a variable on purpose:
 * `JwtPayload` in `src/types/fastify.d.ts` describes only the custom claims, and
 * an inline literal would be rejected by excess-property checking.
 */
function expiredToken(app: FastifyInstance, session: TestSession): string {
  const claims = {
    id: session.id,
    email: session.email,
    role: session.role,
    exp: Math.floor(Date.now() / 1000) - 60,
  };
  return app.jwt.sign(claims);
}

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  for (const user of throwaways) {
    await removeUser(user.id);
  }
  await closeApp();
});

describe('token lifetime', () => {
  it('issues tokens that expire exactly 12 hours after they are issued', async () => {
    const app = await getApp();
    const session = await seedSession(SEED_ADMINS.viewer);

    const { iat, exp } = readJwtTimes(app, session.token);

    expect(typeof iat).toBe('number');
    expect(exp - iat).toBe(TWELVE_HOURS_IN_SECONDS);
  });

  it('rejects a token whose exp is already in the past', async () => {
    const app = await getApp();
    const session = await seedSession(SEED_ADMINS.viewer);

    const expired = expiredToken(app, session);

    const { exp } = readJwtTimes(app, expired);
    expect(exp).toBeLessThan(Math.floor(Date.now() / 1000));

    const response = await authInject(expired, { method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });
});

describe('a token does not outlive the account behind it', () => {
  it('stops working the moment a super admin suspends the user', async () => {
    const user = await createThrowawayUser({ role: 'viewer' });
    throwaways.push(user);

    const session = await login(user.email, SEED_PASSWORD);

    const before = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(before.statusCode).toBe(200);

    const superAdmin = await seedSession(SEED_ADMINS.superAdmin);
    const suspended = await authInject(superAdmin.token, {
      method: 'PUT',
      url: `/api/auth/users/${user.id}`,
      payload: { status: 'suspended' },
    });
    expect(suspended.statusCode).toBe(200);

    // Same, still unexpired token: `authenticate` re-reads the account on every
    // request, so the permission change takes effect immediately.
    const after = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(after.statusCode).toBe(401);

    // And the credentials themselves are refused too.
    const relogin = await inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: SEED_PASSWORD },
    });
    expect(relogin.statusCode).toBe(403);
  });

  it('rejects a request that carries no token at all', async () => {
    const response = await inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });
});
