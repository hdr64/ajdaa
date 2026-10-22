import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { config } from '../config/env.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  getCareersFormConfig,
  setCareersFormConfig,
  getCareersNotificationEmails,
  setCareersNotificationEmails,
} from '../services/careersSettings.js';
import {
  JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_AR,
  type JobApplicationStatus,
} from '../config/constants.js';
import { dispatch } from '../services/queueService.js';
import { sendJobApplicationNotificationJob } from '../jobs/emailJobs.js';

const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_DIRNAME = 'cv';

function sanitiseOriginalName(name: string): string {
  return name
    .replace(/[\\/]/g, '')
    // eslint-disable-next-line no-control-regex -- strip control characters from the client filename
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 120);
}

function randomCvName(): string {
  return `${crypto.randomBytes(12).toString('hex')}.pdf`;
}

const applicationIdParamsSchema = z.object({ id: z.string().min(1) });

const patchApplicationBodySchema = z
  .object({
    status: z.enum(JOB_APPLICATION_STATUSES).optional(),
    adminNote: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.adminNote !== undefined, {
    message: 'At least one field must be provided',
  });

const settingsBodySchema = z.object({
  required: z
    .object({
      name: z.boolean().optional(),
      email: z.boolean().optional(),
      phone: z.boolean().optional(),
      jobTitle: z.boolean().optional(),
      message: z.boolean().optional(),
      cv: z.boolean().optional(),
    })
    .optional(),
  notificationEmails: z.array(z.string().trim().toLowerCase().email().max(255)).max(10).optional(),
});

function toListView(row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  cvPath: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    status: row.status,
    statusAr: JOB_APPLICATION_STATUS_AR[row.status as JobApplicationStatus] ?? row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasCv: Boolean(row.cvPath),
  };
}

function toDetailView(row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  message: string | null;
  cvPath: string | null;
  cvOriginalName: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    message: row.message,
    cvOriginalName: row.cvOriginalName,
    status: row.status,
    statusAr: JOB_APPLICATION_STATUS_AR[row.status as JobApplicationStatus] ?? row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasCv: Boolean(row.cvPath),
  };
}

