import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';

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
 * Detects the real media type from the file signature. The declared mimetype is
 * attacker-controlled, so it is only used as a hint and never as the decision.
 */
export function detectMediaType(buffer: Buffer): 'image' | 'pdf' | null {
  if (buffer.length < 12) return null;

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image'; // PNG
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF
  if (startsWith(buffer, [0x49, 0x49, 0x2a, 0x00])) return 'image'; // TIFF (LE)
  if (startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])) return 'image'; // TIFF (BE)
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF

  // RIFF....WEBP
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image';
  }

  // ISO-BMFF: ....ftypavif / ftypavis / ftypheic
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['avif', 'avis', 'heic', 'heif', 'mif1'].includes(brand)) return 'image';
  }

  return null;
}

export interface StoredMedia {
  url: string;
  filename: string;
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

  // Images are re-encoded to WebP, which drops metadata and any embedded script.
  // The detected signature decides the branch; the client's declared mimetype is
  // frequently `application/octet-stream` and is therefore never trusted.
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
      // A file can carry an image signature yet be undecodable.
      throw new UnsupportedMediaError('Image could not be decoded');
    }

    return { url: `/uploads/${filename}`, filename };
  }

  // PDFs (brochures) are stored as-is and served with a download disposition.
  if (detected === 'pdf') {
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const filename = `${fileId}-${safeName || 'document.pdf'}`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(targetPath, fileBuffer);

    return { url: `/uploads/${filename}`, filename };
  }

  throw new UnsupportedMediaError(
    `Unsupported file type. Allowed: ${[...ALLOWED_IMAGE_MIMES].join(', ')}, ${PDF_MIME}`
  );
}
