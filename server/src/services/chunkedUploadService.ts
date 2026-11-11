import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { generateUniqueSlug } from './mediaSlugService.js';
import { MEDIA_ALLOWED_EXTS, MEDIA_IMAGE_EXTS, MEDIA_MODEL_EXTS, MEDIA_VIDEO_EXTS } from './mediaService.js';
import { extractZipToLibrary, ZipExtractError, type ExtractKind } from './zipExtractService.js';

const UPLOAD_DIR = config.uploadDir;
const CHUNK_DIR = path.join(UPLOAD_DIR, '.chunks');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STALE_MS = 24 * 60 * 60 * 1000;
export const MIN_CHUNK_BYTES = 256 * 1024;
export const MAX_CHUNK_BYTES = 50 * 1024 * 1024;
const MAX_CHUNKS = 20_000;

/** An upload problem the route can answer with its own status code. */
export class MediaUploadError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

export interface ChunkedMeta {
  uploadId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  mimeType?: string;
  /** Extract a .zip into the library as this kind instead of storing it. */
  extract?: ExtractKind;
  createdById?: string;
  createdAt: string;
}

function sessionDir(uploadId: string): string {
  if (!uploadId || !UUID_REGEX.test(uploadId)) throw new MediaUploadError('Invalid upload ID', 400);
  return path.join(CHUNK_DIR, uploadId);
}

async function readMeta(uploadId: string): Promise<ChunkedMeta> {
  const dir = sessionDir(uploadId);
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8')) as ChunkedMeta;
  } catch {
    throw new MediaUploadError('Upload session not found or expired', 404);
  }
}

/** Expected byte length of chunk `index`: every chunk is `chunkSize` except a shorter last one. */
function expectedChunkSize(meta: ChunkedMeta, index: number): number {
  return index === meta.totalChunks - 1 ? meta.totalSize - meta.chunkSize * (meta.totalChunks - 1) : meta.chunkSize;
}

async function removeStaleSessions(): Promise<void> {
  const names = await fs.readdir(CHUNK_DIR).catch(() => [] as string[]);
  const cutoff = Date.now() - STALE_MS;
  await Promise.all(
    names.map(async (name) => {
      const dir = path.join(CHUNK_DIR, name);
      const stat = await fs.stat(dir).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    })
  );
}

/**
 * Initializes a chunked upload session and creates a temporary folder for chunks.
 * Everything that can be checked from the declaration is checked here, before any byte arrives.
 */
export async function initChunkedUpload(params: {
  filename: string;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  mimeType?: string;
  extract?: ExtractKind;
  adminId?: string;
}): Promise<{ uploadId: string; chunkSize: number; totalChunks: number }> {
  const ext = path.extname(params.filename).toLowerCase();
  if (!MEDIA_ALLOWED_EXTS.has(ext)) throw new MediaUploadError('Unsupported file type', 400);
  if (params.chunkSize < MIN_CHUNK_BYTES || params.chunkSize > MAX_CHUNK_BYTES) {
    throw new MediaUploadError('Invalid chunk size', 400);
  }
  if (params.totalChunks > MAX_CHUNKS || params.totalChunks !== Math.max(1, Math.ceil(params.totalSize / params.chunkSize))) {
    throw new MediaUploadError('Chunk count does not match the file size', 400);
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const free = await fs.statfs(UPLOAD_DIR).catch(() => null);
  if (free && Number(free.bavail) * Number(free.bsize) < params.totalSize + MAX_CHUNK_BYTES) {
    throw new MediaUploadError('Insufficient storage', 507);
  }

  await fs.mkdir(CHUNK_DIR, { recursive: true });
  void removeStaleSessions();

  const uploadId = crypto.randomUUID();
  const dir = sessionDir(uploadId);
  await fs.mkdir(dir, { recursive: true });

  const meta: ChunkedMeta = {
    uploadId,
    filename: params.filename.slice(0, 255),
    totalSize: params.totalSize,
    totalChunks: params.totalChunks,
    chunkSize: params.chunkSize,
    mimeType: params.mimeType,
    extract: params.extract,
    createdById: params.adminId,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  return { uploadId, chunkSize: params.chunkSize, totalChunks: params.totalChunks };
}

/**
 * Saves one chunk into the upload session directory.
 */
export async function saveUploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunkBuffer: Buffer
): Promise<{ receivedChunk: number }> {
  const meta = await readMeta(uploadId);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
    throw new MediaUploadError('Invalid chunk index', 400);
  }
  if (chunkBuffer.length !== expectedChunkSize(meta, chunkIndex)) {
    throw new MediaUploadError('Chunk has an unexpected size', 400);
  }

  const dir = sessionDir(uploadId);
  const tmp = path.join(dir, `tmp_${chunkIndex}`);
  await fs.writeFile(tmp, chunkBuffer);
  await fs.rename(tmp, path.join(dir, `part_${chunkIndex}`)); // a half-written part never counts as received

  return { receivedChunk: chunkIndex };
}