export const careersRoutes: FastifyPluginAsync = async (fastify) => {
  // Public: form config
  fastify.get('/form', async () => {
    const cfg = await getCareersFormConfig();
    return { required: cfg.required };
  });

  // Public: submit application
  fastify.post(
    '/applications',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 10 * 60 * 1000,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقاً / Rate limit exceeded, please try again later',
          }),
        },
      },
    },
    async (request, reply) => {
      // Parse multipart
      const fields: Record<string, string> = {};
      let fileBuffer: Buffer | null = null;
      let fileMime: string | null = null;
      let fileName: string | null = null;
      let fileCount = 0;
      let tooLarge = false;
      let truncated = false;

      try {
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            fileCount += 1;
            if (fileCount > 1) {
              return reply.status(400).send({ error: 'Only one CV file is allowed' });
            }
            const buf = await part.toBuffer();
            if (part.file.truncated) truncated = true;
            fileBuffer = buf;
            fileMime = part.mimetype;
            fileName = part.filename;
            if (buf.length > CV_MAX_BYTES) tooLarge = true;
          } else {
            fields[part.fieldname] = String(part.value ?? '');
          }
        }
      } catch {
        return reply.status(400).send({ error: 'Invalid multipart body' });
      }

      // Honeypot
      if (fields.website && fields.website.trim().length > 0) {
        return reply.status(201).send({ ok: true });
      }

      const cfg = await getCareersFormConfig();
      const required = cfg.required;

      const name = (fields.name ?? '').trim();
      const email = (fields.email ?? '').trim();
      const phone = (fields.phone ?? '').trim();
      const jobTitle = (fields.jobTitle ?? '').trim();
      const message = (fields.message ?? '').trim();

      // Validation
      if (required.name && !name) {
        return reply.status(400).send({ error: 'name is required', field: 'name' });
      }
      if (name && name.length > 120) {
        return reply.status(400).send({ error: 'name must be at most 120 characters', field: 'name' });
      }
      if (required.email && !email) {
        return reply.status(400).send({ error: 'email is required', field: 'email' });
      }
      if (email) {
        if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return reply.status(400).send({ error: 'invalid email', field: 'email' });
        }
      }
      if (required.phone && !phone) {
        return reply.status(400).send({ error: 'phone is required', field: 'phone' });
      }
      if (phone) {
        if (phone.length < 7 || phone.length > 20 || !/^[0-9\s+\-()]+$/.test(phone)) {
          return reply.status(400).send({ error: 'invalid phone', field: 'phone' });
        }
      }
      if (required.jobTitle && !jobTitle) {
        return reply.status(400).send({ error: 'jobTitle is required', field: 'jobTitle' });
      }
      if (jobTitle && jobTitle.length > 150) {
        return reply.status(400).send({ error: 'jobTitle must be at most 150 characters', field: 'jobTitle' });
      }
      if (required.message && !message) {
        return reply.status(400).send({ error: 'message is required', field: 'message' });
      }
      if (message && message.length > 3000) {
        return reply.status(400).send({ error: 'message must be at most 3000 characters', field: 'message' });
      }
      if (required.cv && !fileBuffer) {
        return reply.status(400).send({ error: 'cv is required', field: 'cv' });
      }

      // CV validation
      if (fileBuffer) {
        if (truncated || tooLarge || fileBuffer.length > CV_MAX_BYTES) {
          return reply.status(400).send({ error: 'CV exceeds 5 MB limit', field: 'cv' });
        }
        if (fileMime !== 'application/pdf') {
          return reply.status(400).send({ error: 'CV must be a PDF', field: 'cv' });
        }
        if (fileBuffer.length < 5 || fileBuffer.toString('ascii', 0, 5) !== '%PDF-') {
          return reply.status(400).send({ error: 'CV must be a valid PDF', field: 'cv' });
        }
      }

      // Write file if present
      let cvPath: string | null = null;
      let cvOriginalName: string | null = null;
      let writtenFilePath: string | null = null;

      if (fileBuffer) {
        const cvDir = path.join(config.privateDir, CV_DIRNAME);
        await fs.mkdir(cvDir, { recursive: true });
        const storedName = randomCvName();
        cvPath = `${CV_DIRNAME}/${storedName}`;
        cvOriginalName = sanitiseOriginalName(fileName || 'cv.pdf');
        if (!cvOriginalName) cvOriginalName = 'cv.pdf';
        writtenFilePath = path.join(cvDir, storedName);
        await fs.writeFile(writtenFilePath, fileBuffer);
      }

      try {
        const created = await prisma.jobApplication.create({
          data: {
            name,
            email,
            phone,
            jobTitle,
            message: message || null,
            cvPath,
            cvOriginalName,
            status: 'new',
          },
        });

        // Log only id and status
        request.log.info({ applicationId: created.id, status: created.status }, 'job application created');

        // Dispatch notification (fire-and-forget as for inquiries)
        await dispatch(sendJobApplicationNotificationJob, {
          name: created.name,
          jobTitle: created.jobTitle,
          createdAt: created.createdAt,
        });

        return reply.status(201).send({ ok: true });
      } catch (err) {
        if (writtenFilePath) {
          await fs.unlink(writtenFilePath).catch(() => {});
        }
        throw err;
      }
    }
  );

  // Admin: list
  fastify.get(
    '/applications',
    { onRequest: [authenticate, requirePermission('viewApplications')] },
    async (request) => {
      const query = request.query as Record<string, string | undefined>;
      const status = query.status;
      const q = query.q;
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (q && q.trim()) {
        // Postgres needs `mode: 'insensitive'`; SQLite (dev/tests) rejects it and
        // its LIKE is already case-insensitive for ASCII.
        const match = config.databaseUrl.startsWith('file:')
          ? { contains: q.trim() }
          : { contains: q.trim(), mode: 'insensitive' as const };
        where.OR = [{ name: match }, { email: match }, { phone: match }, { jobTitle: match }];
      }

      const [items, total] = await Promise.all([
        prisma.jobApplication.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.jobApplication.count({ where }),
      ]);

      return {
        items: items.map(toListView),
        total,
        page,
        limit,
      };
    }
  );

  // Admin: get one
  fastify.get(
    '/applications/:id',
    { onRequest: [authenticate, requirePermission('viewApplications')] },
    async (request) => {
      const { id } = applicationIdParamsSchema.parse(request.params);
      const row = await prisma.jobApplication.findUnique({ where: { id } });
      if (!row) throw Object.assign(new Error('Not found'), { statusCode: 404 });
      return toDetailView(row);
    }
  );

  // Admin: download CV
  fastify.get(
    '/applications/:id/cv',
    { onRequest: [authenticate, requirePermission('viewApplications')] },
    async (request, reply) => {
      const { id } = applicationIdParamsSchema.parse(request.params);
      const row = await prisma.jobApplication.findUnique({ where: { id } });
      if (!row || !row.cvPath) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const cvDir = path.resolve(config.privateDir, CV_DIRNAME);
      const resolved = path.resolve(config.privateDir, row.cvPath);
      // Path safety: must stay inside cv dir
      if (!resolved.startsWith(cvDir + path.sep)) {
        return reply.status(404).send({ error: 'Not found' });
      }

      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(resolved);
      } catch {
        return reply.status(404).send({ error: 'Not found' });
      }
      if (!stat.isFile()) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const original = sanitiseOriginalName(row.cvOriginalName || 'cv.pdf') || 'cv.pdf';
      const encoded = encodeURIComponent(original);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'private, no-store');

      const stream = (await import('node:fs')).createReadStream(resolved);
      return reply.send(stream);
    }
  );

  // Admin: patch
  fastify.patch(
    '/applications/:id',
    {
      preValidation: [validateBody(patchApplicationBodySchema)],
      onRequest: [authenticate, requirePermission('manageApplications')],
    },
    async (request) => {
      const { id } = applicationIdParamsSchema.parse(request.params);
      const body = patchApplicationBodySchema.parse(request.body ?? {});

      const data: { status?: JobApplicationStatus; statusAr?: string; adminNote?: string | null } = {};
      if (body.status !== undefined) {
        data.status = body.status;
      }
      if (body.adminNote !== undefined) {
        data.adminNote = body.adminNote;
      }

      const updated = await prisma.jobApplication.update({
        where: { id },
        data,
      });
      return toDetailView(updated);
    }
  );

  // Admin: delete
  fastify.delete(
    '/applications/:id',
    { onRequest: [authenticate, requirePermission('manageApplications')] },
    async (request, reply) => {
      const { id } = applicationIdParamsSchema.parse(request.params);
      const row = await prisma.jobApplication.findUnique({ where: { id } });
      if (!row) {
        return reply.status(404).send({ error: 'Not found' });
      }
      await prisma.jobApplication.delete({ where: { id } });
      if (row.cvPath) {
        const resolved = path.resolve(config.privateDir, row.cvPath);
        const cvDir = path.resolve(config.privateDir, CV_DIRNAME);
        if (resolved.startsWith(cvDir + path.sep)) {
          await fs.unlink(resolved).catch(() => {});
        }
      }
      return reply.status(200).send({ ok: true });
    }
  );

  // Admin: settings
  fastify.get(
    '/settings',
    { onRequest: [authenticate, requirePermission('manageApplications')] },
    async () => {
      const [form, emails] = await Promise.all([getCareersFormConfig(), getCareersNotificationEmails()]);
      return { required: form.required, notificationEmails: emails };
    }
  );

  fastify.put(
    '/settings',
    {
      preValidation: [validateBody(settingsBodySchema)],
      onRequest: [authenticate, requirePermission('manageApplications')],
    },
    async (request) => {
      const body = settingsBodySchema.parse(request.body ?? {});
      if (body.required) {
        await setCareersFormConfig({ required: body.required }, request.admin!.id);
      }
      if (body.notificationEmails) {
        await setCareersNotificationEmails(body.notificationEmails, request.admin!.id);
      }
      const [form, emails] = await Promise.all([getCareersFormConfig(), getCareersNotificationEmails()]);
      return { required: form.required, notificationEmails: emails };
    }
  );
};