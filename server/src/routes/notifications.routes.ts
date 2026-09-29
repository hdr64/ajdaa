import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createListener,
  deleteListener,
  listenersConfigured,
  listListeners,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  updateListener,
} from '../services/notificationListeners.js';

/** Upper bound so one listener cannot be turned into a bulk mailer. */
const MAX_EMAILS = 20;

const listenerSchema = z
  .object({
    event: z.enum(NOTIFICATION_EVENTS),
    channel: z.enum(NOTIFICATION_CHANNELS),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean(),
    config: z.object({
      toInquiryViewers: z.boolean(),
      emails: z.array(z.string().trim().toLowerCase().email().max(255)).max(MAX_EMAILS),
    }),
  })
  .refine((listener) => listener.config.toInquiryViewers || listener.config.emails.length > 0, {
    message: 'Choose at least one recipient',
    path: ['config', 'emails'],
  });

const idParamsSchema = z.object({ id: z.string().min(1) });

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // A fresh array per route (see settings.routes.ts for why).
  const guards = () => ({ onRequest: [authenticate, requirePermission('manageNotifications')] });

  fastify.get('/listeners', guards(), async () => ({
    configured: await listenersConfigured(),
    events: NOTIFICATION_EVENTS,
    channels: NOTIFICATION_CHANNELS,
    listeners: await listListeners(),
  }));

  fastify.post(
    '/listeners',
    { ...guards(), preValidation: [validateBody(listenerSchema)] },
    async (request, reply) => {
      const created = await createListener(listenerSchema.parse(request.body), request.admin!.id);
      return reply.status(201).send(created);
    }
  );

  fastify.put(
    '/listeners/:id',
    { ...guards(), preValidation: [validateBody(listenerSchema)] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const updated = await updateListener(id, listenerSchema.parse(request.body));
      if (!updated) return reply.status(404).send({ error: 'Listener not found' });
      return updated;
    }
  );

  fastify.delete('/listeners/:id', guards(), async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    if (!(await deleteListener(id))) return reply.status(404).send({ error: 'Listener not found' });
    return { deleted: true };
  });
};
