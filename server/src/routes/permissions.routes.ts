import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { PERMISSION_CATALOGUE } from '../config/permissions.js';

export const permissionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { onRequest: [authenticate] }, async () => {
    return PERMISSION_CATALOGUE;
  });
};
