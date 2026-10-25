import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const createDepartmentSchema = z.object({
  nameAr: z.string().trim().min(1, 'Arabic name is required'),
  nameEn: z.string().trim().nullish(),
});

const updateDepartmentSchema = z
  .object({
    nameAr: z.string().trim().min(1).optional(),
    nameEn: z.string().trim().nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const departmentIdParamsSchema = z.object({ id: z.string().min(1) });

export const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  // List departments with userCount
  fastify.get('/', { onRequest: [authenticate, requirePermission('manageUsers')] }, async () => {
    const departments = await prisma.department.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { nameAr: 'asc' },
    });

    return departments.map((d) => ({
      id: d.id,
      nameAr: d.nameAr,
      nameEn: d.nameEn,
      userCount: d._count.users,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  });

  // Create department
  fastify.post(
    '/',
    {
      onRequest: [authenticate, requirePermission('manageUsers')],
      preValidation: [validateBody(createDepartmentSchema)],
    },
    async (request, reply) => {
      const body = createDepartmentSchema.parse(request.body ?? {});

      const existing = await prisma.department.findUnique({ where: { nameAr: body.nameAr } });
      if (existing) {
        return reply.status(409).send({ error: 'A department with this name already exists' });
      }

      const created = await prisma.department.create({
        data: {
          nameAr: body.nameAr,
          nameEn: body.nameEn?.trim() || null,
        },
      });

      return reply.status(201).send({
        id: created.id,
        nameAr: created.nameAr,
        nameEn: created.nameEn,
        userCount: 0,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    }
  );

  // Update department
  fastify.put(
    '/:id',
    {
      onRequest: [authenticate, requirePermission('manageUsers')],
      preValidation: [validateBody(updateDepartmentSchema)],
    },
    async (request, reply) => {
      const { id } = departmentIdParamsSchema.parse(request.params);
      const body = updateDepartmentSchema.parse(request.body ?? {});

      const department = await prisma.department.findUnique({ where: { id } });
      if (!department) {
        return reply.status(404).send({ error: 'Department not found' });
      }

      if (body.nameAr && body.nameAr !== department.nameAr) {
        const existing = await prisma.department.findUnique({ where: { nameAr: body.nameAr } });
        if (existing) {
          return reply.status(409).send({ error: 'A department with this name already exists' });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const dept = await tx.department.update({
          where: { id },
          data: {
            nameAr: body.nameAr,
            nameEn: body.nameEn !== undefined ? (body.nameEn?.trim() || null) : undefined,
          },
        });

        if (body.nameAr && body.nameAr !== department.nameAr) {
          await tx.adminUser.updateMany({
            where: { departmentId: id },
            data: { department: body.nameAr },
          });
        }

        return dept;
      });

      const userCount = await prisma.adminUser.count({ where: { departmentId: id } });
      return reply.send({
        id: updated.id,
        nameAr: updated.nameAr,
        nameEn: updated.nameEn,
        userCount,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }
  );

  // Delete department
  fastify.delete(
    '/:id',
    { onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const { id } = departmentIdParamsSchema.parse(request.params);

      const department = await prisma.department.findUnique({ where: { id } });
      if (!department) {
        return reply.status(404).send({ error: 'Department not found' });
      }

      const userCount = await prisma.adminUser.count({ where: { departmentId: id } });
      if (userCount > 0) {
        return reply.status(409).send({ error: 'Department is currently assigned to users', userCount });
      }

      await prisma.department.delete({ where: { id } });
      return { success: true };
    }
  );
};
