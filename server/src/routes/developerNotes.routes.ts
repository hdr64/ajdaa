import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { config, secretMatches } from '../config/env.js';
import { caseInsensitiveContains } from '../utils/caseInsensitive.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { loggerService } from '../services/loggerService.js';
import { dispatch } from '../services/queueService.js';
import { sendDeveloperNoteEmailJob } from '../jobs/emailJobs.js';
import { ADMINS_ROOM } from '../sockets/index.js';

/** Longest accepted value for each free-text field. */
const MAX_TITLE_LENGTH = 200;
const MAX_SECTION_LENGTH = 100;
const MAX_BODY_LENGTH = 5000;
const MAX_SOLUTION_LENGTH = 5000;
const MAX_SCREENSHOT_URL_LENGTH = 500;

/**
 * A screenshot is either served by this API or hosted somewhere else over
 * https. Nothing else is accepted: `javascript:` would become a link in the
 * export, and a path with spaces or quotes would break the markdown the
 * export is written in.
 */
const SCREENSHOT_URL_PATTERN = /^(https:\/\/|\/uploads\/)[^\s"'<>\\]+$/;

const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(MAX_TITLE_LENGTH),
  section: z.string().trim().min(1, 'Section is required').max(MAX_SECTION_LENGTH),
  body: z.string().trim().min(1, 'Description is required').max(MAX_BODY_LENGTH),
  solution: z.string().trim().max(MAX_SOLUTION_LENGTH).optional(),
  // Only a remote https URL or a path served by this API: anything else would
  // turn the note into a tracker for whoever opens the export.
  screenshotUrl: z
    .string()
    .trim()
    .max(MAX_SCREENSHOT_URL_LENGTH)
    .optional()
    .refine((value) => value === undefined || SCREENSHOT_URL_PATTERN.test(value), {
      message: 'screenshotUrl must be an https:// URL or a /uploads/ path',
    }),
  adminName: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateNoteSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  solution: z.string().trim().max(MAX_SOLUTION_LENGTH).optional(),
});

const querySchema = z.object({
  status: z.enum(['all', 'pending', 'in_progress', 'resolved', 'closed']).optional().default('all'),
  priority: z.enum(['all', 'low', 'medium', 'high', 'critical']).optional().default('all'),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  page: z.coerce.number().int().min(1).optional().default(1),
});

/**
 * The shared developer key is the second factor of the management endpoints,
 * and it is only accepted in a header: a query parameter would end up in
 * access logs, proxy logs and browser history.
 */
async function requireDeveloperKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply | void> {
  const header = request.headers['x-dev-notes-key'];
  const provided = typeof header === 'string' ? header : undefined;

  if (!secretMatches(provided, config.developer.secretKey)) {
    return reply.status(401).send({
      error: 'Unauthorized: the developer key is missing or wrong',
      message: 'Provide the developer key in the `x-dev-notes-key` header.',
    });
  }
}

/**
 * Access guard for the developer-notes management endpoints:
 * an active super admin (re-read from the database on every request) plus the
 * shared developer key.
 */
const requireDeveloperAuth = [authenticate, requireSuperAdmin, requireDeveloperKey];

