import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authInject, closeApp, createThrowawayUser, getApp, inject, login, removeUser } from './helpers.js';

let userId: string;
let token: string;

beforeAll(async () => {
  await getApp();
  const user = await createThrowawayUser();
  userId = user.id;
  token = (await login(user.email)).token;
});

afterAll(async () => {
  await removeUser(userId);
  await closeApp();
});

const getPrefs = () => authInject(token, { method: 'GET', url: '/api/auth/me/preferences' });
const putPrefs = (payload: unknown) => authInject(token, { method: 'PUT', url: '/api/auth/me/preferences', payload });

describe('Admin preferences (/api/auth/me/preferences)', () => {
  it('requires sign-in', async () => {
    expect((await inject({ method: 'GET', url: '/api/auth/me/preferences' })).statusCode).toBe(401);
  });

  it('starts empty and stores "don\'t ask again" choices, de-duplicated', async () => {
    expect((await getPrefs()).json()).toEqual({ skipConfirm: [] });

    const saved = await putPrefs({ skipConfirm: ['user.status', 'project.publish', 'user.status'] });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ skipConfirm: ['user.status', 'project.publish'] });
    expect((await getPrefs()).json()).toEqual({ skipConfirm: ['user.status', 'project.publish'] });

    // Resetting from the profile page is just an empty list.
    await putPrefs({ skipConfirm: [] });
    expect((await getPrefs()).json()).toEqual({ skipConfirm: [] });
  });

  it('refuses to remember anything but the known reversible toggles', async () => {
    expect((await putPrefs({ skipConfirm: ['project.delete'] })).statusCode).toBe(400);
    expect((await putPrefs({ skipConfirm: 'user.status' })).statusCode).toBe(400);
  });
});
