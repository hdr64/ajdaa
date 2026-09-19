import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/prisma.js';

export const unitRoutes: FastifyPluginAsync = async (fastify) => {
  // Update unit status & broadcast live to all clients
  fastify.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'available' | 'reserved' | 'rented' | 'sold' };

    if (!status) {
      return reply.status(400).send({ error: 'Status is required' });
    }

    const statusArMap: Record<string, string> = {
      available: 'متاح',
      reserved: 'محجوز',
      rented: 'مؤجر',
      sold: 'مباع'
    };

    const statusEnMap: Record<string, string> = {
      available: 'Available',
      reserved: 'Reserved',
      rented: 'Rented',
      sold: 'Sold'
    };

    const updated = await prisma.propertyUnit.update({
      where: { id },
      data: {
        status,
        statusAr: statusArMap[status] || status,
        statusEn: statusEnMap[status] || status
      }
    });

    // Broadcast live WebSocket event via Socket.io
    const io = (fastify as any).io;
    if (io) {
      io.emit('unit_status_updated', {
        unitId: updated.id,
        status: updated.status,
        statusAr: updated.statusAr,
        statusEn: updated.statusEn,
        floorId: updated.floorId
      });
    }

    return updated;
  });
};