export const developerNotesRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. POST /api/developer/notes - Submit a new developer note.
  // Called by the admin dashboard, so it needs a session — but any signed-in
  // admin may report a problem, not only a super admin.
  fastify.post(
    '/',
    {
      onRequest: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      const parsed = createNoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const data = parsed.data;
      const adminUser = request.admin;

      // The author is whoever is signed in. `adminEmail` from the body is
      // ignored: a caller must not be able to file a note under someone
      // else's name.
      const adminName = data.adminName || adminUser?.email || 'مسؤول النظام';
      const adminEmail = adminUser?.email ?? null;

      const note = await prisma.developerNote.create({
        data: {
          title: data.title,
          section: data.section,
          body: data.body,
          solution: data.solution || null,
          screenshotUrl: data.screenshotUrl || null,
          adminName,
          adminEmail,
          priority: data.priority,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          status: 'pending',
        },
      });

      loggerService.info(
        `New developer note submitted: "${note.title}" (${note.section}) by ${adminName}`,
        { id: note.id, section: note.section, priority: note.priority },
        'developer-note'
      );

      // Only the signed-in admins hear about it: the note may carry internal
      // details that must not reach a visitor's browser.
      fastify.io?.to(ADMINS_ROOM).emit('developer:note:new', {
        id: note.id,
        title: note.title,
        section: note.section,
        priority: note.priority,
        adminName,
        createdAt: note.createdAt.toISOString(),
      });

      // Dispatch Email Notification to Developer. Queued when Redis is up (the
      // SMTP handshake then happens in the worker, not this request), and run
      // inline otherwise. Either way the note is already persisted, so neither
      // path can lose it.
      await dispatch(sendDeveloperNoteEmailJob, {
        noteId: String(note.id),
        title: note.title,
        section: note.section,
        body: note.body,
        solution: note.solution,
        screenshotUrl: note.screenshotUrl,
        adminName: note.adminName,
        adminEmail: note.adminEmail,
        priority: note.priority,
      });

      return reply.status(201).send({
        success: true,
        message: 'Developer note registered successfully and dispatched to development team',
        note,
      });
    }
  );

  // 2. GET /api/developer/notes - List developer notes
  fastify.get<{ Querystring: z.infer<typeof querySchema> }>(
    '/',
    { preHandler: requireDeveloperAuth },
    async (request) => {
      const query = querySchema.parse(request.query);
      const take = query.limit;
      const skip = (query.page - 1) * take;

      // Build filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (query.status !== 'all') {
        where.status = query.status;
      }
      if (query.priority !== 'all') {
        where.priority = query.priority;
      }
      if (query.search) {
        const match = caseInsensitiveContains(config.databaseUrl, query.search);
        where.OR = [
          { title: match },
          { body: match },
          { section: match },
          { adminName: match },
        ];
      }

      const [notes, totalCount, statusCounts] = await Promise.all([
        prisma.developerNote.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.developerNote.count({ where }),
        prisma.developerNote.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
      ]);

      const counts = {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        total: totalCount,
      };
      for (const sc of statusCounts) {
        if (sc.status in counts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (counts as any)[sc.status] = sc._count.status;
        }
      }

      return {
        success: true,
        notes,
        totalCount,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(totalCount / take),
        counts,
      };
    }
  );

  // 3. GET /api/developer/notes/export - Export all notes as markdown or JSON
  fastify.get('/export', { preHandler: requireDeveloperAuth }, async (request, reply) => {
    const query = request.query as { format?: string };
    const notes = await prisma.developerNote.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (query.format === 'json') {
      return { success: true, count: notes.length, notes };
    }

    // Default to Markdown for easy reading or piping
    const md = [
      `# Ajda Platform — Developer Notes & Bug Reports Export`,
      `> **Generated**: ${new Date().toISOString()}`,
      `> **Total Notes**: ${notes.length}`,
      '',
      ...notes.map((n, i) =>
        [
          `## ${i + 1}. [${n.priority.toUpperCase()}] ${n.title}`,
          `- **ID**: \`${n.id}\``,
          `- **Section**: ${n.section}`,
          `- **Status**: \`${n.status}\``,
          `- **Submitted By**: ${n.adminName || 'Admin'} (${n.adminEmail || 'No email'})`,
          `- **Date**: ${n.createdAt.toISOString()}`,
          ...(n.screenshotUrl ? [`- **Screenshot**: [View Image](${n.screenshotUrl})`] : []),
          '',
          `### Description`,
          n.body,
          ...(n.solution ? ['', `### Proposed Solution`, n.solution] : []),
          '',
          '---',
          '',
        ].join('\n')
      ),
    ].join('\n');

    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    return md;
  });

  // 4. GET /api/developer/notes/:id - Get single note
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireDeveloperAuth },
    async (request, reply) => {
      const note = await prisma.developerNote.findUnique({
        where: { id: request.params.id },
      });

      if (!note) {
        return reply.status(404).send({ error: 'Developer note not found' });
      }

      return { success: true, note };
    }
  );

  // 5. PATCH /api/developer/notes/:id - Update note status/priority
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireDeveloperAuth },
    async (request, reply) => {
      const parsed = updateNoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const updated = await prisma.developerNote.update({
        where: { id: request.params.id },
        data: parsed.data,
      });

      return { success: true, note: updated };
    }
  );

  // 6. DELETE /api/developer/notes/:id - Delete a note
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireDeveloperAuth },
    async (request) => {
      await prisma.developerNote.delete({
        where: { id: request.params.id },
      });

      return { success: true, message: 'Developer note deleted successfully' };
    }
  );
};
