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

async function canReceiveInquiries(fastify: FastifyInstance, token: unknown): Promise<boolean> {
  if (typeof token !== 'string' || token.length === 0) return false;

  let payload: JwtPayload;
  try {
    payload = fastify.jwt.verify<JwtPayload>(token);
  } catch {
    return false;
  }

  const user = await prisma.adminUser.findUnique({ where: { id: payload.id } });
  if (!user || user.status !== 'active') return false;

  let permissions: Record<string, boolean> = {};
  try {
    permissions = JSON.parse(user.permissions) as Record<string, boolean>;
  } catch {
    // Malformed permissions grant nothing.
  }

  return hasPermission({ id: user.id, email: user.email, role: user.role, permissions }, 'viewInquiries');
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

    // Anonymous visitors stay connected for unit updates; only verified admins
    // are admitted to the PII room.
    try {
      if (await canReceiveInquiries(fastify, socket.handshake.auth?.token)) {
        await socket.join(INQUIRIES_ROOM);
      }
    } catch (err) {
      fastify.log.error({ err }, '[Socket.io] Failed to authorize socket');
    }
  });

  return io;
}
