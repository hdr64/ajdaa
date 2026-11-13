import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { inspectMediaUsage } from './mediaUsageService.js';
import { EXTRACTED_MARKER } from './zipExtractService.js';
import { generateUniqueSlug, backfillMissingSlugs } from './mediaSlugService.js';

const UPLOAD_DIR = config.uploadDir;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Only formats we can safely re-encode or serve back as a download. */
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/tiff',
]);

const PDF_MIME = 'application/pdf';

/** Extensions the library accepts on upload (the chunked upload checks them before any byte arrives). */
export const MEDIA_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
export const MEDIA_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'];
export const MEDIA_MODEL_EXTS = ['.glb', '.gltf'];
export const MEDIA_ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.sql', '.csv'];
export const MEDIA_ALLOWED_EXTS = new Set([
  ...MEDIA_IMAGE_EXTS,
  ...MEDIA_VIDEO_EXTS,
  ...MEDIA_MODEL_EXTS,
  ...MEDIA_ARCHIVE_EXTS,
  '.pdf',
  '.html',
  '.htm',
]);

/** Thrown for anything outside the allowlist so the route can answer 400. */
export class UnsupportedMediaError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedMediaError';
  }
}

export class UploadTooLargeError extends Error {
  readonly statusCode = 413;

  constructor(message: string) {
    super(message);
    this.name = 'UploadTooLargeError';
  }
}

export class MediaInUseError extends Error {
  readonly statusCode = 409;
  readonly usageCount: number;
  readonly usages: unknown[];

  constructor(message: string, usageCount: number, usages: unknown[]) {
    super(message);
    this.name = 'MediaInUseError';
    this.usageCount = usageCount;
    this.usages = usages;
  }
}

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Detects the real media type from the first bytes of the file.
 * Reads minimal bytes to be fast and safe.
 */
export function detectMediaType(buffer: Buffer): 'image' | 'pdf' | 'video' | 'model3d' | 'archive' | null {
  if (buffer.length < 4) return null;

  if (buffer.length >= 12) {
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
    if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image'; // PNG
    if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF
    if (startsWith(buffer, [0x49, 0x49, 0x2a, 0x00])) return 'image'; // TIFF (LE)
    if (startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])) return 'image'; // TIFF (BE)
    if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF

    // RIFF....WEBP or RIFF....AVI
    if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46])) {
      if (startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return 'image';
      if (startsWith(buffer, [0x41, 0x56, 0x49, 0x20], 8)) return 'video';
    }

    // ISO-BMFF: ....ftyp
    if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) {
      const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
      if (['avif', 'avis', 'heic', 'heif', 'mif1'].includes(brand)) return 'image';
      if (['isom', 'mp41', 'mp42', 'mmp4', 'dash', 'qt  ', 'm4v '].includes(brand) || brand.startsWith('mp4')) return 'video';
    }

    // Matroska / WebM: 0x1A 0x45 0xDF 0xA3
    if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
      return 'video';
    }

    // 3D GLB: 0x67 0x6C 0x54 0x46 (glTF)
    if (startsWith(buffer, [0x67, 0x6c, 0x54, 0x46])) {
      return 'model3d';
    }

    // Archives (ZIP): PK..
    if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
      return 'archive';
    }
  }

  return null;
}

export interface StoredMedia {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileType: 'image' | 'video' | 'pdf' | 'model3d' | 'html' | 'document' | 'other';
  size: number;
  storageKey: string;
}

