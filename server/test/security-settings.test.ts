import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import { clearSentMail } from '../src/services/mailService.js';
import { authInject, closeApp, getApp, inject, SEED_ADMINS, SEED_PASSWORD, seedSession } from './helpers.js';

let superToken: string;
let managerToken: string;

const putSecurity = (token: string, payload: unknown) =>
  authInject(token, { method: 'PUT', url: '/api/settings/security', payload });

const startLogin = (email: string) =>
  inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: SEED_PASSWORD } });

beforeAll(async () => {
  await getApp();
  superToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  managerToken = (await seedSession(SEED_ADMINS.projectManager)).token;
});

beforeEach(() => clearSentMail());

afterAll(async () => {
  await putSecurity(superToken, { loginOtpRequired: false });
  await prisma.appSetting.deleteMany({ where: { key: 'security' } });
  await closeApp();
});

describe('Security settings (/api/settings/security)', () => {
  it('is super-admin only', async () => {
    expect((await inject({ method: 'GET', url: '/api/settings/security' })).statusCode).toBe(401);
    expect((await authInject(managerToken, { method: 'GET', url: '/api/settings/security' })).statusCode).toBe(403);
    expect((await putSecurity(managerToken, { loginOtpRequired: true })).statusCode).toBe(403);

    const view = await authInject(superToken, { method: 'GET', url: '/api/settings/security' });
    expect(view.statusCode).toBe(200);
    expect(view.json()).toEqual({ loginOtpRequired: false, loginOtpForcedByEnv: config.loginOtpRequired });
  });

  it('requiring the code for everyone turns a plain login into a code step, and back', async () => {
    const before = await startLogin(SEED_ADMINS.salesAgent);
    expect(before.json()).toHaveProperty('token');

    expect((await putSecurity(superToken, { loginOtpRequired: true })).statusCode).toBe(200);
    const during = await startLogin(SEED_ADMINS.salesAgent);
    expect(during.json()).toMatchObject({ otpRequired: true });
    expect(during.json()).not.toHaveProperty('token');

    await putSecurity(superToken, { loginOtpRequired: false });
    const after = await startLogin(SEED_ADMINS.salesAgent);
    expect(after.json()).toHaveProperty('token');
  });
});
