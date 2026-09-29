import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { sendTestMail } from '../services/mailService.js';
import { config } from '../config/env.js';
import {
  getEffectiveMailSettings,
  resetMailSettings,
  resolveInput,
  saveMailSettings,
  toPublicView,
} from '../services/mailSettings.js';

/**
 * Admin-editable settings. Super admin only: whoever controls the SMTP account
 * controls where login and reset codes are sent from, so no permission flag
 * unlocks it.
 */

const mailSettingsSchema = z.object({
  host: z.string().trim().max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().max(255),
  password: z.string().max(512).optional(),
  encryption: z.enum(['tls', 'ssl', 'none']),
  fromAddress: z.union([z.literal(''), z.string().trim().email().max(255)]),
  fromName: z.string().trim().max(100),
});

const testMailSchema = z.object({
  to: z.string().trim().email(),
  settings: mailSettingsSchema.optional(),
});

/** Long enough for a useful SMTP error, short enough not to echo a server banner dump. */
const MAX_ERROR_LENGTH = 300;

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // A fresh array per route: @fastify/rate-limit appends its hook to the route's
  // onRequest array, so a shared one would apply the test-mail limit everywhere.
  const guards = () => ({ onRequest: [authenticate, requireSuperAdmin] });

  fastify.get('/mail', guards(), async () => toPublicView(await getEffectiveMailSettings()));

  fastify.put(
    '/mail',
    { ...guards(), preValidation: [validateBody(mailSettingsSchema)] },
    async (request) => {
      const input = mailSettingsSchema.parse(request.body);
      return toPublicView(await saveMailSettings(input, request.admin!.id));
    }
  );

  fastify.delete('/mail', guards(), async () => toPublicView(await resetMailSettings()));

  fastify.post(
    '/mail/test',
    {
      ...guards(),
      // Each call opens an SMTP connection to an admin-chosen host.
      config: { rateLimit: { max: 5, timeWindow: 60_000 } },
      preValidation: [validateBody(testMailSchema)],
    },
    async (request, reply) => {
      const { to, settings } = testMailSchema.parse(request.body);
      const target = settings ? await resolveInput(settings) : await getEffectiveMailSettings();

      // In the test suite the memory transport stands in, so an empty host is fine there.
      if (!target.host && config.env !== 'test') {
        return reply.status(400).send({ error: 'SMTP host is not configured' });
      }

      try {
        const { messageId } = await sendTestMail(target, to);
        return { sent: true, messageId };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return reply.status(502).send({ error: reason.slice(0, MAX_ERROR_LENGTH) });
      }
    }
  );
};
