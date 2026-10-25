import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loggerService } from '../services/loggerService.js';
import {
  configuredEvents,
  createListener,
  deleteListener,
  getListener,
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
      toInquiryViewers: z.boolean().default(false),
      toApplicationViewers: z.boolean().default(false),
      emails: z.array(z.string().trim().toLowerCase().email().max(255)).max(MAX_EMAILS),
    }),
  })
  .refine(
    (listener) =>
      listener.config.toInquiryViewers ||
      listener.config.toApplicationViewers ||
      listener.config.emails.length > 0,
    {
      message: 'Choose at least one recipient',
      path: ['config', 'emails'],
    }
  );

const idParamsSchema = z.object({ id: z.string().min(1) });

function emailsEqual(a: string[], b: string[]): boolean {
  const setA = new Set(a.map((e) => e.trim().toLowerCase()));
  const setB = new Set(b.map((e) => e.trim().toLowerCase()));
  if (setA.size !== setB.size) return false;
  for (const email of setA) {
    if (!setB.has(email)) return false;
  }
  return true;
}

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // A fresh array per route (see settings.routes.ts for why).
  const guards = () => ({ onRequest: [authenticate, requirePermission('manageNotifications')] });

  fastify.get('/listeners', guards(), async () => {
    // The configured state is per event: `configured` keeps its old meaning
    // ("a listener was ever created"), `configuredByEvent` says for which.
    const configuredByEvent = await configuredEvents();
    return {
      configured: Object.values(configuredByEvent).some(Boolean),
      configuredByEvent,
      events: NOTIFICATION_EVENTS,
      channels: NOTIFICATION_CHANNELS,
      listeners: await listListeners(),
    };
  });

  fastify.post(
    '/listeners',
    { ...guards(), preValidation: [validateBody(listenerSchema)] },
    async (request, reply) => {
      const body = listenerSchema.parse(request.body);
      if (request.admin?.role !== 'super_admin' && body.config.emails.length > 0) {
        return reply.status(403).send({ error: 'Only a super admin can send notifications to explicit email addresses' });
      }
      const created = await createListener(body, request.admin!.id);
      loggerService.info(
        'Notification listener created',
        { actorId: request.admin!.id, listenerId: created.id, emails: created.config.emails },
        'notifications'
      );
      return reply.status(201).send(created);
    }
  );

  fastify.put(
    '/listeners/:id',
    { ...guards(), preValidation: [validateBody(listenerSchema)] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const existing = await getListener(id);
      if (!existing) return reply.status(404).send({ error: 'Listener not found' });

      const body = listenerSchema.parse(request.body);
      if (request.admin?.role !== 'super_admin' && !emailsEqual(existing.config.emails, body.config.emails)) {
        return reply.status(403).send({ error: 'Only a super admin can send notifications to explicit email addresses' });
      }

      const updated = await updateListener(id, body);
      if (!updated) return reply.status(404).send({ error: 'Listener not found' });
      loggerService.info(
        'Notification listener updated',
        { actorId: request.admin!.id, listenerId: updated.id, emails: updated.config.emails },
        'notifications'
      );
      return updated;
    }
  );

  fastify.delete('/listeners/:id', guards(), async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const existing = await getListener(id);
    if (!existing) return reply.status(404).send({ error: 'Listener not found' });
    await deleteListener(id);
    loggerService.info(
      'Notification listener deleted',
      { actorId: request.admin!.id, listenerId: id, emails: [] },
      'notifications'
    );
    return { deleted: true };
  });
};
