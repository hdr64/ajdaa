import type { FastifyInstance } from 'fastify';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { prisma } from '../src/services/prisma.js';
import {
  authInject,
  closeApp,
  getApp,
  inject,
  SEED_ADMINS,
  seedSession,
  sleep,
  waitFor,
} from './helpers.js';

/**
 * The developer notes are split in two:
 *
 * - submitting a note needs a session (any signed-in admin), and the author
 *   is taken from that session, never from the body;
 * - managing the notes needs a super admin *and* the shared developer key.
 */

const DEV_KEY = config.developer.secretKey;

const sockets: Socket[] = [];
let app: FastifyInstance;
let baseUrl = '';
let superAdminToken: string;
let viewerToken: string;
let viewerEmail: string;

function openSocket(token?: string): Socket {
  const socket = token
    ? connectSocket(baseUrl, { transports: ['websocket'], auth: { token } })
    : connectSocket(baseUrl, { transports: ['websocket'] });
  sockets.push(socket);
  return socket;
}

function collect<T>(socket: Socket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

function connected(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function serverRooms(socket: Socket): string[] {
  const rooms = socket.id ? app.io?.sockets.sockets.get(socket.id)?.rooms : undefined;
  return rooms ? Array.from(rooms) : [];
}

beforeAll(async () => {
  app = await getApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP address after listen()');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  superAdminToken = (await seedSession(SEED_ADMINS.superAdmin)).token;
  const viewer = await seedSession(SEED_ADMINS.viewer);
  viewerToken = viewer.token;
  viewerEmail = viewer.email;
});

afterAll(async () => {
  for (const socket of sockets) {
    socket.disconnect();
    socket.close();
  }
  await prisma.developerNote.deleteMany({ where: { section: 'guard-test' } });
  await closeApp();
});

describe('submitting a developer note', () => {
  it('refuses an anonymous submission', async () => {
    const response = await inject({
      method: 'POST',
      url: '/api/developer/notes',
      payload: { title: 'Anonymous', section: 'guard-test', body: 'No session.' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('accepts a note from a signed-in admin', async () => {
    const response = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: { title: 'Broken hero', section: 'guard-test', body: 'The hero is broken.' },
    });

    expect(response.statusCode).toBe(201);
  });

  it('takes the author from the session and ignores the email in the body', async () => {
    const response = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: {
        title: 'Spoofed author',
        section: 'guard-test',
        body: 'The body claims a different author.',
        adminEmail: 'attacker@evil.test',
      },
    });

    expect(response.statusCode).toBe(201);

    const { note } = response.json() as { note: { adminEmail: string | null } };
    expect(note.adminEmail).toBe(viewerEmail);
    expect(note.adminEmail).not.toBe('attacker@evil.test');
  });

  it('caps the length of every free-text field', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['title', { title: 'x'.repeat(201) }],
      ['body', { body: 'x'.repeat(5001) }],
      ['solution', { solution: 'x'.repeat(5001) }],
      ['screenshotUrl', { screenshotUrl: `https://cdn.test/${'x'.repeat(500)}` }],
    ];

    for (const [field, payload] of cases) {
      const response = await authInject(viewerToken, {
        method: 'POST',
        url: '/api/developer/notes',
        payload: {
          title: 'Length check',
          section: 'guard-test',
          body: 'A body that is long enough.',
          ...payload,
        },
      });

      expect(response.statusCode, `${field} must be capped`).toBe(400);
    }
  });

  it('only accepts an https or /uploads/ screenshot', async () => {
    const rejected = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: {
        title: 'Tracker',
        section: 'guard-test',
        body: 'A body.',
        screenshotUrl: 'http://evil.test/tracker.png',
      },
    });
    expect(rejected.statusCode).toBe(400);

    const script = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: {
        title: 'Script',
        section: 'guard-test',
        body: 'A body.',
        screenshotUrl: 'javascript:alert(1)',
      },
    });
    expect(script.statusCode).toBe(400);

    const markdown = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: {
        title: 'Markdown',
        section: 'guard-test',
        body: 'A body.',
        screenshotUrl: 'https://cdn.test/a.png) [click](javascript:alert(1)',
      },
    });
    expect(markdown.statusCode).toBe(400);

    const local = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: {
        title: 'Local screenshot',
        section: 'guard-test',
        body: 'A body.',
        screenshotUrl: '/uploads/local.png',
      },
    });
    expect(local.statusCode).toBe(201);

    const remote = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: {
        title: 'Remote screenshot',
        section: 'guard-test',
        body: 'A body.',
        screenshotUrl: 'https://cdn.test/shot.png',
      },
    });
    expect(remote.statusCode).toBe(201);
  });
});

describe('managing the developer notes', () => {
  it('refuses an anonymous listing', async () => {
    const response = await inject({ method: 'GET', url: '/api/developer/notes' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a super admin without the developer key', async () => {
    const response = await authInject(superAdminToken, { method: 'GET', url: '/api/developer/notes' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses the key in the query string', async () => {
    const response = await authInject(superAdminToken, {
      method: 'GET',
      url: `/api/developer/notes?key=${encodeURIComponent(DEV_KEY)}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a non-super admin with the key', async () => {
    const response = await authInject(viewerToken, {
      method: 'GET',
      url: '/api/developer/notes',
      headers: { 'x-dev-notes-key': DEV_KEY },
    });

    expect(response.statusCode).toBe(403);
  });

  it('accepts a super admin with the key in the header', async () => {
    const response = await authInject(superAdminToken, {
      method: 'GET',
      url: '/api/developer/notes',
      headers: { 'x-dev-notes-key': DEV_KEY },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { success: boolean }).success).toBe(true);
  });
});

describe('the note event only reaches the admins room', () => {
  it('is delivered to a signed-in admin and not to an anonymous socket', async () => {
    const anonymous = openSocket();
    const admin = openSocket(viewerToken);
    await Promise.all([connected(anonymous), connected(admin)]);

    // The room join follows an async lookup on the server.
    await waitFor(
      () => serverRooms(anonymous).length > 0,
      'the anonymous socket to be registered on the server'
    );
    expect(serverRooms(anonymous)).not.toContain('admins');
    await waitFor(() => serverRooms(admin).includes('admins'), 'the admin socket to join "admins"');

    const anonymousEvents = collect(anonymous, 'developer:note:new');
    const adminEvents = collect(admin, 'developer:note:new');

    const created = await authInject(viewerToken, {
      method: 'POST',
      url: '/api/developer/notes',
      payload: { title: 'Realtime note', section: 'guard-test', body: 'A body.' },
    });
    expect(created.statusCode).toBe(201);

    await waitFor(() => adminEvents.length > 0, 'the admin socket to receive the note');
    await sleep(300);

    expect(adminEvents).toHaveLength(1);
    expect(anonymousEvents).toHaveLength(0);
  });
});