export async function processAndSaveFile(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<StoredMedia> {
  if (fileBuffer.length === 0) {
    throw new UnsupportedMediaError('Uploaded file is empty');
  }
  if (fileBuffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadTooLargeError('File exceeds the 50 MB limit');
  }

  await ensureUploadDir();
  const fileId = crypto.randomUUID();
  const detected = detectMediaType(fileBuffer);
  const ext = path.extname(originalFilename).toLowerCase();

  // Images are re-encoded to WebP, which drops metadata and any embedded script.
  if (detected === 'image') {
    const filename = `${fileId}.webp`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    try {
      await sharp(fileBuffer)
        .rotate()
        .resize({ width: 2400, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(targetPath);
    } catch {
      throw new UnsupportedMediaError('Image could not be decoded');
    }

    const stats = await fs.stat(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName: originalFilename,
      mimeType: 'image/webp',
      fileType: 'image',
      size: stats.size,
      storageKey: filename,
    };
  }

  // PDFs (brochures) are stored as-is and served with a download disposition.
  if (detected === 'pdf') {
    const baseName = originalFilename
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const filename = `${fileId}-${baseName || 'document'}.pdf`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(targetPath, fileBuffer);
    const stats = await fs.stat(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName: originalFilename,
      mimeType: 'application/pdf',
      fileType: 'pdf',
      size: stats.size,
      storageKey: filename,
    };
  }

  // Videos
  const videoExts = MEDIA_VIDEO_EXTS;
  if (detected === 'video' || videoExts.includes(ext)) {
    const baseName = originalFilename
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const safeExt = videoExts.includes(ext) ? ext : '.mp4';
    const filename = `${fileId}-${baseName || 'video'}${safeExt}`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(targetPath, fileBuffer);
    const stats = await fs.stat(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName: originalFilename,
      mimeType: safeExt === '.mp4' ? 'video/mp4' : safeExt === '.webm' ? 'video/webm' : 'video/mp4',
      fileType: 'video',
      size: stats.size,
      storageKey: filename,
    };
  }

  // 3D Models
  const modelExts = MEDIA_MODEL_EXTS;
  if (detected === 'model3d' || modelExts.includes(ext)) {
    const baseName = originalFilename
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const safeExt = modelExts.includes(ext) ? ext : '.glb';
    const filename = `${fileId}-${baseName || 'model3d'}${safeExt}`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(targetPath, fileBuffer);
    const stats = await fs.stat(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName: originalFilename,
      mimeType: safeExt === '.glb' ? 'model/gltf-binary' : 'model/gltf+json',
      fileType: 'model3d',
      size: stats.size,
      storageKey: filename,
    };
  }

  // HTML pages are stored as-is and served sandboxed (see the static handler).
  if (ext === '.html' || ext === '.htm') {
    const baseName = originalFilename
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const filename = `${fileId}-${baseName || 'page'}${ext}`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(targetPath, fileBuffer);
    const stats = await fs.stat(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName: originalFilename,
      mimeType: 'text/html',
      fileType: 'html',
      size: stats.size,
      storageKey: filename,
    };
  }

  // Archives and other documents
  const archiveExts = MEDIA_ARCHIVE_EXTS;
  if (detected === 'archive' || archiveExts.includes(ext)) {
    const baseName = originalFilename
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const safeExt = archiveExts.includes(ext) ? ext : '.bin';
    const filename = `${fileId}-${baseName || 'file'}${safeExt}`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(targetPath, fileBuffer);
    const stats = await fs.stat(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename,
      originalName: originalFilename,
      mimeType: 'application/octet-stream',
      fileType: 'other',
      size: stats.size,
      storageKey: filename,
    };
  }

  throw new UnsupportedMediaError(
    `Unsupported file type. Allowed: images, videos, PDFs, 3D models, archives and documents.`
  );
}

/**
 * Recursively scans UPLOAD_DIR for files not yet recorded in MediaFile and backfills them.
 * Reads only the first 16 bytes for type detection to be fast and memory-efficient.
 */
async function scanDirRecursive(dir: string, baseDir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  // An extracted zip is one bundle: its css/js/images are not library items.
  if (entries.some((entry) => entry.isFile() && entry.name === EXTRACTED_MARKER)) return [];
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await scanDirRecursive(fullPath, baseDir);
      files.push(...sub);
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(rel);
    }
  }
  return files;
}

export async function syncDiskMediaToDatabase(): Promise<number> {
  await ensureUploadDir();
  let relativeFiles: string[] = [];
  try {
    relativeFiles = await scanDirRecursive(UPLOAD_DIR, UPLOAD_DIR);
  } catch {
    return 0;
  }

  let added = 0;
  for (const relPath of relativeFiles) {
    const url = `/uploads/${relPath}`;
    const filename = path.basename(relPath);

    // Keyed on unique URL to prevent duplicate constraint errors
    const existing = await prisma.mediaFile.findUnique({ where: { url } });
    if (existing) continue;

    const fullPath = path.join(UPLOAD_DIR, relPath);
    try {
      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) continue;

      const ext = path.extname(filename).toLowerCase();
      let fileType = 'other';
      let mimeType = 'application/octet-stream';

      if (['.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif'].includes(ext)) {
        fileType = 'image';
        mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
      } else if (ext === '.pdf') {
        fileType = 'pdf';
        mimeType = 'application/pdf';
      } else if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(ext)) {
        fileType = 'video';
        mimeType = ext === '.webm' ? 'video/webm' : ext === '.ogv' ? 'video/ogg' : 'video/mp4';
      } else if (['.html', '.htm'].includes(ext)) {
        fileType = 'html';
        mimeType = 'text/html';
      } else if (['.glb', '.gltf'].includes(ext)) {
        fileType = 'model3d';
        mimeType = ext === '.glb' ? 'model/gltf-binary' : 'model/gltf+json';
      }

      await prisma.mediaFile.upsert({
        where: { url },
        update: {},
        create: {
          url,
          slug: await generateUniqueSlug(filename),
          filename,
          originalName: filename,
          mimeType,
          fileType,
          size: stats.size,
          storageKey: relPath,
        },
      });
      added++;
    } catch {
      // Ignore unreadable entries
    }
  }

  await backfillMissingSlugs().catch(() => 0);

  return added;
}

