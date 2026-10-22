import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { serializePastProject } from '../services/serializers.js';

const urlRegex = /^(https:\/\/|\/uploads\/)[^\s"'<>\\]+$/;

const urlSchema = z.string().max(500).regex(urlRegex, { message: 'Invalid URL' });

const pastProjectBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  categoryEn: z.string().trim().max(100).optional().nullable(),
  image: urlSchema,
  gallery: z.array(urlSchema).max(30).optional(),
  pdfUrl: urlSchema.optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  descriptionEn: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().min(-100000).max(100000).optional(),
  published: z.boolean().optional(),
});

const updatePastProjectBodySchema = pastProjectBodySchema.partial();

const publishedBodySchema = z.object({ published: z.boolean() });

const idParamsSchema = z.object({ id: z.coerce.number().int() });

export const pastProjectRoutes: FastifyPluginAsync = async (fastify) => {
  // Public list: published only
  fastify.get('/', async () => {
    const rows = await prisma.pastProject.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      take: 200,
    });
    return rows.map(serializePastProject);
  });

  // Admin list: all rows
  fastify.get(
    '/admin',
    { onRequest: [authenticate, requirePermission('managePastProjects')] },
    async () => {
      const rows = await prisma.pastProject.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
        take: 200,
      });
      return rows.map(serializePastProject);
    }
  );

  // Create
  fastify.post(
    '/',
    { preValidation: [validateBody(pastProjectBodySchema)], onRequest: [authenticate, requirePermission('managePastProjects')] },
    async (request, reply) => {
      const body = pastProjectBodySchema.parse(request.body ?? {});
      const created = await prisma.pastProject.create({
        data: {
          title: body.title,
          titleEn: body.titleEn ?? null,
          category: body.category ?? null,
          categoryEn: body.categoryEn ?? null,
          image: body.image,
          gallery: body.gallery ? JSON.stringify(body.gallery) : null,
          pdfUrl: body.pdfUrl ?? null,
          description: body.description ?? null,
          descriptionEn: body.descriptionEn ?? null,
          sortOrder: body.sortOrder ?? 0,
          published: body.published ?? true,
        },
      });
      return reply.status(201).send(serializePastProject(created));
    }
  );

  // Update
  fastify.put(
    '/:id',
    { preValidation: [validateBody(updatePastProjectBodySchema)], onRequest: [authenticate, requirePermission('managePastProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = updatePastProjectBodySchema.parse(request.body ?? {});

      const existing = await prisma.pastProject.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Past project not found' });
      }

      const data: Record<string, unknown> = {};
      if (body.title !== undefined) data.title = body.title;
      if (body.titleEn !== undefined) data.titleEn = body.titleEn ?? null;
      if (body.category !== undefined) data.category = body.category ?? null;
      if (body.categoryEn !== undefined) data.categoryEn = body.categoryEn ?? null;
      if (body.image !== undefined) data.image = body.image;
      if (body.gallery !== undefined) data.gallery = body.gallery ? JSON.stringify(body.gallery) : null;
      if (body.pdfUrl !== undefined) data.pdfUrl = body.pdfUrl ?? null;
      if (body.description !== undefined) data.description = body.description ?? null;
      if (body.descriptionEn !== undefined) data.descriptionEn = body.descriptionEn ?? null;
      if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
      if (body.published !== undefined) data.published = body.published;

      const updated = await prisma.pastProject.update({ where: { id }, data });
      return serializePastProject(updated);
    }
  );

  // Publish toggle
  fastify.patch(
    '/:id/published',
    { preValidation: [validateBody(publishedBodySchema)], onRequest: [authenticate, requirePermission('managePastProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = publishedBodySchema.parse(request.body ?? {});

      const existing = await prisma.pastProject.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Past project not found' });
      }

      const updated = await prisma.pastProject.update({
        where: { id },
        data: { published: body.published },
      });
      return serializePastProject(updated);
    }
  );

  // Delete (hard delete row only)
  fastify.delete(
    '/:id',
    { onRequest: [authenticate, requirePermission('managePastProjects')] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const existing = await prisma.pastProject.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Past project not found' });
      }
      await prisma.pastProject.delete({ where: { id } });
      return reply.status(200).send({ success: true });
    }
  );
};