import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authInject,
  closeApp,
  getApp,
  removeUser,
  seedSession,
  SEED_ADMINS,
  THROWAWAY_PASSWORD,
  type TestSession,
} from './helpers.js';

/** The admin user create and update endpoints must store the phone they accept. */

let superSession: TestSession;
const created: string[] = [];

beforeAll(async () => {
  await getApp();
  superSession = await seedSession(SEED_ADMINS.superAdmin);
});

afterAll(async () => {
  for (const id of created) await removeUser(id);
  await closeApp();
});

describe('phone on admin users', () => {
  it('stores the phone on create, updates it, and clears it with an empty value', async () => {
    const create = await authInject(superSession.token, {
      method: 'POST',
      url: '/api/auth/users',
      payload: {
        name: 'Phone Tester',
        email: `phone-${Date.now()}@example.test`,
        password: THROWAWAY_PASSWORD,
        role: 'viewer',
        permissions: {},
        phone: '+966501112233',
      },
    });
    expect(create.statusCode).toBe(201);
    const user = create.json() as { id: string; phone: string | null };
    created.push(user.id);
    expect(user.phone).toBe('+966501112233');

    const update = await authInject(superSession.token, {
      method: 'PUT',
      url: `/api/auth/users/${user.id}`,
      payload: { phone: '+966504445566' },
    });
    expect(update.statusCode).toBe(200);
    expect((update.json() as { phone: string | null }).phone).toBe('+966504445566');

    // Omitting the field leaves it alone; an empty string clears it.
    const rename = await authInject(superSession.token, {
      method: 'PUT',
      url: `/api/auth/users/${user.id}`,
      payload: { name: 'Phone Tester Two' },
    });
    expect((rename.json() as { phone: string | null }).phone).toBe('+966504445566');

    const clear = await authInject(superSession.token, {
      method: 'PUT',
      url: `/api/auth/users/${user.id}`,
      payload: { phone: '' },
    });
    expect((clear.json() as { phone: string | null }).phone).toBeNull();
  });
});
