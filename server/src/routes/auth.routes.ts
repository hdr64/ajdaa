import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() }
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

    // Update last login
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date().toISOString() }
    });

    let permissions = {};
    try {
      permissions = JSON.parse(user.permissions);
    } catch {
      permissions = {};
    }

    // Generate JWT token
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleAr: user.roleAr,
        department: user.department,
        permissions,
        status: user.status
      }
    };
  });

  // Get current user profile
  fastify.get('/me', { onRequest: [(fastify as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { id: string };
    const user = await prisma.adminUser.findUnique({ where: { id: payload.id } });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    let permissions = {};
    try {
      permissions = JSON.parse(user.permissions);
    } catch {
      permissions = {};
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleAr: user.roleAr,
        department: user.department,
        permissions,
        status: user.status
      }
    };
  });

  // List admin users
  fastify.get('/users', { onRequest: [(fastify as any).authenticate] }, async () => {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return users.map((u) => {
      let permissions = {};
      try {
        permissions = JSON.parse(u.permissions);
      } catch {
        permissions = {};
      }
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        roleAr: u.roleAr,
        department: u.department,
        permissions,
        status: u.status,
        lastLogin: u.lastLogin
      };
    });
  });

  // Create admin user
  fastify.post('/users', { onRequest: [(fastify as any).authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const existing = await prisma.adminUser.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(400).send({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(body.password || 'password123', 10);
    const created = await prisma.adminUser.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
        role: body.role || 'sales_agent',
        roleAr: body.roleAr || 'مسؤول مبيعات',
        department: body.department,
        permissions: JSON.stringify(body.permissions || {}),
        status: 'active'
      }
    });

    return reply.status(201).send(created);
  });
};
