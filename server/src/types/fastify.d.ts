import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import '@fastify/jwt';

export interface JwtPayload {
  id: string;
  email: string;
  /**
   * Absent on the short-lived TOTP enrollment token, which is not a session:
   * `authenticate` rejects any token carrying a `scope`, so a role is pointless
   * there and its absence keeps the two token shapes distinguishable.
   */
  role?: string;
  /**
   * Present only on the 10-minute enrollment token minted by `/login` when TOTP
   * is mandatory and the admin has not set it up yet. `authenticate` rejects it;
   * only `authenticateTotpEnroll` accepts it.
   */
  scope?: 'totp_enroll';
  iat?: number;
  exp?: number;
}

export type AdminPermission =
  | 'manageProjects'
  | 'viewProjects'
  | 'createProject'
  | 'editProject'
  | 'deleteProject'
  | 'publishProject'
  | 'manageCms'
  | 'manageClients'
  | 'managePastProjects'
  | 'rollbackCms'
  | 'manageUnits'
  | 'viewInquiries'
  | 'viewApplications'
  | 'manageApplications'
  | 'exportData'
  | 'manageUsers'
  | 'verifyUsers'
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
