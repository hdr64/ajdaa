import type { ZodType, ZodTypeDef } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function validateBody<S extends ZodType<unknown, ZodTypeDef, unknown>>(
  schema: S
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        issues: result.error.flatten().fieldErrors,
      });
    }
    request.body = result.data;
  };
}