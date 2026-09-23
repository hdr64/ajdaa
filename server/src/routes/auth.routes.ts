import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate } from '../middleware/auth.js';
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
  fastify.get('/users', { onRequest: [authenticate] }, async () => {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(serializeUser);
  });

  // Create admin user
  fastify.post(
    '/users',
    { preValidation: [validateBody(createUserSchema)], onRequest: [authenticate] },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body ?? {});

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
};