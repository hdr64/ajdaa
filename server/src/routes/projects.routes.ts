import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { serializeProject } from '../services/serializers.js';

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
});

type ProjectInput = z.infer<typeof projectSchema>;

const projectQuerySchema = z.object({
  city: z.string().trim().optional(),
  type: z.string().trim().optional(),
  priceType: z.string().trim().optional(),
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
  };
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all projects with floors and units
  fastify.get('/', async (request) => {
    const query = projectQuerySchema.parse(request.query ?? {});

    const where: Record<string, string> = {};
    if (query.city) where.city = query.city;
    if (query.type) where.type = query.type;
    if (query.priceType) where.priceType = query.priceType;

    const projects = await prisma.project.findMany({
      where,
      include: includeProjectRelations(),
      orderBy: { id: 'asc' },
    });

    return projects.map(serializeProject);
  });

  // Get project by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);

    const project = await prisma.project.findUnique({
      where: { id },
      include: includeProjectRelations(),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return serializeProject(project);
  });

  // Create new project (Admin)
  fastify.post(
    '/',
    { preValidation: [validateBody(projectSchema)], onRequest: [authenticate] },
    async (request, reply) => {
      const body = projectSchema.parse(request.body ?? {});
      const created = await prisma.project.create({
        data: toCreateData(body),
        include: includeProjectRelations(),
      });

      return reply.status(201).send(serializeProject(created));
    }
  );

  // Update project
  fastify.put(
    '/:id',
    { preValidation: [validateBody(projectSchema)], onRequest: [authenticate] },
    async (request) => {
      const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
      const body = projectSchema.parse(request.body ?? {});

      const updated = await prisma.project.update({
        where: { id },
        data: toCreateData(body),
        include: includeProjectRelations(),
      });

      return serializeProject(updated);
    }
  );

  // Delete project
  fastify.delete('/:id', { onRequest: [authenticate] }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
    await prisma.project.delete({ where: { id } });
    return { success: true };
  });
};