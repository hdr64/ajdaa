import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  processAndSaveFile,
  deleteMediaFile,
  syncDiskMediaToDatabase,
  MAX_UPLOAD_BYTES,
  MediaInUseError,
} from '../services/mediaService.js';
import { inspectMediaUsage, getBatchMediaUsage } from '../services/mediaUsageService.js';
import { authenticate, requireAnyPermission } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';

export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  const mediaGuard = {
    onRequest: [
      authenticate,
      requireAnyPermission('manageProjects', 'managePastProjects', 'manageMedia', 'manageCms'),
    ],
  };

  /**
   * Upload an image or PDF and register it in MediaFile.
   */
  fastify.post('/upload', mediaGuard, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    if (data.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
      return reply.status(413).send({ error: 'File exceeds the 50 MB limit' });
    }

    const stored = await processAndSaveFile(buffer, data.filename);

    const record = await prisma.mediaFile.create({
      data: {
        url: stored.url,
        filename: stored.filename,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        fileType: stored.fileType,
        size: stored.size,
        storageKey: stored.storageKey,
        createdById: request.admin?.id,
      },
    });

    return reply.status(201).send({
      id: record.id,
      url: record.url,
      filename: record.filename,
      originalName: record.originalName,
      mimeType: record.mimeType,
      fileType: record.fileType,
      size: record.size,
    });
  });

  /**
   * Browse media files with usage detection and filters.
   */
  fastify.get('/', mediaGuard, async (request, reply) => {
    // 1. Ensure any pre-existing files on disk are indexed
    await syncDiskMediaToDatabase().catch(() => 0);

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(24),
      type: z.enum(['all', 'image', 'pdf', 'model3d']).default('all'),
      status: z.enum(['all', 'linked', 'orphaned']).default('all'),
      search: z.string().optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { page, limit, type, status, search } = parsed.data;

    // Prisma filter for type and search
    const where: Prisma.MediaFileWhereInput = {};
    if (type !== 'all') {
      where.fileType = type;
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      where.OR = [
        { originalName: { contains: q } },
        { filename: { contains: q } },
      ];
    }

    const allMatching = await prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch usage map to annotate each item
    const usageMap = await getBatchMediaUsage();

    // 3. Resolve uploader admin names for createdById
    const adminIds = [...new Set(allMatching.map((m) => m.createdById).filter(Boolean))] as string[];
    const admins = adminIds.length > 0
      ? await prisma.adminUser.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a.name || a.email]));

    const annotated = allMatching.map((item) => {
      const usages = usageMap.get(item.filename.toLowerCase()) ?? [];
      const createdByName = item.createdById ? (adminMap.get(item.createdById) ?? null) : null;
      return {
        ...item,
        createdByName,
        usageCount: usages.length,
        usages,
      };
    });

    // 3. Filter by linked / orphaned status if requested
    let filtered = annotated;
    if (status === 'linked') {
      filtered = annotated.filter((i) => i.usageCount > 0);
    } else if (status === 'orphaned') {
      filtered = annotated.filter((i) => i.usageCount === 0);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const items = filtered.slice((page - 1) * limit, page * limit);

    return reply.send({
      items,
      total,
      page,
      totalPages,
    });
  });

  /**
   * Check usage for a specific media URL or filename.
   */
  fastify.get('/usage', mediaGuard, async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url || typeof url !== 'string') {
      return reply.status(400).send({ error: 'Missing url query parameter' });
    }

    const usage = await inspectMediaUsage(decodeURIComponent(url));
    return reply.send(usage);
  });

  /**
   * Delete a media file with usage safety guard.
   */
  fastify.delete('/:id', mediaGuard, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await deleteMediaFile(id);
      return reply.send({ success: true });
    } catch (err: unknown) {
      if (err instanceof MediaInUseError) {
        return reply.status(409).send({
          error: err.message,
          usageCount: err.usageCount,
          usages: err.usages,
        });
      }
      const message = err instanceof Error ? err.message : 'Failed to delete media';
      return reply.status(400).send({ error: message });
    }
  });
};
