import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  permissionKeySchema,
  parseRolePermissions,
  rolePermissionsToUserPermissions,
  type PermissionKey,
} from '../config/permissions.js';

const ROLE_KEY_REGEX = /^[a-z][a-z0-9_]{2,40}$/;

const createRoleSchema = z.object({
  key: z.string().regex(ROLE_KEY_REGEX, {
    message: 'Key must start with a lowercase letter and consist of 3 to 41 lowercase letters, numbers, or underscores',
  }),
  nameAr: z.string().trim().min(1, 'Arabic name is required'),
  nameEn: z.string().trim().min(1, 'English name is required'),
  description: z.string().nullish(),
  permissions: z.array(permissionKeySchema).default([]),
  sortOrder: z.number().int().optional().default(0),
});

const updateRoleSchema = z
  .object({
    nameAr: z.string().trim().min(1).optional(),
    nameEn: z.string().trim().min(1).optional(),
    description: z.string().nullish(),
    permissions: z.array(permissionKeySchema).optional(),
    sortOrder: z.number().int().optional(),
    applyToUsers: z.boolean().optional().default(true),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const roleIdParamsSchema = z.object({ id: z.string().min(1) });

function serializeRole(role: {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number };
  userCount?: number;
}) {
  return {
    id: role.id,
    key: role.key,
    nameAr: role.nameAr,
    nameEn: role.nameEn,
    description: role.description,
    permissions: parseRolePermissions(role.permissions),
    isSystem: role.isSystem,
    sortOrder: role.sortOrder,
    userCount: role.userCount ?? role._count?.users ?? 0,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export const roleRoutes: FastifyPluginAsync = async (fastify) => {
  // List roles with user count
  fastify.get('/', { onRequest: [authenticate, requirePermission('manageUsers')] }, async () => {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return roles.map(serializeRole);
  });

  // Create role
  fastify.post(
    '/',
    {
      onRequest: [authenticate, requirePermission('manageUsers')],
      preValidation: [validateBody(createRoleSchema)],
    },
    async (request, reply) => {
      const body = createRoleSchema.parse(request.body ?? {});
      const dedupedPermissions: PermissionKey[] = [...new Set(body.permissions)];

      // Only super_admin can create roles with manageUsers
      if (dedupedPermissions.includes('manageUsers') && request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can create a role with manageUsers permission' });
      }

      const existing = await prisma.role.findUnique({ where: { key: body.key } });
      if (existing) {
        return reply.status(409).send({ error: 'A role with this key already exists' });
      }

      const created = await prisma.role.create({
        data: {
          key: body.key,
          nameAr: body.nameAr,
          nameEn: body.nameEn,
          description: body.description ?? null,
          permissions: JSON.stringify(dedupedPermissions),
          isSystem: false,
          sortOrder: body.sortOrder,
        },
      });

      return reply.status(201).send(serializeRole({ ...created, userCount: 0 }));
    }
  );

  // Update role
  fastify.put(
    '/:id',
    {
      onRequest: [authenticate, requirePermission('manageUsers')],
      preValidation: [validateBody(updateRoleSchema)],
    },
    async (request, reply) => {
      const { id } = roleIdParamsSchema.parse(request.params);
      const body = updateRoleSchema.parse(request.body ?? {});

      const role = await prisma.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } },
      });
      if (!role) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      const currentPerms = parseRolePermissions(role.permissions);
      const targetPerms: PermissionKey[] =
        body.permissions !== undefined ? [...new Set(body.permissions)] : currentPerms;

      // Only super_admin may edit roles that have or will have manageUsers
      const involvesManageUsers = currentPerms.includes('manageUsers') || targetPerms.includes('manageUsers');
      if (involvesManageUsers && request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can modify a role with manageUsers permission' });
      }

      // Key is immutable. For isSystem roles only nameAr/nameEn/description may change.
      let finalPermissions = role.permissions;
      if (!role.isSystem && body.permissions !== undefined) {
        finalPermissions = JSON.stringify(targetPerms);
      }

      const finalNameAr = body.nameAr ?? role.nameAr;
      const finalNameEn = body.nameEn ?? role.nameEn;
      const finalDescription = body.description !== undefined ? body.description : role.description;
      const finalSortOrder = body.sortOrder !== undefined ? body.sortOrder : role.sortOrder;
      const applyToUsers = body.applyToUsers !== false;

      const updatedRole = await prisma.$transaction(async (tx) => {
        const updated = await tx.role.update({
          where: { id },
          data: {
            nameAr: finalNameAr,
            nameEn: finalNameEn,
            description: finalDescription,
            permissions: finalPermissions,
            sortOrder: finalSortOrder,
          },
        });

        if (applyToUsers) {
          const permsArray = parseRolePermissions(finalPermissions);
          const userPerms = rolePermissionsToUserPermissions(permsArray);

          await tx.adminUser.updateMany({
            where: { roleId: id },
            data: {
              roleAr: finalNameAr,
              permissions: JSON.stringify(userPerms),
            },
          });
        }

        return updated;
      });

      const userCount = await prisma.adminUser.count({ where: { roleId: id } });
      return reply.send(serializeRole({ ...updatedRole, userCount }));
    }
  );

  // Delete role
  fastify.delete(
    '/:id',
    { onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const { id } = roleIdParamsSchema.parse(request.params);

      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      if (role.isSystem) {
        return reply.status(400).send({ error: 'Cannot delete a system role' });
      }

      const rolePerms = parseRolePermissions(role.permissions);
      if (rolePerms.includes('manageUsers') && request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can delete a role with manageUsers permission' });
      }

      const userCount = await prisma.adminUser.count({ where: { roleId: id } });
      if (userCount > 0) {
        return reply.status(409).send({ error: 'Role is currently assigned to users', userCount });
      }

      await prisma.role.delete({ where: { id } });
      return { success: true };
    }
  );
};
