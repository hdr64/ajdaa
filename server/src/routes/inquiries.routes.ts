import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
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

const updateInquiryBodySchema = z
  .object({
    notes: z.string().nullable().optional(),
    status: z.enum(INQUIRY_STATUSES).optional(),
  })
  .refine((data) => data.notes !== undefined || data.status !== undefined, {
    message: 'At least one field must be provided',
  });

function escapeCsvCell(value: string | null | undefined): string {
  if (value == null) return '';
  let str = String(value);

  // CSV/formula-injection defense: prefix a single quote to any cell starting with = + - @ TAB or CR
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 quoting: quote fields containing comma, quote, CR/LF; double inner quotes
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

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
      escapeCsvCell(inq.createdAt.toISOString()),
      escapeCsvCell(inq.name),
      escapeCsvCell(inq.phone),
      escapeCsvCell(inq.email),
      escapeCsvCell(inq.projectTitle),
      escapeCsvCell(inq.unitNumber),
      escapeCsvCell(inq.interestTypeAr),
      escapeCsvCell(inq.statusAr),
      escapeCsvCell(inq.message),
      escapeCsvCell(inq.notes),
    ]);

    const headerLine = headers.join(',');
    const dataLines = rows.map((r) => r.join(','));
    const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n') + '\r\n';

    const dateStr = new Date().toISOString().slice(0, 10);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="inquiries-${dateStr}.csv"`);

    return reply.send(csv);
  });

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

      // Notify authorized admins only: the payload contains customer PII.
      fastify.io?.to(INQUIRIES_ROOM).emit('new_inquiry_received', created);

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