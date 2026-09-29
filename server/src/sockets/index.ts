import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';
import { prisma } from '../services/prisma.js';
import { hasPermission } from '../middleware/auth.js';
import type { JwtPayload } from '../types/fastify.js';

/**
 * Inquiries carry customer PII, so they only go to this room. Unit status
 * events stay public because the website renders live availability.
 */
export const INQUIRIES_ROOM = 'inquiries';
export const ADMINS_ROOM = 'admins';

async function resolveAuthenticatedAdmin(
  fastify: FastifyInstance,
  token: unknown
): Promise<{ id: string; email: string; role: string; permissions: Record<string, boolean> } | null> {
  if (typeof token !== 'string' || token.length === 0) return null;

  let payload: JwtPayload;
  try {
    payload = fastify.jwt.verify<JwtPayload>(token);
  } catch {
    return null;
  }

  const user = await prisma.adminUser.findUnique({ where: { id: payload.id } });
  if (!user || user.status !== 'active') return null;

  let permissions: Record<string, boolean> = {};
  try {
    permissions = JSON.parse(user.permissions) as Record<string, boolean>;
  } catch {
    // Malformed permissions grant nothing.
  }

  return { id: user.id, email: user.email, role: user.role, permissions };
}

export function attachSockets(fastify: FastifyInstance): SocketIOServer {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: config.clientOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  fastify.decorate('io', io);

  io.on('connection', async (socket) => {
    fastify.log.info(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      fastify.log.info(`[Socket.io] Client disconnected: ${socket.id}`);
    });

    // Anonymous visitors stay connected for public unit updates; only verified admins
    // are admitted to admin and PII rooms.
    try {
      const admin = await resolveAuthenticatedAdmin(fastify, socket.handshake.auth?.token);
      if (admin) {
        await socket.join(ADMINS_ROOM);
        if (hasPermission(admin, 'viewInquiries')) {
          await socket.join(INQUIRIES_ROOM);
        }
      }
    } catch (err) {
      fastify.log.error({ err }, '[Socket.io] Failed to authorize socket');
    }
  });

  return io;
}
