import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { prisma } from './prisma.js';

const UPLOAD_DIR = config.uploadDir;
const CHUNK_DIR = path.join(UPLOAD_DIR, '.chunks');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChunkedMeta {
  uploadId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  mimeType?: string;
  createdById?: string;
  createdAt: string;
}

async function ensureChunkDir(): Promise<void> {
  try {
    await fs.access(CHUNK_DIR);
  } catch {
    await fs.mkdir(CHUNK_DIR, { recursive: true });
  }
}

function validateUploadId(uploadId: string): void {
  if (!uploadId || !UUID_REGEX.test(uploadId)) {
    throw new Error('Invalid upload ID');
  }
}

/**
 * Initializes a chunked upload session and creates a temporary folder for chunks.
 */
export async function initChunkedUpload(params: {
  filename: string;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  mimeType?: string;
  adminId?: string;
}): Promise<{ uploadId: string; chunkSize: number; totalChunks: number }> {
  await ensureChunkDir();

  const uploadId = crypto.randomUUID();
  const sessionDir = path.join(CHUNK_DIR, uploadId);
  await fs.mkdir(sessionDir, { recursive: true });

  const meta: ChunkedMeta = {
    uploadId,
    filename: params.filename.slice(0, 255),
    totalSize: params.totalSize,
    totalChunks: params.totalChunks,
    chunkSize: params.chunkSize,
    mimeType: params.mimeType,
    createdById: params.adminId,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(sessionDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  return {
    uploadId,
    chunkSize: params.chunkSize,
    totalChunks: params.totalChunks,
  };
}

/**
 * Saves one chunk into the upload session directory.
 */
export async function saveUploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunkBuffer: Buffer
): Promise<{ receivedChunk: number }> {
  validateUploadId(uploadId);

  const sessionDir = path.join(CHUNK_DIR, uploadId);
  const metaPath = path.join(sessionDir, 'meta.json');

  try {
    await fs.access(metaPath);
  } catch {
    throw new Error('Upload session not found or expired');
  }

  const chunkPath = path.join(sessionDir, `part_${chunkIndex}`);
  await fs.writeFile(chunkPath, chunkBuffer);

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
  validateUploadId(uploadId);

  const sessionDir = path.join(CHUNK_DIR, uploadId);
  const metaPath = path.join(sessionDir, 'meta.json');

  const metaRaw = await fs.readFile(metaPath, 'utf8');
  const meta: ChunkedMeta = JSON.parse(metaRaw);

  const entries = await fs.readdir(sessionDir);
  const uploadedChunks: number[] = [];

  for (const entry of entries) {
    if (entry.startsWith('part_')) {
      const idx = parseInt(entry.replace('part_', ''), 10);
      if (!Number.isNaN(idx)) {
        uploadedChunks.push(idx);
      }
    }
  }

  uploadedChunks.sort((a, b) => a - b);

  return {
    uploadId,
    uploadedChunks,
    totalChunks: meta.totalChunks,
    totalSize: meta.totalSize,
    filename: meta.filename,
  };
}

function resolveFileTypeAndMime(
  filename: string,
  providedMime?: string
): { fileType: string; mimeType: string } {
  const ext = path.extname(filename).toLowerCase();

  const videoExts = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'];
  const imageExts = ['.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif', '.svg'];
  const modelExts = ['.glb', '.gltf'];

  if (videoExts.includes(ext) || providedMime?.startsWith('video/')) {
    const mime = ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : providedMime || 'video/mp4';
    return { fileType: 'video', mimeType: mime };
  }

  if (ext === '.pdf' || providedMime === 'application/pdf') {
    return { fileType: 'pdf', mimeType: 'application/pdf' };
  }

  if (imageExts.includes(ext) || providedMime?.startsWith('image/')) {
    const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : providedMime || 'image/jpeg';
    return { fileType: 'image', mimeType: mime };
  }

  if (modelExts.includes(ext)) {
    return { fileType: 'model3d', mimeType: ext === '.glb' ? 'model/gltf-binary' : 'model/gltf+json' };
  }

  return { fileType: 'other', mimeType: providedMime || 'application/octet-stream' };
}

/**
 * Combines all chunk parts into the final media file, removes temporary chunks,
 * and registers the file in the database.
 */
export async function completeChunkedUpload(
  uploadId: string,
  adminId?: string
) {
  validateUploadId(uploadId);

  const sessionDir = path.join(CHUNK_DIR, uploadId);
  const metaPath = path.join(sessionDir, 'meta.json');

  const metaRaw = await fs.readFile(metaPath, 'utf8');
  const meta: ChunkedMeta = JSON.parse(metaRaw);

  // Verify all chunks exist
  for (let i = 0; i < meta.totalChunks; i++) {
    const chunkPath = path.join(sessionDir, `part_${i}`);
    try {
      await fs.access(chunkPath);
    } catch {
      throw new Error(`Missing chunk part_${i}`);
    }
  }

  const ext = path.extname(meta.filename).toLowerCase();
  const safeBase = meta.filename
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);

  const finalFilename = `${uploadId}-${safeBase || 'media'}${ext}`;
  const finalPath = path.join(UPLOAD_DIR, finalFilename);

  // Write stream to concatenate all chunks sequentially
  const writeStream = fsSync.createWriteStream(finalPath);
  for (let i = 0; i < meta.totalChunks; i++) {
    const chunkPath = path.join(sessionDir, `part_${i}`);
    const chunkBuf = await fs.readFile(chunkPath);
    writeStream.write(chunkBuf);
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  const stats = await fs.stat(finalPath);
  const { fileType, mimeType } = resolveFileTypeAndMime(meta.filename, meta.mimeType);

  // Clean up session chunks directory
  await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});

  const record = await prisma.mediaFile.create({
    data: {
      url: `/uploads/${finalFilename}`,
      filename: finalFilename,
      originalName: meta.filename,
      mimeType,
      fileType,
      size: stats.size,
      storageKey: finalFilename,
      createdById: adminId || meta.createdById,
    },
  });

  return {
    id: record.id,
    url: record.url,
    filename: record.filename,
    originalName: record.originalName,
    mimeType: record.mimeType,
    fileType: record.fileType,
    size: record.size,
  };
}

/**
 * Aborts an upload session and cleans up all uploaded parts.
 */
export async function abortChunkedUpload(uploadId: string): Promise<void> {
  validateUploadId(uploadId);
  const sessionDir = path.join(CHUNK_DIR, uploadId);
  await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
}
