import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { serializeUnit } from '../services/serializers.js';
import { UNIT_STATUSES, UNIT_STATUS_AR, UNIT_STATUS_EN, type UnitStatus } from '../config/constants.js';
import { ADMINS_ROOM } from '../sockets/index.js';

const statusParamsSchema = z.object({ id: z.string().min(1) });

const statusBodySchema = z.object({
  status: z.enum(UNIT_STATUSES),
});

const createUnitSchema = z.object({
  floorId: z.number().int().positive(),
  id: z.string().trim().min(1).optional(),
  unitNumber: z.string().trim().min(1),
  floorNumber: z.number().int(),
  floorNameAr: z.string().trim().min(1),
  floorNameEn: z.string().nullish(),
  sectionAr: z.string().nullish(),
  type: z.string().min(1),
  typeAr: z.string().min(1),
  typeEn: z.string().nullish(),
  area: z.number().nonnegative(),
  priceLabel: z.string().nullish(),
  status: z.enum(UNIT_STATUSES).default('available'),
  statusEn: z.string().nullish(),
  features: z.array(z.string()).default([]),
  featuresEn: z.array(z.string()).default([]),
});

const updateUnitSchema = createUnitSchema.omit({ floorId: true, id: true }).partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

type CreateUnitInput = z.infer<typeof createUnitSchema>;
type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const unitRoutes: FastifyPluginAsync = async (fastify) => {
  // Broadcast live WebSocket event via Socket.io. Published projects broadcast to all,
  // unpublished projects broadcast only to verified admin sockets.
  const broadcastStatus = (
    unit: { id: string; status: string; statusAr: string; statusEn: string | null; floorId: number },
    isPublished = true
  ) => {
    const io = fastify.io;
    if (!io) return;
    const payload = {
      unitId: unit.id,
      status: unit.status,
      statusAr: unit.statusAr,
      statusEn: unit.statusEn,
      floorId: unit.floorId,
    };
    if (isPublished) {
      io.emit('unit_status_updated', payload);
    } else {
      io.to(ADMINS_ROOM).emit('unit_status_updated', payload);
    }
  };

  // Update unit status & broadcast live to all clients (Admin)
  fastify.patch(
    '/:id/status',
    { preValidation: [validateBody(statusBodySchema)], onRequest: [authenticate, requirePermission('manageUnits')] },
    async (request, reply) => {
      const { id } = statusParamsSchema.parse(request.params);
      const { status } = statusBodySchema.parse(request.body) as { status: UnitStatus };

      const existing = await prisma.propertyUnit.findUnique({
        where: { id },
        include: { floor: { select: { project: { select: { publishStatus: true } } } } },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Unit not found' });
      }

      const updated = await prisma.propertyUnit.update({
        where: { id },
        data: {
          status,
          statusAr: UNIT_STATUS_AR[status],
          statusEn: UNIT_STATUS_EN[status],
        },
      });

      const isPublished = existing.floor?.project?.publishStatus === 'published';
      broadcastStatus(updated, isPublished);

      return serializeUnit(updated);
    }
  );

  // Create unit inside an existing floor (Admin)
  fastify.post(
    '/',
    { preValidation: [validateBody(createUnitSchema)], onRequest: [authenticate, requirePermission('manageUnits')] },
    async (request, reply) => {
      const body = createUnitSchema.parse(request.body ?? {}) as CreateUnitInput;

      const floor = await prisma.propertyFloor.findUnique({
        where: { id: body.floorId },
        include: { project: { select: { publishStatus: true } } },
      });
      if (!floor) {
        return reply.status(404).send({ error: 'Floor not found' });
      }

      // Ids are human-readable strings used in URLs, so collisions must fail loudly.
      if (body.id) {
        const existing = await prisma.propertyUnit.findUnique({ where: { id: body.id } });
        if (existing) {
          return reply.status(409).send({ error: 'Unit id already exists' });
        }
      }

      const created = await prisma.propertyUnit.create({
        data: {
          id: body.id ?? `unit-${crypto.randomUUID()}`,
          floorId: body.floorId,
          unitNumber: body.unitNumber,
          floorNumber: body.floorNumber,
          floorNameAr: body.floorNameAr,
          floorNameEn: body.floorNameEn,
          sectionAr: body.sectionAr,
          type: body.type,
          typeAr: body.typeAr,
          typeEn: body.typeEn,
          area: body.area,
          priceLabel: body.priceLabel,
          status: body.status,
          statusAr: UNIT_STATUS_AR[body.status],
          statusEn: UNIT_STATUS_EN[body.status],
          features: JSON.stringify(body.features),
          featuresEn: JSON.stringify(body.featuresEn),
        },
      });

      const isPublished = floor.project?.publishStatus === 'published';
      broadcastStatus(created, isPublished);

      return reply.status(201).send(serializeUnit(created));
    }
  );

  // Update unit fields (Admin). Broadcasts when the status changed.
  fastify.put(
    '/:id',
    { preValidation: [validateBody(updateUnitSchema)], onRequest: [authenticate, requirePermission('manageUnits')] },
    async (request, reply) => {
      const { id } = statusParamsSchema.parse(request.params);
      const body = updateUnitSchema.parse(request.body ?? {}) as UpdateUnitInput;

      const existing = await prisma.propertyUnit.findUnique({
        where: { id },
        include: { floor: { select: { project: { select: { publishStatus: true } } } } },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Unit not found' });
      }

      const status = body.status as UnitStatus | undefined;
      const updated = await prisma.propertyUnit.update({
        where: { id },
        data: {
          unitNumber: body.unitNumber,
          floorNumber: body.floorNumber,
          floorNameAr: body.floorNameAr,
          floorNameEn: body.floorNameEn,
          sectionAr: body.sectionAr,
          type: body.type,
          typeAr: body.typeAr,
          typeEn: body.typeEn,
          area: body.area,
          priceLabel: body.priceLabel,
          status,
          statusAr: status ? UNIT_STATUS_AR[status] : undefined,
          statusEn: status ? UNIT_STATUS_EN[status] : body.statusEn,
          features: body.features ? JSON.stringify(body.features) : undefined,
          featuresEn: body.featuresEn ? JSON.stringify(body.featuresEn) : undefined,
        },
      });

      if (status && status !== existing.status) {
        const isPublished = existing.floor?.project?.publishStatus === 'published';
        broadcastStatus(updated, isPublished);
      }

      return serializeUnit(updated);
    }
  );

  // Delete unit (Admin)
  fastify.delete('/:id', { onRequest: [authenticate, requirePermission('manageUnits')] }, async (request, reply) => {
    const { id } = statusParamsSchema.parse(request.params);

    const existing = await prisma.propertyUnit.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Unit not found' });
    }

    await prisma.propertyUnit.delete({ where: { id } });

    // Other tabs still hold the unit in their local project state.
    fastify.io?.emit('unit_removed', { unitId: id, floorId: existing.floorId });

    return { success: true };
  });
};