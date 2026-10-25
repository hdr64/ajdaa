import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { CategoryItem } from '@prisma/client';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parseJsonArray } from '../services/serializers.js';
import { CATEGORY_TYPES } from '../config/constants.js';

const categoryIdRegex = /^[a-z0-9-]{2,40}$/;

const categoryParamsSchema = z.object({
  id: z.string().min(1),
});

const tagsSchema = z
  .array(z.string().trim().min(1))
  .max(30)
  .transform((tags) => [...new Set(tags)]);

const createCategorySchema = z.object({
  id: z
    .string()
    .trim()
    .regex(categoryIdRegex, { message: 'Invalid category ID format' })
    .optional(),
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  type: z.enum(CATEGORY_TYPES),
  tags: tagsSchema,
});

const updateCategorySchema = z.object({
  id: z.string().optional(),
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  type: z.enum(CATEGORY_TYPES),
  tags: tagsSchema,
});

export interface SerializedCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  type: string;
  tags: string[];
}

export function serializeCategory(item: CategoryItem): SerializedCategory {
  return {
    id: item.id,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    type: item.type,
    tags: parseJsonArray(item.tags) ?? [],
  };
}

export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all categories (Public)
  fastify.get('/', async () => {
    const categories = await prisma.categoryItem.findMany({
      orderBy: { id: 'asc' },
    });

    return categories.map(serializeCategory);
  });

  // Create new category (Admin: manageProjects)
  fastify.post(
    '/',
    { preValidation: [validateBody(createCategorySchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const body = createCategorySchema.parse(request.body ?? {});
      const id = body.id || `cat-${crypto.randomBytes(4).toString('hex')}`;

      const existing = await prisma.categoryItem.findUnique({ where: { id } });
      if (existing) {
        return reply.status(409).send({ error: 'Category ID already exists' });
      }

      const created = await prisma.categoryItem.create({
        data: {
          id,
          nameAr: body.nameAr,
          nameEn: body.nameEn,
          type: body.type,
          tags: JSON.stringify(body.tags),
        },
      });

      return reply.status(201).send(serializeCategory(created));
    }
  );

  // Update category (Admin: manageProjects)
  fastify.put(
    '/:id',
    { preValidation: [validateBody(updateCategorySchema)], onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request) => {
      const { id } = categoryParamsSchema.parse(request.params);
      const body = updateCategorySchema.parse(request.body ?? {});

      const updated = await prisma.categoryItem.update({
        where: { id },
        data: {
          nameAr: body.nameAr,
          nameEn: body.nameEn,
          type: body.type,
          tags: JSON.stringify(body.tags),
        },
      });

      return serializeCategory(updated);
    }
  );

  // Delete category (Admin: manageProjects)
  fastify.delete(
    '/:id',
    { onRequest: [authenticate, requirePermission('manageProjects')] },
    async (request, reply) => {
      const { id } = categoryParamsSchema.parse(request.params);

      await prisma.categoryItem.delete({ where: { id } });

      return reply.status(200).send({ success: true });
    }
  );
};
