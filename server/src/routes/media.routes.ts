import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import fs from 'fs/promises';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config/env.js';
import {
  processAndSaveFile,
  deleteMediaFile,
  syncDiskMediaThrottled,
  getDiskStorageStats,
  MAX_UPLOAD_BYTES,
  MediaInUseError,
} from '../services/mediaService.js';
import {
  initChunkedUpload,
  saveUploadChunk,
  getUploadChunkStatus,
  completeChunkedUpload,
  abortChunkedUpload,
} from '../services/chunkedUploadService.js';
import { inspectMediaUsage, getBatchMediaUsage, usageKey } from '../services/mediaUsageService.js';
import { authenticate, requireAnyPermission } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';
import { EXTRACT_KINDS } from '../services/zipExtractService.js';
import { generateUniqueSlug, validateSlug } from '../services/mediaSlugService.js';

/** Errors that carry their own status (MediaUploadError, ZipExtractError) keep it; anything else is a generic 500. */
function sendUploadError(reply: FastifyReply, err: unknown, fallback: string) {
  const statusCode = (err as { statusCode?: number } | null)?.statusCode;
  if (typeof statusCode === 'number' && err instanceof Error) {
    return reply.status(statusCode).send({ error: err.message });
  }
  return reply.status(500).send({ error: fallback });
}

