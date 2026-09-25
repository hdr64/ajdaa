import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_AR,
  INTEREST_TYPES,
  INTEREST_TYPE_AR,
  type InquiryStatus,
  type InterestType,
} from '../config/constants.js';

const createInquirySchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('').transform(() => null)),
  projectId: z.number().int().nullish(),
  projectTitle: z.string().nullish(),
  unitId: z.string().nullish(),
  unitNumber: z.string().nullish(),
  interestType: z.enum(INTEREST_TYPES),
  message: z.string().nullish(),
});

const inquiryStatusParamsSchema = z.object({ id: z.string().min(1) });

const inquiryStatusBodySchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
});

const listQuerySchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  projectId: z.coerce.number().int().optional(),
});

export const inquiryRoutes: FastifyPluginAsync = async (fastify) => {
  // Submit new customer inquiry (Public)
  fastify.post(
    '/',
    { preValidation: [validateBody(createInquirySchema)] },
    async (request, reply) => {
      const body = createInquirySchema.parse(request.body);
      const interestType = body.interestType as InterestType;

      // The CRM must not depend on the client sending display labels, so the
      // snapshots are resolved from the referenced rows and only fall back to
      // the request body when the row is gone (e.g. a deleted project).
      const [project, unit] = await Promise.all([
        body.projectId != null
          ? prisma.project.findUnique({ where: { id: body.projectId }, select: { title: true } })
          : null,
        body.unitId
          ? prisma.propertyUnit.findUnique({ where: { id: body.unitId }, select: { unitNumber: true } })
          : null,
      ]);

      const created = await prisma.customerInquiry.create({
        data: {
          name: body.name,
          phone: body.phone,
          email: body.email,
          projectId: body.projectId,
          projectTitle: project?.title ?? body.projectTitle,
          unitId: body.unitId,
          unitNumber: unit?.unitNumber ?? body.unitNumber,
          interestType,
          interestTypeAr: INTEREST_TYPE_AR[interestType],
          message: body.message,
          status: 'new',
          statusAr: 'جديد',
        },
      });

      // Notify admins via Realtime Socket
      const io = fastify.io;
      if (io) {
        io.emit('new_inquiry_received', created);
      }

      return reply.status(201).send(created);
    }
  );

  // Get all inquiries (Admin)
  fastify.get('/', { onRequest: [authenticate] }, async (request) => {
    const query = listQuerySchema.parse(request.query ?? {});

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;

    const inquiries = await prisma.customerInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return inquiries;
  });

  // Update inquiry status (Admin)
  fastify.patch(
    '/:id/status',
    { preValidation: [validateBody(inquiryStatusBodySchema)], onRequest: [authenticate] },
    async (request) => {
      const { id } = inquiryStatusParamsSchema.parse(request.params);
      const { status } = inquiryStatusBodySchema.parse(request.body) as { status: InquiryStatus };

      const updated = await prisma.customerInquiry.update({
        where: { id },
        data: {
          status,
          statusAr: INQUIRY_STATUS_AR[status],
        },
      });

      return updated;
    }
  );
};