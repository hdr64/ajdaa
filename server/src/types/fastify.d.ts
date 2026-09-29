import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import '@fastify/jwt';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export type AdminPermission =
  | 'manageProjects'
  | 'manageUnits'
  | 'viewInquiries'
  | 'exportData'
  | 'manageUsers'
  | 'manageNotifications';

/** The admin as currently stored in the database, resolved by `authenticate`. */
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
}

export type AuthenticateFunction = (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply | void>;

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

  interface FastifyRequest {
    admin?: AuthenticatedAdmin;
  }
}
