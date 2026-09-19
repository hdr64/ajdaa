import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/prisma.js';

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function formatProject(p: any) {
  return {
    ...p,
    gallery: parseJsonArray(p.gallery),
    features: parseJsonArray(p.features),
    featuresEn: parseJsonArray(p.featuresEn),
    locationHighlightsAr: parseJsonArray(p.locationHighlightsAr),
    locationHighlightsEn: parseJsonArray(p.locationHighlightsEn),
    floors: (p.floors || []).map((fl: any) => ({
      ...fl,
      units: (fl.units || []).map((u: any) => ({
        ...u,
        features: parseJsonArray(u.features),
        featuresEn: parseJsonArray(u.featuresEn)
      }))
    }))
  };
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all projects with floors and units
  fastify.get('/', async (request) => {
    const query = request.query as { city?: string; type?: string; priceType?: string };
    const where: any = {};

    if (query.city) where.city = query.city;
    if (query.type) where.type = query.type;
    if (query.priceType) where.priceType = query.priceType;

    const projects = await prisma.project.findMany({
      where,
      include: {
        floors: {
          orderBy: { floorNumber: 'asc' },
          include: {
            units: {
              orderBy: { unitNumber: 'asc' }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    return projects.map(formatProject);
  });

  // Get project by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await prisma.project.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        floors: {
          orderBy: { floorNumber: 'asc' },
          include: {
            units: {
              orderBy: { unitNumber: 'asc' }
            }
          }
        }
      }
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return formatProject(project);
  });

  // Create new project (Admin)
  fastify.post('/', { onRequest: [(fastify as any).authenticate] }, async (request, reply) => {
    const body = request.body as any;

    const created = await prisma.project.create({
      data: {
        type: body.type,
        typeAr: body.typeAr,
        typeEn: body.typeEn,
        title: body.title,
        titleEn: body.titleEn,
        price: body.price,
        priceLabel: body.priceLabel,
        priceType: body.priceType,
        priceTypeEn: body.priceTypeEn,
        status: body.status,
        statusEn: body.statusEn,
        area: body.area,
        rooms: body.rooms,
        bathrooms: body.bathrooms,
        unitsCount: body.unitsCount || body.units,
        unitsCountEn: body.unitsCountEn || body.unitsEn,
        city: body.city,
        cityEn: body.cityEn,
        image: body.image,
        gallery: JSON.stringify(body.gallery || []),
        description: body.description,
        descriptionEn: body.descriptionEn,
        badge: body.badge,
        badgeEn: body.badgeEn,
        features: JSON.stringify(body.features || []),
        featuresEn: JSON.stringify(body.featuresEn || []),
        videoUrl: body.videoUrl,
        virtualTour3dAvailable: !!body.virtualTour3dAvailable,
        locationHighlightsAr: JSON.stringify(body.locationHighlightsAr || []),
        locationHighlightsEn: JSON.stringify(body.locationHighlightsEn || []),
        lat: body.lat,
        lng: body.lng
      }
    });

    return reply.status(201).send(formatProject(created));
  });

  // Update project
  fastify.put('/:id', { onRequest: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const updated = await prisma.project.update({
      where: { id: parseInt(id, 10) },
      data: {
        title: body.title,
        titleEn: body.titleEn,
        type: body.type,
        typeAr: body.typeAr,
        typeEn: body.typeEn,
        priceType: body.priceType,
        priceLabel: body.priceLabel,
        area: body.area,
        city: body.city,
        cityEn: body.cityEn,
        image: body.image,
        gallery: body.gallery ? JSON.stringify(body.gallery) : undefined,
        description: body.description,
        descriptionEn: body.descriptionEn,
        badge: body.badge,
        videoUrl: body.videoUrl,
        lat: body.lat,
        lng: body.lng
      }
    });

    return formatProject(updated);
  });

  // Delete project
  fastify.delete('/:id', { onRequest: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.project.delete({
      where: { id: parseInt(id, 10) }
    });
    return { success: true };
  });
};
