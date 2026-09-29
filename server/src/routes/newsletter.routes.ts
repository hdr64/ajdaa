import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { escapeCsvCell } from '../services/csv.js';

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  locale: z.enum(['ar', 'en']).nullish(),
  source: z.string().trim().max(40).nullish(),
});

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
});

const subscriberParamsSchema = z.object({
  id: z.string().min(1),
});

export const newsletterRoutes: FastifyPluginAsync = async (fastify) => {
  // Subscribe to newsletter (Public, idempotent)
  fastify.post(
    '/',
    { preValidation: [validateBody(subscribeSchema)] },
    async (request, reply) => {
      const { email, locale, source } = subscribeSchema.parse(request.body);

      try {
        await prisma.newsletterSubscriber.create({
          data: {
            email,
            locale: locale || null,
            source: source || null,
          },
        });
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (code !== 'P2002') {
          throw error;
        }
      }

      return reply.status(200).send({ subscribed: true });
    }
  );

  // Export newsletter subscribers to CSV (Admin: exportData)
  // Registered before :id routes to prevent shadowing
  fastify.get(
    '/export',
    { onRequest: [authenticate, requirePermission('exportData')] },
    async (_request, reply) => {
      const subscribers = await prisma.newsletterSubscriber.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const headers = ['email', 'locale', 'source', 'createdAt'];
      const rows = subscribers.map((sub) => [
        escapeCsvCell(sub.email),
        escapeCsvCell(sub.locale),
        escapeCsvCell(sub.source),
        escapeCsvCell(sub.createdAt.toISOString()),
      ]);

      const headerLine = headers.join(',');
      const dataLines = rows.map((r) => r.join(','));
      const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n') + '\r\n';

      const dateStr = new Date().toISOString().slice(0, 10);
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="newsletter-${dateStr}.csv"`);

      return reply.send(csv);
    }
  );

  // List newsletter subscribers (Admin: exportData)
  fastify.get(
    '/',
    { onRequest: [authenticate, requirePermission('exportData')] },
    async (request) => {
      const query = listQuerySchema.parse(request.query ?? {});

      const where: Record<string, unknown> = {};
      if (query.q) {
        where.email = { contains: query.q.toLowerCase() };
      }

      const subscribers = await prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return subscribers;
    }
  );

  // Delete / unsubscribe subscriber (Admin: exportData)
  fastify.delete(
    '/:id',
    { onRequest: [authenticate, requirePermission('exportData')] },
    async (request, reply) => {
      const { id } = subscriberParamsSchema.parse(request.params);
      await prisma.newsletterSubscriber.delete({ where: { id } });

      return reply.status(200).send({ success: true });
    }
  );
};
