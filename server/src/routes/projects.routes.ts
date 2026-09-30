import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { serializeProject, serializeFloor } from '../services/serializers.js';
import { PUBLISH_STATUSES, type PublishStatus } from '../config/constants.js';

const projectSchema = z.object({
  type: z.string().min(1),
  typeAr: z.string().min(1),
  typeEn: z.string().nullish(),
  title: z.string().min(1),
  titleEn: z.string().nullish(),
  price: z.number().nullish(),
  priceLabel: z.string().nullish(),
  priceType: z.string().min(1),
  priceTypeEn: z.string().nullish(),
  status: z.string().nullish(),
  statusEn: z.string().nullish(),
  publishStatus: z.enum(PUBLISH_STATUSES).optional(),
  area: z.number().nonnegative(),
  rooms: z.number().int().nullish(),
  bathrooms: z.number().int().nullish(),
  unitsCount: z.string().nullish(),
  unitsCountEn: z.string().nullish(),
  city: z.string().min(1),
  cityEn: z.string().nullish(),
  image: z.string().min(1),
  gallery: z.array(z.string()).default([]),
  description: z.string().nullish(),
  descriptionEn: z.string().nullish(),
  badge: z.string().nullish(),
  badgeEn: z.string().nullish(),
  features: z.array(z.string()).default([]),
  featuresEn: z.array(z.string()).default([]),
  videoUrl: z.string().nullish(),
  virtualTour3dAvailable: z.boolean().default(false),
  locationHighlightsAr: z.array(z.string()).default([]),
  locationHighlightsEn: z.array(z.string()).default([]),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  brochureUrl: z.string().nullish(),
});

type ProjectInput = z.infer<typeof projectSchema>;

const projectQuerySchema = z.object({
  city: z.string().trim().optional(),
  type: z.string().trim().optional(),
  priceType: z.string().trim().optional(),
  scope: z.enum(['admin']).optional(),
  status: z.enum(PUBLISH_STATUSES).optional(),
});

const projectGetQuerySchema = z.object({
  scope: z.enum(['admin']).optional(),
});

const publishBodySchema = z.object({
  publishStatus: z.enum(PUBLISH_STATUSES),
});

const idParamsSchema = z.object({ id: z.coerce.number().int() });

const createFloorSchema = z.object({
  floorNumber: z.number().int(),
  floorNameAr: z.string().trim().min(1),
  floorNameEn: z.string().nullish(),
  descriptionAr: z.string().nullish(),
  descriptionEn: z.string().nullish(),
  totalArea: z.number().nonnegative().nullish(),
});

const updateFloorSchema = createFloorSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const floorParamsSchema = z.object({
  id: z.coerce.number().int(),
  floorNumber: z.coerce.number().int(),
});

function includeProjectRelations() {
  return {
    floors: {
      orderBy: { floorNumber: 'asc' as const },
      include: { units: { orderBy: { unitNumber: 'asc' as const } } },
    },
  };
}

