import { api, resolveMediaUrl } from './api';

export interface UploadedMedia {
  url: string;
  filename: string;
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf'];

/** Shared with the server-side limit so the UI can reject oversized files before uploading. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isAcceptedMedia(file: File): boolean {
  return [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOCUMENT_TYPES].includes(file.type);
}

/**
 * Uploads one image or PDF. Images are converted to WebP server-side, so the
 * returned URL is what must be persisted on the project record.
 */
export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<UploadedMedia> {
  if (!isAcceptedMedia(file)) {
    throw new Error('Unsupported file type. Upload an image (JPG, PNG, WebP, AVIF, GIF) or a PDF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is larger than the 50 MB limit.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const result = await api.upload<UploadedMedia>('/api/media/upload', formData, {
    signal: options.signal,
  });

  return { url: resolveMediaUrl(result.url), filename: result.filename };
}
