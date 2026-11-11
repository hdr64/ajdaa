import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { z } from 'zod';
import { authenticate, requireAnyPermission } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';
import { SLUG_PATTERN, validateSlug } from '../services/mediaSlugService.js';
import {
  abortDriveUpload,
  completeDriveUpload,
  driveUploadStatus,
  initDriveUpload,
  saveDriveChunk,
} from '../services/driveUploadService.js';
import {
  DRIVE_DIR,
  DRIVE_SIMPLE_UPLOAD_MAX_BYTES,
  DriveError,
  breadcrumbsOf,
  cleanName,
  copyFile,
  copyFolder,
  createFolder,
  driveFilePath,
  driveUsage,
  emptyTrash,
  ensureDriveDir,
  ensureFolderPath,
  isInlineSafe,
  listFolder,
  listTrash,
  moveFolder,
  newStorageKey,
  purgeItems,
  registerUploadedFile,
  renameFolder,
  requireLiveFolder,
  restoreItems,
  searchDrive,
  toFileDto,
  toFolderDto,
  trashItems,
  updateFile,
} from '../services/driveService.js';

const idList = z.array(z.string().min(1).max(64)).max(500).default([]);
const itemsBody = z.object({ folderIds: idList, fileIds: idList });
const nullableId = z.string().min(1).max(64).nullable();

function contentDisposition(mode: 'inline' | 'attachment', name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\%]/g, '_');
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

interface SendableFile {
  name: string;
  storageKey: string;
  mimeType: string;
}

/** Streams a Drive file with range support. Only known-safe types may render inline. */
function sendDriveFile(reply: FastifyReply, file: SendableFile, wantInline: boolean) {
  const inline = wantInline && isInlineSafe(file.mimeType);
  reply.header('Content-Type', isInlineSafe(file.mimeType) || file.mimeType === 'application/zip' ? file.mimeType : 'application/octet-stream');
  reply.header('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', file.name));
  reply.header('X-Content-Type-Options', 'nosniff');
  return reply.sendFile(file.storageKey, DRIVE_DIR);
}

