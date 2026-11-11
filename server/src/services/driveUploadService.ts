import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import {
  DRIVE_DIR,
  DRIVE_MAX_FILE_BYTES,
  DriveError,
  cleanName,
  driveFilePath,
  ensureDriveDir,
  ensureFolderPath,
  newStorageKey,
  registerUploadedFile,
  requireLiveFolder,
} from './driveService.js';

/**
 * Resumable chunked upload for the Drive (files up to `DRIVE_MAX_FILE_BYTES`, 5 GB).
 *
 * Chunks are stored as `PRIVATE_DIR/drive/.chunks/<uploadId>/part_<n>`. On complete they are
 * appended to the final file one by one and each part is deleted right after, so the disk
 * needs about one file size plus one chunk, and memory stays flat whatever the file size.
 */

const CHUNK_DIR = path.join(DRIVE_DIR, '.chunks');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STALE_MS = 24 * 60 * 60 * 1000;
export const MIN_CHUNK_BYTES = 256 * 1024;
export const MAX_CHUNK_BYTES = 50 * 1024 * 1024;
const MAX_CHUNKS = 20_000;

interface Meta {
  uploadId: string;
  /** The path as the user picked it: `a.pdf` or `Photos/2024/a.jpg`. */
  relPath: string;
  folderId: string | null;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  createdById?: string;
  createdAt: string;
}

function sessionDir(uploadId: string): string {
  if (!UUID.test(uploadId)) throw new DriveError('Invalid upload ID', 400);
  return path.join(CHUNK_DIR, uploadId);
}

async function readMeta(uploadId: string): Promise<Meta> {
  try {
    return JSON.parse(await fs.readFile(path.join(sessionDir(uploadId), 'meta.json'), 'utf8')) as Meta;
  } catch (err) {
    if (err instanceof DriveError) throw err;
    throw new DriveError('Upload session not found or expired', 404);
  }
}

/** Expected byte length of chunk `index`: every chunk is `chunkSize` except a shorter last one. */
function expectedChunkSize(meta: Meta, index: number): number {
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

function splitPath(relPath: string): { folders: string[]; fileName: string } {
  const segments = relPath.split('/').filter((s) => s !== '');
  if (segments.length === 0) throw new DriveError('Invalid file name', 400);
  return { folders: segments.slice(0, -1).map(cleanName), fileName: cleanName(segments[segments.length - 1]) };
}

export async function initDriveUpload(params: {
  relPath: string;
  folderId: string | null;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  adminId?: string;
}): Promise<{ uploadId: string; chunkSize: number; totalChunks: number }> {
  if (params.totalSize > DRIVE_MAX_FILE_BYTES) {
    throw new DriveError(`File exceeds the ${Math.round(DRIVE_MAX_FILE_BYTES / 1024 ** 3)} GB limit`, 413);
  }
  if (params.chunkSize < MIN_CHUNK_BYTES || params.chunkSize > MAX_CHUNK_BYTES) {
    throw new DriveError('Invalid chunk size', 400);
  }
  if (params.totalChunks > MAX_CHUNKS || params.totalChunks !== Math.max(1, Math.ceil(params.totalSize / params.chunkSize))) {
    throw new DriveError('Chunk count does not match the file size', 400);
  }
  splitPath(params.relPath); // validates every name now, not after gigabytes arrived
  await requireLiveFolder(params.folderId);

  await ensureDriveDir();
  const free = await fs.statfs(DRIVE_DIR).catch(() => null);
  if (free && Number(free.bavail) * Number(free.bsize) < params.totalSize + MAX_CHUNK_BYTES) {
    throw new DriveError('Insufficient storage', 507);
  }

  await fs.mkdir(CHUNK_DIR, { recursive: true });
  void removeStaleSessions();

  const uploadId = crypto.randomUUID();
  const dir = sessionDir(uploadId);
  await fs.mkdir(dir, { recursive: true });
  const meta: Meta = {
    uploadId,
    relPath: params.relPath,
    folderId: params.folderId,
    totalSize: params.totalSize,
    totalChunks: params.totalChunks,
    chunkSize: params.chunkSize,
    createdById: params.adminId,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta), 'utf8');
  return { uploadId, chunkSize: params.chunkSize, totalChunks: params.totalChunks };
}

export async function saveDriveChunk(uploadId: string, index: number, data: Buffer): Promise<void> {
  const meta = await readMeta(uploadId);
  if (!Number.isInteger(index) || index < 0 || index >= meta.totalChunks) throw new DriveError('Invalid chunk index', 400);
  if (data.length !== expectedChunkSize(meta, index)) throw new DriveError('Chunk has an unexpected size', 400);
  const dir = sessionDir(uploadId);
  const tmp = path.join(dir, `tmp_${index}`);
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, path.join(dir, `part_${index}`)); // a half-written part never counts as received
}

export async function driveUploadStatus(uploadId: string): Promise<{ uploadedChunks: number[]; totalChunks: number; totalSize: number }> {
  const meta = await readMeta(uploadId);
  const names = await fs.readdir(sessionDir(uploadId));
  const uploadedChunks = names
    .filter((n) => /^part_\d+$/.test(n))
    .map((n) => Number(n.slice(5)))
    .sort((a, b) => a - b);
  return { uploadedChunks, totalChunks: meta.totalChunks, totalSize: meta.totalSize };
}

export async function completeDriveUpload(uploadId: string, adminId?: string) {
  const meta = await readMeta(uploadId);
  const dir = sessionDir(uploadId);
  const { folders, fileName } = splitPath(meta.relPath);

  for (let i = 0; i < meta.totalChunks; i++) {
    const stat = await fs.stat(path.join(dir, `part_${i}`)).catch(() => null);
    if (!stat) throw new DriveError(`Missing chunk ${i}`, 400);
  }
  await requireLiveFolder(meta.folderId);

  const storageKey = newStorageKey(fileName);
  const target = driveFilePath(storageKey);
  try {
    const out = createWriteStream(target);
    try {
      for (let i = 0; i < meta.totalChunks; i++) {
        const part = path.join(dir, `part_${i}`);
        await pipeline(createReadStream(part), out, { end: false });
        await fs.unlink(part);
      }
    } finally {
      await new Promise<void>((resolve) => out.end(resolve));
    }
    const size = (await fs.stat(target)).size;
    if (size !== meta.totalSize) throw new DriveError('Assembled file has the wrong size', 400);

    const folderId = await ensureFolderPath(meta.folderId, folders, adminId ?? meta.createdById);
    const file = await registerUploadedFile({ name: fileName, folderId, storageKey, size, adminId: adminId ?? meta.createdById });
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    return file;
  } catch (err) {
    await fs.unlink(target).catch(() => undefined);
    throw err;
  }
}

export async function abortDriveUpload(uploadId: string): Promise<void> {
  await fs.rm(sessionDir(uploadId), { recursive: true, force: true }).catch(() => undefined);
}
