import type { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
  }
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = request.user as { role?: string } | undefined;
    if (!payload?.role || !roles.includes(payload.role)) {
      reply.status(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
}