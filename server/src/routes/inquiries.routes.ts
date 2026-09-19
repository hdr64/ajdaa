import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/prisma.js';

export const inquiryRoutes: FastifyPluginAsync = async (fastify) => {
  // Submit new customer inquiry (Public)
  fastify.post('/', async (request, reply) => {
    const body = request.body as any;

    if (!body.name || !body.interestType) {
      return reply.status(400).send({ error: 'Name and interest type are required' });
    }

    const interestArMap: Record<string, string> = {
      rent: 'استئجار',
      buy: 'شراء',
      invest: 'استثمار',
      general: 'عام'
    };

    const created = await prisma.customerInquiry.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        projectId: body.projectId ? parseInt(body.projectId, 10) : undefined,
        projectTitle: body.projectTitle,
        unitId: body.unitId,
        unitNumber: body.unitNumber,
        interestType: body.interestType,
        interestTypeAr: interestArMap[body.interestType] || 'استئجار',
        message: body.message,
        status: 'new',
        statusAr: 'جديد'
      }
    });

    // Notify admins via Realtime Socket
    const io = (fastify as any).io;
    if (io) {
      io.emit('new_inquiry_received', created);
    }

    return reply.status(201).send(created);
  });

  // Get all inquiries (Admin)
  fastify.get('/', { onRequest: [(fastify as any).authenticate] }, async (request) => {
    const query = request.query as { status?: string; projectId?: string };
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = parseInt(query.projectId, 10);

    const inquiries = await prisma.customerInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return inquiries;
  });

  // Update inquiry status (Admin)
  fastify.patch('/:id/status', { onRequest: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'new' | 'contacted' | 'closed' };

    const statusArMap: Record<string, string> = {
      new: 'جديد',
      contacted: 'تم التواصل',
      closed: 'مغلق'
    };

    const updated = await prisma.customerInquiry.update({
      where: { id },
      data: {
        status,
        statusAr: statusArMap[status] || status
      }
    });

    return updated;
  });
};
