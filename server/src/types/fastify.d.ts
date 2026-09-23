import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import '@fastify/jwt';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export type AuthenticatedUser = JwtPayload;

export type AuthenticateFunction = (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: AuthenticateFunction;
    io: SocketIOServer | undefined;
  }
}