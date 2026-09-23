import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { UNIT_STATUSES, UNIT_STATUS_AR, UNIT_STATUS_EN, type UnitStatus } from '../config/constants.js';

const statusParamsSchema = z.object({ id: z.string().min(1) });

const statusBodySchema = z.object({
  status: z.enum(UNIT_STATUSES),
});

export const unitRoutes: FastifyPluginAsync = async (fastify) => {
  // Update unit status & broadcast live to all clients (Admin)
  fastify.patch(
    '/:id/status',
    { preValidation: [validateBody(statusBodySchema)], onRequest: [authenticate] },
    async (request) => {
      const { id } = statusParamsSchema.parse(request.params);
      const { status } = statusBodySchema.parse(request.body) as { status: UnitStatus };

      const updated = await prisma.propertyUnit.update({
        where: { id },
        data: {
          status,
          statusAr: UNIT_STATUS_AR[status],
          statusEn: UNIT_STATUS_EN[status],
        },
      });

      // Broadcast live WebSocket event via Socket.io
      const io = fastify.io;
      if (io) {
        io.emit('unit_status_updated', {
          unitId: updated.id,
          status: updated.status,
          statusAr: updated.statusAr,
          statusEn: updated.statusEn,
          floorId: updated.floorId,
        });
      }

      return updated;
    }
  );
};