export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  const UPLOAD_DIR = config.uploadDir;

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

    const diskStats = await fs.statfs(UPLOAD_DIR).catch(() => null);
    if (diskStats) {
      const freeBytes = Number(diskStats.bavail) * Number(diskStats.bsize);
      if (freeBytes < buffer.length) {
        return reply.status(507).send({ error: 'مساحة القرص غير كافية لإتمام الرفع (Insufficient storage)' });
      }
    }

    const stored = await processAndSaveFile(buffer, data.filename);

    const record = await prisma.mediaFile.create({
      data: {
        url: stored.url,
        slug: await generateUniqueSlug(stored.originalName),
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
      slug: record.slug,
      filename: record.filename,
      originalName: record.originalName,
      mimeType: record.mimeType,
      fileType: record.fileType,
      size: record.size,
    });
  });

  /**
   * Resumable Chunked Upload: Initialize session
   */
  fastify.post('/upload/chunked/init', mediaGuard, async (request, reply) => {
    const initSchema = z.object({
      filename: z.string().min(1).max(255),
      totalSize: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
      totalChunks: z.number().int().positive().max(2000),
      chunkSize: z.number().int().positive().max(50 * 1024 * 1024).default(5 * 1024 * 1024),
      mimeType: z.string().optional(),
      // Unpack a .zip into the library as this kind of content.
      extract: z.enum(EXTRACT_KINDS).optional(),
    });

    const parsed = initSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid chunk initialization parameters' });
    }

    try {
      const res = await initChunkedUpload({
        ...parsed.data,
        adminId: request.admin?.id,
      });
      return reply.status(201).send(res);
    } catch (err: unknown) {
      return sendUploadError(reply, err, 'Failed to init chunked upload');
    }
  });

  /**
   * Resumable Chunked Upload: Save a chunk part
   */
  fastify.post('/upload/chunked/chunk', mediaGuard, async (request, reply) => {
    const querySchema = z.object({
      uploadId: z.string().uuid(),
      chunkIndex: z.coerce.number().int().min(0),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Missing or invalid uploadId or chunkIndex' });
    }

    const { uploadId, chunkIndex } = parsed.data;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No chunk data received' });
    }

    const buffer = await data.toBuffer();
    if (data.file.truncated) {
      return reply.status(413).send({ error: 'Chunk is too large' });
    }

    try {
      const res = await saveUploadChunk(uploadId, chunkIndex, buffer);
      return reply.send(res);
    } catch (err: unknown) {
      return sendUploadError(reply, err, 'Failed to save chunk');
    }
  });

  /**
   * Resumable Chunked Upload: Inspect upload status / resume
   */
  fastify.get('/upload/chunked/status/:uploadId', mediaGuard, async (request, reply) => {
    const paramsSchema = z.object({
      uploadId: z.string().uuid(),
    });

    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid upload ID' });
    }

    try {
      const status = await getUploadChunkStatus(parsed.data.uploadId);
      return reply.send(status);
    } catch (err: unknown) {
      return sendUploadError(reply, err, 'Failed to read upload status');
    }
  });

  /**
   * Resumable Chunked Upload: Finish and assemble chunks into media file
   */
  fastify.post('/upload/chunked/complete', mediaGuard, async (request, reply) => {
    const bodySchema = z.object({
      uploadId: z.string().uuid(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid upload ID' });
    }

    try {
      const media = await completeChunkedUpload(parsed.data.uploadId, request.admin?.id);
      return reply.status(201).send(media);
    } catch (err: unknown) {
      return sendUploadError(reply, err, 'Failed to complete chunked upload');
    }
  });

  /**
   * Resumable Chunked Upload: Abort session
   */
  fastify.delete('/upload/chunked/abort/:uploadId', mediaGuard, async (request, reply) => {
    const paramsSchema = z.object({
      uploadId: z.string().uuid(),
    });

    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid upload ID' });
    }

    try {
      await abortChunkedUpload(parsed.data.uploadId);
      return reply.send({ success: true });
    } catch (err: unknown) {
      return sendUploadError(reply, err, 'Failed to abort chunked upload');
    }
  });

  /**
   * Browse media files with usage detection and filters.
   */
  fastify.get('/', mediaGuard, async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(24),
      type: z.enum(['all', 'image', 'video', 'pdf', 'model3d', 'html', 'other']).default('all'),
      status: z.enum(['all', 'linked', 'orphaned']).default('all'),
      search: z.string().optional(),
      // `rescan=1` forces the disk index to refresh now (otherwise at most once a minute).
      rescan: z.enum(['0', '1']).optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { page, limit, type, status, search, rescan } = parsed.data;

    // Index files that were dropped on disk by hand (throttled: a full scan per request does not scale).
    await syncDiskMediaThrottled(rescan === '1').catch(() => 0);

    // Prisma filter for type and search
    const where: Prisma.MediaFileWhereInput = {};
    if (type === 'other') {
      where.fileType = { in: ['other', 'document'] };
    } else if (type !== 'all') {
      where.fileType = type;
    }
    if (search && search.trim()) {
      // SQLite's LIKE ignores case; PostgreSQL needs the explicit mode (as the Drive search does).
      const q = search.trim();
      const mode = (/^postgres/i.test(config.databaseUrl) ? { mode: 'insensitive' } : {}) as object;
      where.OR = [
        { originalName: { contains: q, ...mode } },
        { filename: { contains: q, ...mode } },
      ];
    }

    // Usage is computed from the other tables (small); only the page being shown is loaded in full.
    const usageMap = await getBatchMediaUsage();
    const orderBy = { createdAt: 'desc' } as const;
    let total: number;
    let rows: Awaited<ReturnType<typeof prisma.mediaFile.findMany>>;

    if (status === 'all') {
      [total, rows] = await Promise.all([
        prisma.mediaFile.count({ where }),
        prisma.mediaFile.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
      ]);
    } else {
      // Linked / orphaned depends on usage, which is not a column: filter on ids and urls only.
      const light = await prisma.mediaFile.findMany({ where, orderBy, select: { id: true, url: true } });
      const wantLinked = status === 'linked';
      const ids = light
        .filter((item) => ((usageMap.get(usageKey(item.url))?.length ?? 0) > 0) === wantLinked)
        .map((item) => item.id);
      total = ids.length;
      const pageIds = ids.slice((page - 1) * limit, page * limit);
      const found = pageIds.length > 0 ? await prisma.mediaFile.findMany({ where: { id: { in: pageIds } } }) : [];
      const byId = new Map(found.map((item) => [item.id, item]));
      rows = pageIds.map((id) => byId.get(id)).filter((item): item is (typeof found)[number] => item !== undefined);
    }

    // Resolve uploader admin names for the rows on this page.
    const adminIds = [...new Set(rows.map((m) => m.createdById).filter(Boolean))] as string[];
    const admins = adminIds.length > 0
      ? await prisma.adminUser.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a.name || a.email]));

    const items = rows.map((item) => {
      const usages = usageMap.get(usageKey(item.url)) ?? [];
      return {
        ...item,
        createdByName: item.createdById ? (adminMap.get(item.createdById) ?? null) : null,
        usageCount: usages.length,
        usages,
      };
    });
    const totalPages = Math.ceil(total / limit) || 1;

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
   * Get server disk storage statistics and available space.
   */
  fastify.get('/storage-stats', mediaGuard, async (_request, reply) => {
    try {
      const stats = await getDiskStorageStats();
      return reply.send(stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve storage stats';
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * Change a file's public slug (`/f/<slug>`, `/html/<slug>/`). The old link stops working.
   */
  fastify.patch('/:id', mediaGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ slug: z.string().trim().toLowerCase() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'slug is required' });
    }
    const problem = validateSlug(parsed.data.slug);
    if (problem) {
      return reply.status(400).send({ error: problem });
    }

    const media = await prisma.mediaFile.findUnique({ where: { id }, select: { id: true } });
    if (!media) {
      return reply.status(404).send({ error: 'Media file not found' });
    }
    const taken = await prisma.mediaFile.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
    if (taken && taken.id !== id) {
      return reply.status(409).send({ error: 'This slug is already used by another file' });
    }

    const updated = await prisma.mediaFile.update({ where: { id }, data: { slug: parsed.data.slug } });
    return reply.send({ id: updated.id, slug: updated.slug });
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
