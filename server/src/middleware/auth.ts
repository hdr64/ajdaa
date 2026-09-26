import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../services/prisma.js';
import type { AdminPermission, AuthenticatedAdmin } from '../types/fastify.js';

function parsePermissions(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Loads the admin from the database on every request: the token only proves
 * identity, while role, status and permissions can change after it was issued
 * (suspension, demotion, deletion) and must take effect immediately.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
  }

  const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });
  if (!user || user.status !== 'active') {
    return reply.status(401).send({ error: 'Unauthorized: Account is no longer active' });
  }

  request.admin = {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: parsePermissions(user.permissions),
  };
}

export function hasPermission(admin: AuthenticatedAdmin | undefined, permission: AdminPermission): boolean {
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  return admin.permissions[permission] === true;
}

/** Must run after `authenticate` (both as onRequest hooks, in that order). */
export function requirePermission(permission: AdminPermission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    if (!hasPermission(request.admin, permission)) {
      return reply.status(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
}
