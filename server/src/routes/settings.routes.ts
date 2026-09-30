import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { sendTestMail } from '../services/mailService.js';
import { config } from '../config/env.js';
import { getSecuritySettings, saveSecuritySettings, toSecurityView } from '../services/securitySettings.js';
import { getSiteSettings, saveSiteSettings, type SiteSettings } from '../services/siteSettings.js';
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

/** Rendered as links on public pages, so only https URLs (or empty, to hide one). */
const publicUrl = z.union([z.literal(''), z.string().trim().max(300).url().startsWith('https://')]);

const siteSettingsSchema = z.object({
  phone: z.string().trim().max(40),
  whatsapp: z.union([z.literal(''), z.string().trim().regex(/^\d{8,15}$/, 'International digits only, e.g. 966580484528')]),
  email: z.union([z.literal(''), z.string().trim().email().max(255)]),
  addressAr: z.string().trim().max(200),
  addressEn: z.string().trim().max(200),
  hoursAr: z.string().trim().max(120),
  hoursEn: z.string().trim().max(120),
  socials: z.object({
    x: publicUrl,
    instagram: publicUrl,
    tiktok: publicUrl,
    snapchat: publicUrl,
    linkedin: publicUrl,
    youtube: publicUrl,
  }) satisfies z.ZodType<SiteSettings['socials']>,
  announcement: z
    .object({
      enabled: z.boolean(),
      textAr: z.string().trim().max(200),
      textEn: z.string().trim().max(200),
      tone: z.enum(['info', 'warning']),
      link: publicUrl,
    })
    .refine((a) => !a.enabled || a.textAr.length > 0 || a.textEn.length > 0, {
      message: 'An enabled announcement needs text',
      path: ['textAr'],
    }),
  maintenance: z.object({
    enabled: z.boolean(),
    messageAr: z.string().trim().min(1).max(500),
    messageEn: z.string().trim().min(1).max(500),
  }),
});

const securitySettingsSchema = z.object({ loginOtpRequired: z.boolean() });

/** Long enough for a useful SMTP error, short enough not to echo a server banner dump. */
const MAX_ERROR_LENGTH = 300;

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // A fresh array per route: @fastify/rate-limit appends its hook to the route's
  // onRequest array, so a shared one would apply the test-mail limit everywhere.
  const guards = () => ({ onRequest: [authenticate, requireSuperAdmin] });

  // Public: the website reads its contact details and social links from here.
  fastify.get('/site', async () => getSiteSettings());

  fastify.put(
    '/site',
    { ...guards(), preValidation: [validateBody(siteSettingsSchema)] },
    async (request) => saveSiteSettings(siteSettingsSchema.parse(request.body), request.admin!.id)
  );

  fastify.get('/security', guards(), async () => toSecurityView(await getSecuritySettings()));

  fastify.put(
    '/security',
    { ...guards(), preValidation: [validateBody(securitySettingsSchema)] },
    async (request) =>
      toSecurityView(await saveSecuritySettings(securitySettingsSchema.parse(request.body), request.admin!.id))
  );

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
