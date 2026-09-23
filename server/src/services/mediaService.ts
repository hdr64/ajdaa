import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';

const UPLOAD_DIR = config.uploadDir;

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function processAndSaveFile(
  fileBuffer: Buffer,
  originalFilename: string,
  mimetype: string
): Promise<{ url: string; filename: string }> {
  await ensureUploadDir();
  const fileId = crypto.randomUUID();

  // If image, optimize and convert to WebP
  if (mimetype.startsWith('image/')) {
    const filename = `${fileId}.webp`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await sharp(fileBuffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(targetPath);

    return {
      url: `/uploads/${filename}`,
      filename
    };
  }

  // Otherwise (PDF brochures, docs), save directly
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${fileId}-${safeName}`;
  const targetPath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(targetPath, fileBuffer);

  return {
    url: `/uploads/${filename}`,
    filename
  };
}