function toCreateData(input: ProjectInput) {
  return {
    type: input.type,
    typeAr: input.typeAr,
    typeEn: input.typeEn,
    title: input.title,
    titleEn: input.titleEn,
    price: input.price,
    priceLabel: input.priceLabel,
    priceType: input.priceType,
    priceTypeEn: input.priceTypeEn,
    status: input.status,
    statusEn: input.statusEn,
    area: input.area,
    rooms: input.rooms,
    bathrooms: input.bathrooms,
    unitsCount: input.unitsCount,
    unitsCountEn: input.unitsCountEn,
    city: input.city,
    cityEn: input.cityEn,
    image: input.image,
    gallery: JSON.stringify(input.gallery),
    description: input.description,
    descriptionEn: input.descriptionEn,
    badge: input.badge,
    badgeEn: input.badgeEn,
    features: JSON.stringify(input.features),
    featuresEn: JSON.stringify(input.featuresEn),
    videoUrl: input.videoUrl,
    virtualTour3dAvailable: input.virtualTour3dAvailable,
    locationHighlightsAr: JSON.stringify(input.locationHighlightsAr),
    locationHighlightsEn: JSON.stringify(input.locationHighlightsEn),
    lat: input.lat,
    lng: input.lng,
    brochureUrl: input.brochureUrl,
  };
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all projects with floors and units
  fastify.get('/', async (request, reply) => {
    const query = projectQuerySchema.parse(request.query ?? {});

    const where: Record<string, unknown> = {};
    if (query.city) where.city = query.city;
    if (query.type) where.type = query.type;
    if (query.priceType) where.priceType = query.priceType;

    if (query.scope === 'admin') {
      await authenticate(request, reply);
      if (reply.sent) return;

      if (query.status) {
        where.publishStatus = query.status;
      }
    } else {
      where.publishStatus = 'published';
    }

    const projects = await prisma.project.findMany({
      where,
      include: includeProjectRelations(),
      orderBy: { id: 'asc' },
    });

    return projects.map(serializeProject);
  });

  // Get project by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const query = projectGetQuerySchema.parse(request.query ?? {});

    if (query.scope === 'admin') {
      await authenticate(request, reply);
      if (reply.sent) return;

      const project = await prisma.project.findUnique({
        where: { id },
        include: includeProjectRelations(),
      });

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return serializeProject(project);
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: includeProjectRelations(),
    });

    if (!project || project.publishStatus !== 'published') {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return serializeProject(project);
  });

  // Create new project (Admin)
  fastify.post(
    '/',
    { preValidation: [validateBody(projectSchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const body = projectSchema.parse(request.body ?? {});
      const publishStatus = body.publishStatus ?? 'draft';
      const publishedAt = publishStatus === 'published' ? new Date() : null;

      const created = await prisma.project.create({
        data: {
          ...toCreateData(body),
          publishStatus,
          publishedAt,
        },
        include: includeProjectRelations(),
      });

      return reply.status(201).send(serializeProject(created));
    }
  );

  // Duplicate a project with its floors and units (Admin)
  fastify.post(
    '/:id/duplicate',
    { onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);

      const source = await prisma.project.findUnique({
        where: { id },
        include: { floors: { include: { units: true } } },
      });
      if (!source) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // One transaction: a failure part-way must not leave a half-copied project.
      const created = await prisma.$transaction(async (tx) => {
        // A copy is never live on its own; publishing stays a deliberate act.
        // Everything but identity, timestamps and publish state is copied, so a
        // field added to Project later is carried over without touching this.
        const {
          id: _id,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          publishStatus: _publishStatus,
          publishedAt: _publishedAt,
          floors,
          ...content
        } = source;
        const project = await tx.project.create({
          data: {
            ...content,
            title: `${source.title} (نسخة)`,
            titleEn: source.titleEn ? `${source.titleEn} (copy)` : null,
            publishStatus: 'draft',
            publishedAt: null,
          },
        });

        for (const floor of floors) {
          await tx.propertyFloor.create({
            data: {
              projectId: project.id,
              floorNumber: floor.floorNumber,
              floorNameAr: floor.floorNameAr,
              floorNameEn: floor.floorNameEn,
              descriptionAr: floor.descriptionAr,
              descriptionEn: floor.descriptionEn,
              totalArea: floor.totalArea,
              units: {
                create: floor.units.map(({ id: _unitId, floorId: _floorId, updatedAt: _unitUpdatedAt, ...unit }) => ({
                  ...unit,
                  // Unit ids are global keys that inquiries point at, so a copy
                  // mints fresh ones instead of reusing the source's.
                  id: `p${project.id}-${randomUUID().slice(0, 8)}`,
                  // A brand-new project cannot inherit sold/rented units.
                  status: 'available',
                  statusAr: 'متاح',
                  statusEn: 'Available',
                })),
              },
            },
          });
        }

        return tx.project.findUniqueOrThrow({
          where: { id: project.id },
          include: includeProjectRelations(),
        });
      });

      return reply.status(201).send(serializeProject(created));
    }
  );

  // Update project
  fastify.put(
    '/:id',
    { preValidation: [validateBody(projectSchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = projectSchema.parse(request.body ?? {});

      const existing = await prisma.project.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const updateData: Record<string, unknown> = {
        ...toCreateData(body),
      };

      if (body.publishStatus !== undefined) {
        updateData.publishStatus = body.publishStatus;
        if (body.publishStatus === 'published' && !existing.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }

      const updated = await prisma.project.update({
        where: { id },
        data: updateData,
        include: includeProjectRelations(),
      });

      return serializeProject(updated);
    }
  );

  // Update publish status (Admin)
  fastify.patch(
    '/:id/publish',
    { preValidation: [validateBody(publishBodySchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = publishBodySchema.parse(request.body ?? {});

      const existing = await prisma.project.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const updateData: { publishStatus: PublishStatus; publishedAt?: Date } = {
        publishStatus: body.publishStatus,
      };

      if (body.publishStatus === 'published' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }

      const updated = await prisma.project.update({
        where: { id },
        data: updateData,
        include: includeProjectRelations(),
      });

      return serializeProject(updated);
    }
  );

  // Delete project
  fastify.delete('/:id', { onRequest: [authenticate, requirePermission('manageProjects')] }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
    await prisma.project.delete({ where: { id } });
    return { success: true };
  });

  // Create floor inside a project (Admin)
  fastify.post(
    '/:id/floors',
    { preValidation: [validateBody(createFloorSchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = createFloorSchema.parse(request.body ?? {});

      const project = await prisma.project.findUnique({ where: { id } });
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const duplicate = await prisma.propertyFloor.findFirst({
        where: { projectId: id, floorNumber: body.floorNumber },
      });
      if (duplicate) {
        return reply.status(409).send({ error: 'Floor number already used in this project' });
      }

      const created = await prisma.propertyFloor.create({
        data: {
          projectId: id,
          floorNumber: body.floorNumber,
          floorNameAr: body.floorNameAr,
          floorNameEn: body.floorNameEn,
          descriptionAr: body.descriptionAr,
          descriptionEn: body.descriptionEn,
          totalArea: body.totalArea,
        },
        include: { units: true },
      });

      return reply.status(201).send(serializeFloor(created));
    }
  );

  // Update floor (Admin)
  fastify.put(
    '/:id/floors/:floorNumber',
    { preValidation: [validateBody(updateFloorSchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id, floorNumber } = floorParamsSchema.parse(request.params);
      const body = updateFloorSchema.parse(request.body ?? {});

      const floor = await prisma.propertyFloor.findFirst({
        where: { projectId: id, floorNumber },
      });
      if (!floor) {
        return reply.status(404).send({ error: 'Floor not found' });
      }

      // Units carry a copy of their floor's name; a rename must update both in
      // one transaction or the old name keeps showing wherever units are listed.
      const renamesUnits = body.floorNameAr !== undefined || body.floorNameEn !== undefined;
      const updated = await prisma.$transaction(async (tx) => {
        if (renamesUnits) {
          await tx.propertyUnit.updateMany({
            where: { floorId: floor.id },
            data: {
              ...(body.floorNameAr !== undefined ? { floorNameAr: body.floorNameAr } : {}),
              ...(body.floorNameEn !== undefined ? { floorNameEn: body.floorNameEn } : {}),
            },
          });
        }
        return tx.propertyFloor.update({
          where: { id: floor.id },
          data: body,
          include: { units: true },
        });
      });

      return serializeFloor(updated);
    }
  );

  // Delete floor and its units (Admin)
  fastify.delete(
    '/:id/floors/:floorNumber',
    { onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id, floorNumber } = floorParamsSchema.parse(request.params);

      const floor = await prisma.propertyFloor.findFirst({
        where: { projectId: id, floorNumber },
        include: { units: true },
      });
      if (!floor) {
        return reply.status(404).send({ error: 'Floor not found' });
      }

      // Units hold the live status, so admins must be told what disappeared.
      const io = fastify.io;
      if (io) {
        for (const unit of floor.units) {
          io.emit('unit_removed', { unitId: unit.id, floorId: floor.id, projectId: id });
        }
      }

      await prisma.propertyFloor.delete({ where: { id: floor.id } });
      return { success: true };
    }
  );
};