import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';

export function attachSockets(fastify: FastifyInstance): SocketIOServer {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: config.clientOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  fastify.decorate('io', io);

  io.on('connection', (socket) => {
    fastify.log.info(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      fastify.log.info(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}