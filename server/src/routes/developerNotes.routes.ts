import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { config } from '../config/env.js';
import { sendMail } from '../services/mailService.js';
import { developerNoteNotification } from '../services/mailTemplates.js';
import { loggerService } from '../services/loggerService.js';

const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  section: z.string().trim().min(1, 'Section is required'),
  body: z.string().trim().min(1, 'Description is required'),
  solution: z.string().trim().optional(),
  screenshotUrl: z.string().trim().optional(),
  adminName: z.string().trim().optional(),
  adminEmail: z.string().trim().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  metadata: z.record(z.unknown()).optional(),
});

const updateNoteSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  solution: z.string().trim().optional(),
});

const querySchema = z.object({
  key: z.string().optional(),
  status: z.enum(['all', 'pending', 'in_progress', 'resolved', 'closed']).optional().default('all'),
  priority: z.enum(['all', 'low', 'medium', 'high', 'critical']).optional().default('all'),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  page: z.coerce.number().int().min(1).optional().default(1),
});

/**
 * Access guard for developer notes management:
 * Only accessible via:
 * 1. Matching developer secret key (?key=... or x-dev-key or Bearer <key>)
 * 2. Super Admin JWT token
 */
function isDeveloperAuthorized(request: FastifyRequest): boolean {
  const queryKey = (request.query as { key?: string })?.key;
  const headerKey = request.headers['x-dev-key'] as string | undefined;
  const authHeader = request.headers['authorization'];
  let bearerKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const candidateKey = queryKey || headerKey || bearerKey;
  if (candidateKey && candidateKey === config.developer.secretKey) {
    return true;
  }

  // Also check if admin is super_admin
  const admin = request.admin;
  if (admin && admin.role === 'super_admin') {
    return true;
  }

  return false;
}

export const developerNotesRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. POST /api/developer/notes - Submit a new developer note
  // Called by AdminFeedbackPet from anywhere in the admin dashboard
  fastify.post(
    '/',
    {
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      // Try to parse admin if token is present
      try {
        await request.jwtVerify();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.admin = request.user as any;
      } catch {
        // Optional auth
      }

      const parsed = createNoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const data = parsed.data;
      const adminUser = request.admin;

      const adminName = adminUser?.name || data.adminName || 'مسؤول النظام';
      const adminEmail = adminUser?.email || data.adminEmail || null;

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

      // Broadcast to active dev monitoring sockets
      fastify.io.emit('developer:note:new', {
        id: note.id,
        title: note.title,
        section: note.section,
        priority: note.priority,
        adminName,
        createdAt: note.createdAt.toISOString(),
      });

      // Dispatch Email Notification to Developer
      const recipients = config.developer.emails;
      if (recipients.length > 0) {
        for (const recipient of recipients) {
          try {
            await sendMail(
              recipient,
              developerNoteNotification({
                brandName: config.mail.fromName,
                appUrl: config.appUrl,
                title: note.title,
                section: note.section,
                body: note.body,
                solution: note.solution,
                screenshotUrl: note.screenshotUrl,
                adminName: note.adminName,
                adminEmail: note.adminEmail,
                priority: note.priority,
              })
            );
          } catch (err) {
            loggerService.error('Failed to dispatch developer note email notification', {
              err: String(err),
              recipient,
            });
          }
        }
      }

      return reply.status(201).send({
        success: true,
        message: 'Developer note registered successfully and dispatched to development team',
        note,
      });
    }
  );

  const requireDeveloperAuth = async (request: FastifyRequest, reply: any) => {
    try {
      await request.jwtVerify();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request.admin = request.user as any;
    } catch {
      // Proceed to developer key check
    }

    if (!isDeveloperAuthorized(request)) {
      return reply.status(403).send({
        error: 'Forbidden: Access restricted to authorized development team',
        hint: 'Provide the developer secret key via ?key=... or x-dev-key header, or log in as super_admin.',
      });
    }
  };

  // 2. GET /api/developer/notes - List developer notes
  fastify.get(
    '/',
    { preHandler: [requireDeveloperAuth] },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>) => {
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
        where.OR = [
          { title: { contains: query.search } },
          { body: { contains: query.search } },
          { section: { contains: query.search } },
          { adminName: { contains: query.search } },
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
  fastify.get('/export', { preHandler: [requireDeveloperAuth] }, async (request, reply) => {
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
    { preHandler: [requireDeveloperAuth] },
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
    { preHandler: [requireDeveloperAuth] },
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
    { preHandler: [requireDeveloperAuth] },
    async (request) => {
      await prisma.developerNote.delete({
        where: { id: request.params.id },
      });

      return { success: true, message: 'Developer note deleted successfully' };
    }
  );
};
