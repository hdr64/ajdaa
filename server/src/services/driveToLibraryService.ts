import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { generateUniqueSlug } from './mediaSlugService.js';
import { MEDIA_ALLOWED_EXTS } from './mediaService.js';
import { resolveFileTypeAndMime, MediaUploadError } from './chunkedUploadService.js';
import { DriveError, driveFilePath } from './driveService.js';

/** MediaFile.size is a 32-bit Int; larger files cannot be registered in the library. */
const LIBRARY_MAX_BYTES = 2_000_000_000;

/**
 * Publishes a Drive file into the media library: the bytes are copied (the Drive file stays
 * private and untouched) and a `MediaFile` row is created, so the file gets a public
 * `/uploads/...` URL and a `/f/<slug>` link and can be used by projects and the CMS.
 */
export async function publishDriveFileToLibrary(driveFileId: string, adminId?: string) {
  const file = await prisma.driveFile.findFirst({ where: { id: driveFileId, trashedAt: null } });
  if (!file) throw new DriveError('File not found', 404);

  const ext = path.extname(file.name).toLowerCase();
  if (!MEDIA_ALLOWED_EXTS.has(ext)) throw new MediaUploadError('Unsupported file type', 400);
  const size = Number(file.size);
  if (size > LIBRARY_MAX_BYTES) throw new MediaUploadError('File is too large for the media library', 413);

  const safeBase = file.name
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  const filename = `${crypto.randomUUID()}-${safeBase || 'media'}${ext}`;
  const target = path.join(config.uploadDir, filename);

  await fs.mkdir(config.uploadDir, { recursive: true });
  try {
    await fs.copyFile(driveFilePath(file.storageKey), target);
  } catch (err) {
    await fs.unlink(target).catch(() => {});
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new DriveError('File data is missing on disk', 404);
    throw err;
  }

  const { fileType, mimeType } = resolveFileTypeAndMime(file.name);
  try {
    const record = await prisma.mediaFile.create({
      data: {
        url: `/uploads/${filename}`,
        slug: await generateUniqueSlug(file.name),
        filename,
        originalName: file.name,
        mimeType,
        fileType,
        size,
        storageKey: filename,
        createdById: adminId,
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
    await fs.unlink(target).catch(() => {});
    throw err;
  }
}
