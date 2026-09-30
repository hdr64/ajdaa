import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { config } from '../config/env.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_AR,
  INTEREST_TYPES,
  INTEREST_TYPE_AR,
  type InquiryStatus,
  type InterestType,
} from '../config/constants.js';
import { INQUIRIES_ROOM } from '../sockets/index.js';
import { buildCsv, sendCsv } from '../services/csv.js';
import { notifyNewInquiry } from '../services/notificationService.js';

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
  website: z.string().nullish(),
  // Milliseconds the form was open, measured by the browser (no clock-skew issue).
  elapsedMs: z.coerce.number().nullish(),
});

const inquiryStatusParamsSchema = z.object({ id: z.string().min(1) });

const inquiryStatusBodySchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
});

const listQuerySchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  projectId: z.coerce.number().int().optional(),
});

const updateInquiryBodySchema = z
  .object({
    notes: z.string().nullable().optional(),
    status: z.enum(INQUIRY_STATUSES).optional(),
  })
  .refine((data) => data.notes !== undefined || data.status !== undefined, {
    message: 'At least one field must be provided',
  });


export const inquiryRoutes: FastifyPluginAsync = async (fastify) => {
  // Export inquiries to CSV (Admin) - registered before :id routes to prevent shadowing
  fastify.get('/export', { onRequest: [authenticate, requirePermission('exportData')] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query ?? {});

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;

    const inquiries = await prisma.customerInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'createdAt',
      'name',
      'phone',
      'email',
      'projectTitle',
      'unitNumber',
      'interestTypeAr',
      'status',
      'message',
      'notes',
    ];

    const rows = inquiries.map((inq) => [
      inq.createdAt.toISOString(),
      inq.name,
      inq.phone,
      inq.email,
      inq.projectTitle,
      inq.unitNumber,
      inq.interestTypeAr,
      inq.statusAr,
      inq.message,
      inq.notes,
    ]);

    return sendCsv(reply, 'inquiries', buildCsv(headers, rows));
  });

  // Submit new customer inquiry (Public)
  fastify.post(
    '/',
    {
      config: {
        rateLimit: {
          max: config.rateLimitInquiriesMax,
          timeWindow: config.rateLimitInquiriesWindowMs,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقاً / Rate limit exceeded, please try again later',
          }),
        },
      },
      preValidation: [validateBody(createInquirySchema)],
    },
    async (request, reply) => {
      const body = createInquirySchema.parse(request.body);
      const interestType = body.interestType as InterestType;

      // Spam protection check (honeypot or too fast submission < 2s)
      const isHoneypot = Boolean(body.website && body.website.trim().length > 0);
      const isTooFast = body.elapsedMs != null && body.elapsedMs < 2000;

      if (isHoneypot || isTooFast) {
        const now = new Date();
        return reply.status(200).send({
          id: crypto.randomUUID(),
          createdAt: now.toISOString(),
          name: body.name,
          phone: body.phone ?? null,
          email: body.email ?? null,
          projectId: body.projectId ?? null,
          projectTitle: body.projectTitle ?? null,
          unitId: body.unitId ?? null,
          unitNumber: body.unitNumber ?? null,
          interestType,
          interestTypeAr: INTEREST_TYPE_AR[interestType],
          message: body.message ?? null,
          notes: null,
          status: 'new',
          statusAr: 'جديد',
          updatedAt: now.toISOString(),
        });
      }

      // The CRM must not depend on the client sending display labels, so the
      // snapshots are resolved from the referenced rows and only fall back to
      let project: { title: string; publishStatus: string } | null = null;
      if (body.projectId != null) {
        project = await prisma.project.findUnique({
          where: { id: body.projectId },
          select: { title: true, publishStatus: true },
        });
        if (!project || project.publishStatus !== 'published') {
          return reply.status(404).send({ error: 'Project not found' });
        }
      }

      const unit = body.unitId
        ? await prisma.propertyUnit.findUnique({ where: { id: body.unitId }, select: { unitNumber: true } })
        : null;

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

      // Notify authorized admins only: the payload contains customer PII.
      fastify.io?.to(INQUIRIES_ROOM).emit('new_inquiry_received', created);

      // Fire-and-forget: the client already has its 201 and an SMTP hiccup must
      // not turn a captured lead into a failed request.
      void notifyNewInquiry({
        name: created.name,
        phone: created.phone,
        email: created.email,
        projectTitle: created.projectTitle,
        unitNumber: created.unitNumber,
        interestTypeAr: created.interestTypeAr,
        message: created.message,
      }).catch((error: unknown) => {
        request.log.error({ err: error }, 'Failed to send new-inquiry notifications');
      });

      return reply.status(201).send(created);
    }
  );

  // Get all inquiries (Admin)
  fastify.get('/', { onRequest: [authenticate, requirePermission('viewInquiries')] }, async (request) => {
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

  // Update inquiry notes / status (Admin)
  fastify.patch(
    '/:id',
    { preValidation: [validateBody(updateInquiryBodySchema)], onRequest: [authenticate, requirePermission('viewInquiries')] },
    async (request) => {
      const { id } = inquiryStatusParamsSchema.parse(request.params);
      const body = updateInquiryBodySchema.parse(request.body ?? {});

      const data: { notes?: string | null; status?: InquiryStatus; statusAr?: string } = {};
      if (body.notes !== undefined) {
        data.notes = body.notes;
      }
      if (body.status !== undefined) {
        data.status = body.status;
        data.statusAr = INQUIRY_STATUS_AR[body.status];
      }

      const updated = await prisma.customerInquiry.update({
        where: { id },
        data,
      });

      return updated;
    }
  );

  // Update inquiry status (Admin) - legacy endpoint kept for compatibility
  fastify.patch(
    '/:id/status',
    { preValidation: [validateBody(inquiryStatusBodySchema)], onRequest: [authenticate, requirePermission('viewInquiries')] },
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

  // Delete customer inquiry (Super Admin only - PII protection)
  fastify.delete(
    '/:id',
    { onRequest: [authenticate] },
    async (request, reply) => {
      if (request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Forbidden: super_admin required' });
      }

      const { id } = inquiryStatusParamsSchema.parse(request.params);
      await prisma.customerInquiry.delete({ where: { id } });

      return reply.status(200).send({ success: true });
    }
  );
};