/**
 * Inspects which chunks have been received so the client can resume after interruption.
 */
export async function getUploadChunkStatus(uploadId: string): Promise<{
  uploadId: string;
  uploadedChunks: number[];
  totalChunks: number;
  totalSize: number;
  filename: string;
}> {
  const meta = await readMeta(uploadId);
  const entries = await fs.readdir(sessionDir(uploadId));
  const uploadedChunks = entries
    .filter((entry) => /^part_\d+$/.test(entry))
    .map((entry) => Number(entry.slice(5)))
    .sort((a, b) => a - b);

  return {
    uploadId,
    uploadedChunks,
    totalChunks: meta.totalChunks,
    totalSize: meta.totalSize,
    filename: meta.filename,
  };
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/x-m4v',
  '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html',
  '.htm': 'text/html',
};

/** Type and mime come from the extension only; the client's declared mime is ignored. */
function resolveFileTypeAndMime(filename: string): { fileType: string; mimeType: string } {
  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  if (ext === '.html' || ext === '.htm') return { fileType: 'html', mimeType };
  if (MEDIA_VIDEO_EXTS.includes(ext)) return { fileType: 'video', mimeType };
  if (ext === '.pdf') return { fileType: 'pdf', mimeType };
  if (MEDIA_IMAGE_EXTS.includes(ext)) return { fileType: 'image', mimeType };
  if (MEDIA_MODEL_EXTS.includes(ext)) return { fileType: 'model3d', mimeType };
  return { fileType: 'other', mimeType };
}

/**
 * Combines all chunk parts into the final media file, removes temporary chunks,
 * and registers the file in the database. Memory stays flat whatever the file size.
 */
export async function completeChunkedUpload(uploadId: string, adminId?: string) {
  const meta = await readMeta(uploadId);
  const dir = sessionDir(uploadId);

  for (let i = 0; i < meta.totalChunks; i++) {
    const stat = await fs.stat(path.join(dir, `part_${i}`)).catch(() => null);
    if (!stat) throw new MediaUploadError(`Missing chunk ${i}`, 400);
  }

  const ext = path.extname(meta.filename).toLowerCase();
  const safeBase = meta.filename
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);

  const finalFilename = `${uploadId}-${safeBase || 'media'}${ext}`;
  const finalPath = path.join(UPLOAD_DIR, finalFilename);

  try {
    const out = fsSync.createWriteStream(finalPath);
    try {
      for (let i = 0; i < meta.totalChunks; i++) {
        const part = path.join(dir, `part_${i}`);
        await pipeline(fsSync.createReadStream(part), out, { end: false });
        await fs.unlink(part);
      }
    } finally {
      await new Promise<void>((resolve) => out.end(resolve));
    }
    if ((await fs.stat(finalPath)).size !== meta.totalSize) {
      throw new MediaUploadError('Assembled file has the wrong size', 400);
    }
  } catch (err) {
    await fs.unlink(finalPath).catch(() => {});
    throw err;
  }

  // Clean up session chunks directory
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});

  // A zip uploaded for a chosen kind is unpacked; its files become library rows.
  if (meta.extract) {
    if (ext !== '.zip') {
      await fs.unlink(finalPath).catch(() => {});
      throw new ZipExtractError('Only .zip files can be extracted');
    }
    const extracted = await extractZipToLibrary({
      zipPath: finalPath,
      originalName: meta.filename,
      kind: meta.extract,
      adminId: adminId || meta.createdById,
    });
    return { ...extracted[0], extracted };
  }

  const { fileType, mimeType } = resolveFileTypeAndMime(meta.filename);

  try {
    const record = await prisma.mediaFile.create({
      data: {
        url: `/uploads/${finalFilename}`,
        slug: await generateUniqueSlug(meta.filename),
        filename: finalFilename,
        originalName: meta.filename,
        mimeType,
        fileType,
        size: meta.totalSize,
        storageKey: finalFilename,
        createdById: adminId || meta.createdById,
      },
    });
    return {
      id: record.id,
      url: record.url,
      slug: record.slug,
      filename: record.filename,
      originalName: record.originalName,
      mimeType: record.mimeType,
      fileType: record.fileType,
      size: record.size,
    };
  } catch (err) {
    await fs.unlink(finalPath).catch(() => {});
    throw err;
  }
}

/**
 * Aborts an upload session and cleans up all uploaded parts.
 */
export async function abortChunkedUpload(uploadId: string): Promise<void> {
  await fs.rm(sessionDir(uploadId), { recursive: true, force: true }).catch(() => {});
}
