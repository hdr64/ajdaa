import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { config } from '../config/env.js';
import { loginFailureTracker } from '../services/loginFailureService.js';
import {
  parseRolePermissions,
  rolePermissionsToUserPermissions,
} from '../config/permissions.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).default('password123'),
  phone: z.string().trim().nullish(),
  role: z.string().optional(),
  roleId: z.string().optional(),
  roleAr: z.string().optional(),
  department: z.string().nullish(),
  departmentId: z.string().nullish(),
  permissions: z.record(z.boolean()).optional(),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
    phone: z.string().trim().nullish(),
    role: z.string().optional(),
    roleId: z.string().nullish(),
    roleAr: z.string().optional(),
    department: z.string().nullish(),
    departmentId: z.string().nullish(),
    permissions: z.record(z.boolean()).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const userIdParamsSchema = z.object({ id: z.string().min(1) });

type UpdateUserInput = z.infer<typeof updateUserSchema>;

function parsePermissions(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  roleAr: string;
  roleId?: string | null;
  department: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  permissions: string;
  status: string;
  lastLogin: string | null;
  departmentRef?: { nameAr: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    roleAr: user.roleAr,
    roleId: user.roleId ?? null,
    department: user.department,
    departmentId: user.departmentId ?? null,
    departmentName: user.departmentName ?? user.departmentRef?.nameAr ?? user.department ?? null,
    permissions: parsePermissions(user.permissions),
    status: user.status,
    lastLogin: user.lastLogin,
  };
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Login
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: config.rateLimitLoginMax,
          timeWindow: config.rateLimitLoginWindowMs,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقاً / Rate limit exceeded, please try again later',
          }),
        },
      },
      preValidation: [validateBody(loginSchema)],
    },
    async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body ?? {});
      const normalizedEmail = email.toLowerCase().trim();

      const lockout = loginFailureTracker.isLocked(normalizedEmail);
      if (lockout.locked) {
        reply.header('Retry-After', lockout.retryAfter.toString());
        return reply.status(429).send({
          error: 'تم تجاوز الحد الأقصى للمحاولات غير الصحيحة، يرجى المحاولة لاحقاً / Too many failed login attempts, please try again later',
        });
      }

      const user = await prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      if (user.status === 'suspended') {
        return reply.status(403).send({ error: 'Account is suspended' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(normalizedEmail);
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      loginFailureTracker.recordSuccess(normalizedEmail);

      await prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLogin: new Date().toISOString() },
      });

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: serializeUser(user),
      };
    }
  );

  // Get current user profile
  fastify.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user: serializeUser(user) };
  });

  // Update own profile
  fastify.patch(
    '/me',
    { onRequest: [authenticate], preValidation: [validateBody(updateProfileSchema)] },
    async (request, reply) => {
      const data = updateProfileSchema.parse(request.body ?? {});

      if (data.email) {
        const existing = await prisma.adminUser.findUnique({
          where: { email: data.email },
        });
        if (existing && existing.id !== request.user.id) {
          return reply.status(409).send({ error: 'Email already in use' });
        }
      }

      const updateData: { name?: string; email?: string; phone?: string | null } = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone || null;

      const updated = await prisma.adminUser.update({
        where: { id: request.user.id },
        data: updateData,
        include: { departmentRef: true, roleRef: true },
      });

      return reply.status(200).send({ user: serializeUser(updated) });
    }
  );

  // Change password
  fastify.post(
    '/me/password',
    { onRequest: [authenticate], preValidation: [validateBody(changePasswordSchema)] },
    async (request, reply) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(request.body ?? {});

      const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const lockout = loginFailureTracker.isLocked(user.email);
      if (lockout.locked) {
        reply.header('Retry-After', lockout.retryAfter.toString());
        return reply.status(429).send({
          error: 'تم تجاوز الحد الأقصى للمحاولات غير الصحيحة، يرجى المحاولة لاحقاً / Too many failed attempts, please try again later',
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        loginFailureTracker.recordFailure(user.email);
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Policy: ≥ 10 chars, at least one letter and one digit, not equal to current
      const hasMinLength = newPassword.length >= 10;
      const hasLetter = /[a-zA-Z\p{L}]/u.test(newPassword);
      const hasDigit = /\d/.test(newPassword);
      const isDifferent = newPassword !== currentPassword;

      if (!hasMinLength || !hasLetter || !hasDigit || !isDifferent) {
        return reply.status(400).send({
          error: 'Password does not meet requirements: must be at least 10 characters, include at least one letter and one digit, and be different from current password',
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const passwordChangedAt = new Date();

      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt,
        },
      });

      loginFailureTracker.recordSuccess(user.email);

      return reply.status(200).send({ message: 'Password updated successfully' });
    }
  );

  // List admin users
  fastify.get('/users', { onRequest: [authenticate, requirePermission('manageUsers')] }, async () => {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(serializeUser);
  });

  // Create admin user
  fastify.post(
    '/users',
    { preValidation: [validateBody(createUserSchema)], onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body ?? {});

      let resolvedRoleKey: string = body.role ?? 'sales_agent';
      let resolvedRoleAr: string = body.roleAr ?? 'مسؤول مبيعات';
      let resolvedRoleId: string | null = null;
      let resolvedPermissions: Record<string, boolean> = body.permissions ?? {};

      if (body.roleId) {
        const roleRecord = await prisma.role.findUnique({ where: { id: body.roleId } });
        if (!roleRecord) {
          return reply.status(400).send({ error: 'Role not found' });
        }
        resolvedRoleKey = roleRecord.key;
        resolvedRoleAr = roleRecord.nameAr;
        resolvedRoleId = roleRecord.id;
        if (body.permissions === undefined) {
          const rolePerms = parseRolePermissions(roleRecord.permissions);
          resolvedPermissions = rolePermissionsToUserPermissions(rolePerms);
        }
      } else if (body.role) {
        resolvedRoleKey = body.role;
        const roleRecord = await prisma.role.findUnique({ where: { key: body.role } });
        if (roleRecord) {
          resolvedRoleId = roleRecord.id;
          if (!body.roleAr) resolvedRoleAr = roleRecord.nameAr;
        }
      } else {
        const roleRecord = await prisma.role.findUnique({ where: { key: 'sales_agent' } });
        if (roleRecord) {
          resolvedRoleId = roleRecord.id;
          resolvedRoleAr = roleRecord.nameAr;
        }
      }

      let resolvedDepartmentText: string | null = body.department ?? null;
      let resolvedDepartmentId: string | null = body.departmentId ?? null;

      if (body.departmentId) {
        const deptRecord = await prisma.department.findUnique({ where: { id: body.departmentId } });
        if (!deptRecord) {
          return reply.status(400).send({ error: 'Department not found' });
        }
        resolvedDepartmentId = deptRecord.id;
        resolvedDepartmentText = deptRecord.nameAr;
      } else if (body.department) {
        const deptRecord = await prisma.department.findUnique({ where: { nameAr: body.department } });
        if (deptRecord) {
          resolvedDepartmentId = deptRecord.id;
        }
      }

      if (resolvedRoleKey === 'super_admin' && request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can create a super admin' });
      }

      const existing = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) {
        return reply.status(400).send({ error: 'Email already exists' });
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      const created = await prisma.adminUser.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash,
          role: resolvedRoleKey,
          roleAr: resolvedRoleAr,
          roleId: resolvedRoleId,
          department: resolvedDepartmentText,
          departmentId: resolvedDepartmentId,
          permissions: JSON.stringify(resolvedPermissions),
          status: 'active',
        },
      });

      return reply.status(201).send(serializeUser(created));
    }
  );

  // Update admin user (Admin)
  fastify.put(
    '/users/:id',
    { preValidation: [validateBody(updateUserSchema)], onRequest: [authenticate, requirePermission('manageUsers')] },
    async (request, reply) => {
      const { id } = userIdParamsSchema.parse(request.params);
      const body = updateUserSchema.parse(request.body ?? {}) as UpdateUserInput;

      const target = await prisma.adminUser.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: 'User not found' });
      }

      let resolvedRoleKey: string | undefined = body.role;
      let resolvedRoleAr: string | undefined = body.roleAr;
      let resolvedRoleId: string | null | undefined = body.roleId;
      let resolvedPermissions: Record<string, boolean> | undefined = body.permissions;

      if (body.roleId !== undefined) {
        if (body.roleId) {
          const roleRecord = await prisma.role.findUnique({ where: { id: body.roleId } });
          if (!roleRecord) {
            return reply.status(400).send({ error: 'Role not found' });
          }
          resolvedRoleKey = roleRecord.key;
          resolvedRoleAr = roleRecord.nameAr;
          resolvedRoleId = roleRecord.id;
          if (body.permissions === undefined) {
            const rolePerms = parseRolePermissions(roleRecord.permissions);
            resolvedPermissions = rolePermissionsToUserPermissions(rolePerms);
          }
        } else {
          resolvedRoleId = null;
        }
      } else if (body.role !== undefined) {
        const roleRecord = await prisma.role.findUnique({ where: { key: body.role } });
        if (roleRecord) {
          resolvedRoleId = roleRecord.id;
          if (resolvedRoleAr === undefined) resolvedRoleAr = roleRecord.nameAr;
        }
      }

      let resolvedDepartmentText: string | null | undefined = body.department;
      let resolvedDepartmentId: string | null | undefined = body.departmentId;

      if (body.departmentId !== undefined) {
        if (body.departmentId) {
          const deptRecord = await prisma.department.findUnique({ where: { id: body.departmentId } });
          if (!deptRecord) {
            return reply.status(400).send({ error: 'Department not found' });
          }
          resolvedDepartmentId = deptRecord.id;
          resolvedDepartmentText = deptRecord.nameAr;
        } else {
          resolvedDepartmentId = null;
          resolvedDepartmentText = null;
        }
      } else if (body.department !== undefined) {
        if (body.department) {
          const deptRecord = await prisma.department.findUnique({ where: { nameAr: body.department } });
          if (deptRecord) {
            resolvedDepartmentId = deptRecord.id;
          }
        } else {
          resolvedDepartmentId = null;
        }
      }

      // Holding manageUsers must not be a path to super admin: only a super
      // admin may touch a super admin account or hand out that role.
      const requesterIsSuperAdmin = request.admin?.role === 'super_admin';
      if (!requesterIsSuperAdmin && (target.role === 'super_admin' || resolvedRoleKey === 'super_admin')) {
        return reply.status(403).send({ error: 'Only a super admin can modify super admin accounts' });
      }

      // Nobody grants themselves access or lifts their own suspension.
      // The admin form always resends these fields, so only real changes count.
      const currentPermissions = parsePermissions(target.permissions);
      const permissionsChanged =
        resolvedPermissions !== undefined &&
        [...new Set([...Object.keys(resolvedPermissions), ...Object.keys(currentPermissions)])].some(
          (key) => Boolean(resolvedPermissions?.[key]) !== Boolean(currentPermissions[key])
        );
      const changesOwnAccess =
        (resolvedRoleKey !== undefined && resolvedRoleKey !== target.role) ||
        (resolvedRoleId !== undefined && resolvedRoleId !== target.roleId) ||
        (body.status !== undefined && body.status !== target.status) ||
        permissionsChanged;
      if (request.admin?.id === id && changesOwnAccess) {
        return reply.status(403).send({ error: 'You cannot change your own role, status or permissions' });
      }

      if (body.email && body.email.toLowerCase() !== target.email) {
        const existing = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
        if (existing) {
          return reply.status(400).send({ error: 'Email already exists' });
        }
      }

      // Guard the last usable super admin so the portal cannot be locked out.
      const losingSuperAdmin =
        target.role === 'super_admin' &&
        ((resolvedRoleKey !== undefined && resolvedRoleKey !== 'super_admin') || body.status === 'suspended');

      if (losingSuperAdmin) {
        const activeSuperAdmins = await prisma.adminUser.count({
          where: { role: 'super_admin', status: 'active' },
        });
        if (activeSuperAdmins <= 1) {
          return reply.status(400).send({ error: 'Cannot demote or suspend the last active super admin' });
        }
      }

      const updated = await prisma.adminUser.update({
        where: { id },
        data: {
          name: body.name,
          email: body.email ? body.email.toLowerCase() : undefined,
          passwordHash: body.password ? await bcrypt.hash(body.password, 10) : undefined,
          role: resolvedRoleKey,
          roleAr: resolvedRoleAr,
          roleId: resolvedRoleId !== undefined ? resolvedRoleId : undefined,
          department: resolvedDepartmentText !== undefined ? resolvedDepartmentText : undefined,
          departmentId: resolvedDepartmentId !== undefined ? resolvedDepartmentId : undefined,
          permissions: resolvedPermissions ? JSON.stringify(resolvedPermissions) : undefined,
          status: body.status,
        },
      });

      return serializeUser(updated);
    }
  );

  // Delete admin user (Admin)
  fastify.delete('/users/:id', { onRequest: [authenticate, requirePermission('manageUsers')] }, async (request, reply) => {
    const { id } = userIdParamsSchema.parse(request.params);

    if (request.user.id === id) {
      return reply.status(400).send({ error: 'You cannot delete your own account' });
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (target.role === 'super_admin') {
      if (request.admin?.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only a super admin can delete a super admin' });
      }
      const activeSuperAdmins = await prisma.adminUser.count({
        where: { role: 'super_admin', status: 'active' },
      });
      if (activeSuperAdmins <= 1) {
        return reply.status(400).send({ error: 'Cannot delete the last active super admin' });
      }
    }

    await prisma.adminUser.delete({ where: { id } });
    return { success: true };
  });
};