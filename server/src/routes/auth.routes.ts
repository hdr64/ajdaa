import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ADMIN_ROLES } from '../config/constants.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).default('password123'),
  role: z.enum(ADMIN_ROLES).default('sales_agent'),
  roleAr: z.string().default('مسؤول مبيعات'),
  department: z.string().nullish(),
  permissions: z.record(z.boolean()).default({}),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(ADMIN_ROLES).optional(),
    roleAr: z.string().optional(),
    department: z.string().nullish(),
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
  role: string;
  roleAr: string;
  department: string | null;
  permissions: string;
  status: string;
  lastLogin: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleAr: user.roleAr,
    department: user.department,
    permissions: parsePermissions(user.permissions),
    status: user.status,
    lastLogin: user.lastLogin,
  };
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Login
  fastify.post('/login', { preValidation: [validateBody(loginSchema)] }, async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body ?? {});

    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return reply.status(403).send({ error: 'Account is suspended' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

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
  });

  // Get current user profile
  fastify.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    const user = await prisma.adminUser.findUnique({ where: { id: request.user.id } });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user: serializeUser(user) };
  });

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

      if (body.role === 'super_admin' && request.admin?.role !== 'super_admin') {
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
          role: body.role,
          roleAr: body.roleAr,
          department: body.department,
          permissions: JSON.stringify(body.permissions),
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

      // Holding manageUsers must not be a path to super admin: only a super
      // admin may touch a super admin account or hand out that role.
      const requesterIsSuperAdmin = request.admin?.role === 'super_admin';
      if (!requesterIsSuperAdmin && (target.role === 'super_admin' || body.role === 'super_admin')) {
        return reply.status(403).send({ error: 'Only a super admin can modify super admin accounts' });
      }

      // Nobody grants themselves access or lifts their own suspension.
      // The admin form always resends these fields, so only real changes count.
      const currentPermissions = parsePermissions(target.permissions);
      const permissionsChanged =
        body.permissions !== undefined &&
        [...new Set([...Object.keys(body.permissions), ...Object.keys(currentPermissions)])].some(
          (key) => Boolean(body.permissions?.[key]) !== Boolean(currentPermissions[key])
        );
      const changesOwnAccess =
        (body.role !== undefined && body.role !== target.role) ||
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
        ((body.role !== undefined && body.role !== 'super_admin') || body.status === 'suspended');

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
          role: body.role,
          roleAr: body.roleAr,
          department: body.department,
          permissions: body.permissions ? JSON.stringify(body.permissions) : undefined,
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