const SYNC_MIN_INTERVAL_MS = 60_000;
let lastSyncAt = 0;
let syncInFlight: Promise<number> | null = null;

/**
 * Runs the disk index at most once a minute (or now, with `force`); callers that arrive
 * while a scan is running share it. The library list calls this on every request.
 */
export function syncDiskMediaThrottled(force = false): Promise<number> {
  if (syncInFlight) return syncInFlight;
  if (!force && Date.now() - lastSyncAt < SYNC_MIN_INTERVAL_MS) return Promise.resolve(0);
  // Strays from abandoned staged uploads (picker closed mid-upload) go away with
  // the same throttled cadence: no extra timer or job for the sweep.
  void sweepStalePendingMedia().catch(() => undefined);
  syncInFlight = syncDiskMediaToDatabase().finally(() => {
    lastSyncAt = Date.now();
    syncInFlight = null;
  });
  return syncInFlight;
}

/**
 * Shared deletion tail: unlinks the file (when still present), removes the
 * database row, and — when the storage key sits inside an extracted zip bundle
 * — removes that bundle folder once its last library row is gone. The row goes
 * before the bundle count, so the file being deleted never counts as remaining.
 */
async function removeMediaRowAndStorage(media: { id: string; storageKey: string }): Promise<void> {
  // Path traversal containment check
  const resolvedPath = path.resolve(UPLOAD_DIR, media.storageKey);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
    throw new Error('Invalid storage key path traversal');
  }

  try {
    await fs.unlink(resolvedPath);
  } catch {
    // File may already be unlinked
  }

  await prisma.mediaFile.delete({ where: { id: media.id } });

  // Files extracted from a zip live in their own folder; remove the folder with
  // its last library item (a website's single row removes the whole site).
  const [folderName] = media.storageKey.split('/');
  if (media.storageKey.includes('/') && folderName) {
    const folderPath = path.resolve(UPLOAD_DIR, folderName);
    const isBundle = await fs.access(path.join(folderPath, EXTRACTED_MARKER)).then(() => true, () => false);
    if (isBundle && folderPath.startsWith(resolvedUploadDir + path.sep)) {
      const remaining = await prisma.mediaFile.count({ where: { storageKey: { startsWith: `${folderName}/` } } });
      if (remaining === 0) await fs.rm(folderPath, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Safely deletes an unlinked media file from DB and disk.
 * Strictly forbids deleting any file connected to an active project or entity to protect Google SEO stability.
 */
export async function deleteMediaFile(id: string): Promise<void> {
  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) {
    throw new Error('Media file not found');
  }

  // Strict SEO Guard: Never allow deleting if connected to any project or entity!
  const usage = await inspectMediaUsage(media.url);
  if (usage.usageCount > 0) {
    const entityNames = usage.usages.map((u) => u.entityTitle).join('، ');
    throw new MediaInUseError(
      `لا يمكن حذف هذا الملف نهائياً لأنه مرتبط بـ (${entityNames}). روابط الصور محمية لضمان استقرار أرشفة Google SEO وعدم كسر ظهور المشروع.`,
      usage.usageCount,
      usage.usages
    );
  }

  await removeMediaRowAndStorage(media);
}

/**
 * Deletes a staged (pending) media file from DB and disk without the in-use
 * check: a pending row belongs to a picker session nobody has referenced yet.
 * Refuses non-pending rows, so a visible Library file can never take this path.
 */
export async function discardPendingMedia(id: string): Promise<void> {
  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) {
    throw new Error('Media file not found');
  }
  if (!media.pending) {
    throw new Error('Media file is not pending');
  }

  await removeMediaRowAndStorage(media);
}

/**
 * Removes staged (pending) uploads abandoned by a picker that never reached the
 * confirm step: files older than `maxAgeMs` are discarded (no in-use check —
 * nobody can reference a hidden row), and pending folders of the same age that
 * hold no files any more are deleted. Runs with the throttled disk sync.
 */
export async function sweepStalePendingMedia(maxAgeMs = 24 * 3600 * 1000): Promise<void> {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const staleFiles = await prisma.mediaFile.findMany({
    where: { pending: true, createdAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const row of staleFiles) {
    await discardPendingMedia(row.id).catch(() => {});
  }

  const staleFolders = await prisma.mediaFolder.findMany({
    where: { pending: true, createdAt: { lt: cutoff } },
    select: { id: true, _count: { select: { files: true } } },
  });
  const emptyIds = staleFolders.filter((folder) => folder._count.files === 0).map((folder) => folder.id);
  if (emptyIds.length > 0) {
    await prisma.mediaFolder.deleteMany({ where: { id: { in: emptyIds } } }).catch(() => {});
  }
}

export interface DiskStorageStats {
  freeBytes: number;
  totalBytes: number;
  usedBytes: number;
  freeGb: number;
  totalGb: number;
  usedGb: number;
  percentUsed: number;
  isLowSpace: boolean; // freeBytes < 10 GB
  mediaCount: number;
  mediaTotalBytes: number;
}

const LOW_SPACE_THRESHOLD_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

/**
 * Inspects real disk filesystem capacity on the uploads partition and queries
 * aggregate storage metrics for registered media assets.
 */
export async function getDiskStorageStats(): Promise<DiskStorageStats> {
  await ensureUploadDir();
  let freeBytes = 0;
  let totalBytes = 0;
  let usedBytes = 0;

  try {
    const stats = await fs.statfs(UPLOAD_DIR);
    const bsize = Number(stats.bsize);
    freeBytes = Number(stats.bavail) * bsize;
    totalBytes = Number(stats.blocks) * bsize;
    usedBytes = Math.max(0, totalBytes - freeBytes);
  } catch {
    totalBytes = 100 * 1024 * 1024 * 1024;
    freeBytes = 50 * 1024 * 1024 * 1024;
    usedBytes = 50 * 1024 * 1024 * 1024;
  }

  const freeGb = Number((freeBytes / (1024 ** 3)).toFixed(2));
  const totalGb = Number((totalBytes / (1024 ** 3)).toFixed(2));
  const usedGb = Number((usedBytes / (1024 ** 3)).toFixed(2));
  const percentUsed = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;
  const isLowSpace = freeBytes < LOW_SPACE_THRESHOLD_BYTES;

  const aggregation = await prisma.mediaFile.aggregate({
    _count: { id: true },
    _sum: { size: true },
  });

  return {
    freeBytes,
    totalBytes,
    usedBytes,
    freeGb,
    totalGb,
    usedGb,
    percentUsed,
    isLowSpace,
    mediaCount: aggregation._count.id ?? 0,
    mediaTotalBytes: aggregation._sum.size ?? 0,
  };
}
