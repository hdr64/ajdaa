import type { FastifyPluginAsync } from 'fastify';
import fs from 'fs/promises';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config/env.js';
import {
  processAndSaveFile,
  deleteMediaFile,
  syncDiskMediaToDatabase,
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
import { inspectMediaUsage, getBatchMediaUsage } from '../services/mediaUsageService.js';
import { authenticate, requireAnyPermission } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';

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
   * Resumable Chunked Upload: Initialize session
   */
  fastify.post('/upload/chunked/init', mediaGuard, async (request, reply) => {
    const initSchema = z.object({
      filename: z.string().min(1).max(255),
      totalSize: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
      totalChunks: z.number().int().positive().max(2000),
      chunkSize: z.number().int().positive().max(50 * 1024 * 1024).default(5 * 1024 * 1024),
      mimeType: z.string().optional(),
    });

    const parsed = initSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid chunk initialization parameters' });
    }

    const diskStats = await fs.statfs(UPLOAD_DIR).catch(() => null);
    if (diskStats) {
      const freeBytes = Number(diskStats.bavail) * Number(diskStats.bsize);
      if (freeBytes < parsed.data.totalSize) {
        return reply.status(507).send({
          error: `مساحة القرص غير كافية لرفع هذا الملف (${(parsed.data.totalSize / (1024 ** 3)).toFixed(2)} GB مطلوب، والمتبقي ${(freeBytes / (1024 ** 3)).toFixed(2)} GB)`,
        });
      }
    }

    try {
      const res = await initChunkedUpload({
        ...parsed.data,
        adminId: request.admin?.id,
      });
      return reply.status(201).send(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to init chunked upload';
      return reply.status(500).send({ error: message });
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

    try {
      const res = await saveUploadChunk(uploadId, chunkIndex, buffer);
      return reply.send(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save chunk';
      return reply.status(400).send({ error: message });
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
      const message = err instanceof Error ? err.message : 'Upload session not found';
      return reply.status(404).send({ error: message });
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
      const message = err instanceof Error ? err.message : 'Failed to complete chunked upload';
      return reply.status(400).send({ error: message });
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
      const message = err instanceof Error ? err.message : 'Failed to abort chunked upload';
      return reply.status(400).send({ error: message });
    }
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
      type: z.enum(['all', 'image', 'video', 'pdf', 'model3d', 'other']).default('all'),
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
    if (type === 'other') {
      where.fileType = { in: ['other', 'document'] };
    } else if (type !== 'all') {
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