/** Admin API: `/api/drive`. Same access rule as the media library (`manageMedia`). */
export const driveRoutes: FastifyPluginAsync = async (fastify) => {
  const guard = { onRequest: [authenticate, requireAnyPermission('manageMedia')] };

  fastify.get('/list', guard, async (request) => {
    const query = z
      .object({
        view: z.enum(['files', 'trash', 'search']).default('files'),
        folderId: z.string().min(1).max(64).optional(),
        q: z.string().trim().max(200).optional(),
      })
      .parse(request.query);

    if (query.view === 'trash') {
      const { folders, files } = await listTrash();
      return { folder: null, breadcrumbs: [], folders: folders.map(toFolderDto), files: files.map(toFileDto) };
    }
    if (query.view === 'search') {
      const { folders, files } = query.q ? await searchDrive(query.q) : { folders: [], files: [] };
      return { folder: null, breadcrumbs: [], folders: folders.map(toFolderDto), files: files.map(toFileDto) };
    }
    const folderId = query.folderId ?? null;
    const { folders, files } = await listFolder(folderId);
    const breadcrumbs = await breadcrumbsOf(folderId);
    return {
      folder: breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null,
      breadcrumbs,
      folders: folders.map(toFolderDto),
      files: files.map(toFileDto),
    };
  });

  /** All live folders (id, name, parent) so the move/copy dialog can draw the tree in one request. */
  fastify.get('/folders', guard, async () => {
    const folders = await prisma.driveFolder.findMany({
      where: { trashedAt: null },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    });
    return { folders };
  });

  fastify.get('/usage', guard, async () => driveUsage());

  fastify.post('/folders', guard, async (request, reply) => {
    const body = z.object({ name: z.string(), parentId: nullableId.optional() }).parse(request.body);
    const folder = await createFolder(body.name, body.parentId ?? null, request.admin?.id);
    return reply.status(201).send(toFolderDto(folder));
  });

  fastify.patch('/folders/:id', guard, async (request) => {
    const { id } = request.params as { id: string };
    const body = z.object({ name: z.string().optional(), parentId: nullableId.optional() }).parse(request.body);
    let folder = await prisma.driveFolder.findUnique({ where: { id } });
    if (!folder) throw new DriveError('Folder not found', 404);
    if (body.name !== undefined) folder = await renameFolder(id, body.name);
    if (body.parentId !== undefined) folder = await moveFolder(id, body.parentId);
    return toFolderDto(folder);
  });

  fastify.post('/folders/:id/copy', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ parentId: nullableId.optional() }).parse(request.body ?? {});
    const folder = await copyFolder(id, body.parentId ?? null, request.admin?.id);
    return reply.status(201).send(toFolderDto(folder));
  });

  fastify.patch('/files/:id', guard, async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        folderId: nullableId.optional(),
        isPublic: z.boolean().optional(),
        slug: z.string().trim().toLowerCase().optional(),
      })
      .parse(request.body);
    if (body.slug !== undefined) {
      const problem = validateSlug(body.slug);
      if (problem) throw new DriveError(problem, 400);
    }
    return toFileDto(await updateFile(id, body));
  });

  fastify.post('/files/:id/copy', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ folderId: nullableId.optional() }).parse(request.body ?? {});
    const file = await copyFile(id, body.folderId ?? null, request.admin?.id);
    return reply.status(201).send(toFileDto(file));
  });

  /** Moves several items at once into `targetId` (null = the root). */
  fastify.post('/move', guard, async (request) => {
    const body = itemsBody.extend({ targetId: nullableId }).parse(request.body);
    await requireLiveFolder(body.targetId);
    for (const id of body.folderIds) await moveFolder(id, body.targetId);
    for (const id of body.fileIds) await updateFile(id, { folderId: body.targetId });
    return { success: true };
  });

  fastify.post('/trash', guard, async (request) => {
    await trashItems(itemsBody.parse(request.body));
    return { success: true };
  });

  fastify.post('/restore', guard, async (request) => {
    await restoreItems(itemsBody.parse(request.body));
    return { success: true };
  });

  /** Permanent delete. Only items already in the trash are removed. */
  fastify.post('/purge', guard, async (request) => {
    const deleted = await purgeItems(itemsBody.parse(request.body));
    return { success: true, deleted };
  });

  fastify.post('/trash/empty', guard, async () => ({ success: true, deleted: await emptyTrash() }));

  /**
   * One file per request. `folderId` is the target folder; `relPath` (folder uploads)
   * is the path below it, e.g. `Photos/2024/a.jpg`, whose folders are created on demand.
   */
  fastify.post('/upload', guard, async (request, reply) => {
    const query = z
      .object({ folderId: z.string().min(1).max(64).optional(), relPath: z.string().max(1024).optional() })
      .parse(request.query);

    const data = await request.file({ limits: { fileSize: DRIVE_SIMPLE_UPLOAD_MAX_BYTES }, throwFileSizeLimit: false });
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    await ensureDriveDir();
    const declared = Number(request.headers['content-length']);
    const free = await fs.statfs(DRIVE_DIR).catch(() => null);
    if (free && Number.isFinite(declared) && Number(free.bavail) * Number(free.bsize) < declared) {
      return reply.status(507).send({ error: 'Insufficient storage' });
    }

    const segments = (query.relPath ?? data.filename).split('/').filter((s) => s !== '');
    if (segments.length === 0) return reply.status(400).send({ error: 'Invalid file name' });
    const fileName = cleanName(segments[segments.length - 1]);
    const folderSegments = segments.slice(0, -1);

    await requireLiveFolder(query.folderId ?? null);
    const storageKey = newStorageKey(fileName);
    const target = driveFilePath(storageKey);
    try {
      await pipeline(data.file, createWriteStream(target));
    } catch (err) {
      await fs.unlink(target).catch(() => undefined);
      throw err;
    }
    if (data.file.truncated) {
      await fs.unlink(target).catch(() => undefined);
      return reply.status(413).send({ error: 'Too large for a single request: use the chunked upload' });
    }

    try {
      const folderId = await ensureFolderPath(query.folderId ?? null, folderSegments, request.admin?.id);
      const size = (await fs.stat(target)).size;
      const file = await registerUploadedFile({ name: fileName, folderId, storageKey, size, adminId: request.admin?.id });
      return reply.status(201).send(toFileDto(file));
    } catch (err) {
      await fs.unlink(target).catch(() => undefined);
      throw err;
    }
  });

  /**
   * Resumable chunked upload for big files (up to 5 GB): init, then chunks, then complete.
   * `relPath` has the same meaning as for `/upload`.
   */
  fastify.post('/upload/chunked/init', guard, async (request) => {
    const body = z
      .object({
        relPath: z.string().min(1).max(1024),
        folderId: nullableId.optional(),
        totalSize: z.number().int().positive(),
        totalChunks: z.number().int().positive(),
        chunkSize: z.number().int().positive(),
      })
      .parse(request.body);
    return initDriveUpload({ ...body, folderId: body.folderId ?? null, adminId: request.admin?.id });
  });

  fastify.post('/upload/chunked/chunk', guard, async (request, reply) => {
    const query = z.object({ uploadId: z.string().uuid(), chunkIndex: z.coerce.number().int().min(0) }).parse(request.query);
    const data = await request.file({ limits: { fileSize: 51 * 1024 * 1024 }, throwFileSizeLimit: false });
    if (!data) return reply.status(400).send({ error: 'No chunk data received' });
    const buffer = await data.toBuffer();
    if (data.file.truncated) return reply.status(413).send({ error: 'Chunk is too large' });
    await saveDriveChunk(query.uploadId, query.chunkIndex, buffer);
    return { receivedChunk: query.chunkIndex };
  });

  fastify.get('/upload/chunked/status/:uploadId', guard, async (request) => {
    const { uploadId } = z.object({ uploadId: z.string().uuid() }).parse(request.params);
    return driveUploadStatus(uploadId);
  });

  fastify.post('/upload/chunked/complete', guard, async (request, reply) => {
    const { uploadId } = z.object({ uploadId: z.string().uuid() }).parse(request.body);
    const file = await completeDriveUpload(uploadId, request.admin?.id);
    return reply.status(201).send(toFileDto(file));
  });

  fastify.delete('/upload/chunked/abort/:uploadId', guard, async (request) => {
    const { uploadId } = z.object({ uploadId: z.string().uuid() }).parse(request.params);
    await abortDriveUpload(uploadId);
    return { success: true };
  });

  /** Download (or inline preview of a safe type) for a signed-in admin. */
  fastify.get('/files/:id/download', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { inline } = z.object({ inline: z.enum(['1', '0']).optional() }).parse(request.query);
    const file = await prisma.driveFile.findUnique({ where: { id } });
    if (!file) return reply.status(404).send({ error: 'File not found' });
    return sendDriveFile(reply, file, inline === '1');
  });
};

/**
 * Public share links: `GET /d/<slug>`. Works only while the file is shared and not in
 * the trash. Safe types (images, video, audio, PDF, plain text) open in the browser;
 * everything else downloads. `?download=1` always downloads.
 */
export const drivePublicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { slug: string }; Querystring: { download?: string } }>('/d/:slug', async (request, reply) => {
    const slug = request.params.slug.toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return reply.status(404).send({ error: 'Not found' });
    const file = await prisma.driveFile.findUnique({ where: { slug } });
    if (!file || !file.isPublic || file.trashedAt) return reply.status(404).send({ error: 'Not found' });
    reply.header('Cache-Control', 'public, max-age=60');
    return sendDriveFile(reply, file, request.query.download !== '1');
  });
};
