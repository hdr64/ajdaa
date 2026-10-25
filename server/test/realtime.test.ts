import type { FastifyInstance } from 'fastify';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authInject,
  closeApp,
  getApp,
  inject,
  seedSession,
  sleep,
  waitFor,
} from './helpers.js';

const sockets: Socket[] = [];
let app: FastifyInstance;
let baseUrl = '';

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

/** Server-side room membership, read from the Socket.io registry. */
function serverRooms(socket: Socket): string[] {
  const rooms = socket.id ? app.io?.sockets.sockets.get(socket.id)?.rooms : undefined;
  return rooms ? Array.from(rooms) : [];
}

beforeAll(async () => {
  app = await getApp();
  // Port 0 lets the OS pick a free port; 127.0.0.1 keeps the handshake local.
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP address after listen()');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const socket of sockets) {
    socket.disconnect();
    socket.close();
  }
  await closeApp();
});

describe('realtime events respect the inquiries room', () => {
  it('delivers a new inquiry only to authenticated admins with viewInquiries', async () => {
    const viewer = await seedSession('turki.d@ajdaa.sa');

    const anonymous = openSocket();
    const admin = openSocket(viewer.token);
    await Promise.all([connected(anonymous), connected(admin)]);

    // The room join follows an async permission lookup on the server, so wait
    // for the actual membership instead of sleeping a guessed interval.
    await waitFor(
      () => serverRooms(anonymous).length > 0,
      'the anonymous socket to be registered on the server'
    );
    expect(serverRooms(anonymous)).not.toContain('inquiries');
    await waitFor(() => serverRooms(admin).includes('inquiries'), 'the viewer socket to join "inquiries"');

    const anonymousInquiries = collect(anonymous, 'new_inquiry_received');
    const adminInquiries = collect(admin, 'new_inquiry_received');

    const created = await inject({
      method: 'POST',
      url: '/api/inquiries',
      payload: { name: 'T', interestType: 'general' },
    });
    expect(created.statusCode).toBe(201);

    await waitFor(() => adminInquiries.length > 0, 'the admin socket to receive the inquiry');
    await sleep(300);

    expect(adminInquiries).toHaveLength(1);
    expect(anonymousInquiries).toHaveLength(0);
  });
});

describe('unit availability stays public', () => {
  it('broadcasts a status change to anonymous and authenticated clients alike', async () => {
    const admin = await seedSession('admin@ajdaa.sa');

    // A throwaway unit keeps the assertion independent of the seeded fixture data.
    const projects = (await inject({ method: 'GET', url: '/api/projects' })).json() as {
      floors: { id: number }[];
    }[];
    const floorId = projects[0]?.floors[0]?.id;
    if (floorId === undefined) {
      throw new Error('Seed did not produce any floor to attach the test unit to');
    }

    const unitId = `realtime-${Date.now().toString(36)}`;
    const createdUnit = await authInject(admin.token, {
      method: 'POST',
      url: '/api/units',
      payload: {
        floorId,
        id: unitId,
        unitNumber: 'RT-1',
        floorNumber: 1,
        floorNameAr: 'طابق الاختبار',
        type: 'office',
        typeAr: 'مكتب',
        area: 100,
        status: 'available',
      },
    });
    expect(createdUnit.statusCode).toBe(201);

    const anonymous = openSocket();
    const salesAgentSocket = openSocket((await seedSession('reem.q@ajdaa.sa')).token);
    await Promise.all([connected(anonymous), connected(salesAgentSocket)]);

    const anonymousEvents = collect<{ unitId: string; status: string }>(
      anonymous,
      'unit_status_updated'
    );
    const agentEvents = collect<{ unitId: string; status: string }>(
      salesAgentSocket,
      'unit_status_updated'
    );

    const patched = await authInject(admin.token, {
      method: 'PATCH',
      url: `/api/units/${unitId}/status`,
      payload: { status: 'sold' },
    });
    expect(patched.statusCode).toBe(200);

    await waitFor(
      () => anonymousEvents.length > 0 && agentEvents.length > 0,
      'both sockets to receive the unit status update'
    );

    expect(anonymousEvents[0]).toMatchObject({ unitId, status: 'sold' });
    expect(agentEvents[0]).toMatchObject({ unitId, status: 'sold' });
  });
});
