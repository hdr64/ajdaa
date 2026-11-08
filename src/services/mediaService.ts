import { api, resolveMediaUrl } from './api';

export interface UploadedMedia {
  id?: string;
  url: string;
  filename: string;
  originalName?: string;
  mimeType?: string;
  fileType?: string;
  size?: number;
}

export interface MediaUsageDetail {
  entityType: string;
  entityId: string | number;
  entityTitle: string;
  field: string;
}

export interface MediaFileDto {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileType: 'image' | 'video' | 'pdf' | 'model3d' | 'document' | 'other';
  size: number;
  thumbnailUrl?: string | null;
  usageCount: number;
  usages: MediaUsageDetail[];
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface MediaListResponse {
  items: MediaFileDto[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MediaUsageResponse {
  mediaId?: string;
  url: string;
  filename: string;
  usageCount: number;
  usages: MediaUsageDetail[];
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const ACCEPTED_DOCUMENT_TYPES = ['application/pdf'];

/** Shared with the server-side limit so the UI can reject oversized files before uploading. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isAcceptedMedia(file: File): boolean {
  if (!file || file.size === 0) return false;
  return true;
}

/**
 * Compresses oversized raster images in-browser before upload to minimize network usage
 * and speed up uploads ("upload less data as possible").
 */
async function compressImageBeforeUpload(file: File): Promise<File> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml' ||
    file.size <= 400 * 1024
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 2048;
    let { width, height } = bitmap;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.82);
    });

    if (blob && blob.size < file.size) {
      const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
      return new File([blob], newName, { type: 'image/webp', lastModified: Date.now() });
    }
    return file;
  } catch {
    return file;
  }
}

/**
 * Uploads one image or PDF. Images are optimized before upload and converted
 * to WebP server-side, so the returned URL is what must be persisted on the project record.
 */
export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<UploadedMedia> {
  if (!isAcceptedMedia(file)) {
    throw new Error('Unsupported file type. Upload an image (JPG, PNG, WebP, AVIF, GIF) or a PDF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is larger than the 50 MB limit.');
  }

  const fileToUpload = await compressImageBeforeUpload(file);
  const formData = new FormData();
  formData.append('file', fileToUpload);

  const result = await api.upload<UploadedMedia>('/api/media/upload', formData, {
    signal: options.signal,
  });

  return {
    id: result.id,
    url: resolveMediaUrl(result.url),
    filename: result.filename,
    originalName: result.originalName,
    mimeType: result.mimeType,
    fileType: result.fileType,
    size: result.size,
  };
}

/**
 * Fetches paginated media files from the media library.
 */
export async function fetchMediaList(params: {
  page?: number;
  limit?: number;
  type?: 'all' | 'image' | 'video' | 'pdf' | 'model3d' | 'other';
  status?: 'all' | 'linked' | 'orphaned';
  search?: string;
} = {}): Promise<MediaListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.search?.trim()) query.set('search', params.search.trim());

  const qs = query.toString();
  const endpoint = `/api/media${qs ? `?${qs}` : ''}`;
  return api.get<MediaListResponse>(endpoint);
}

/**
 * Queries usage information for a specific media URL.
 */
export async function fetchMediaUsage(url: string): Promise<MediaUsageResponse> {
  return api.get<MediaUsageResponse>(`/api/media/usage?url=${encodeURIComponent(url)}`);
}

/**
 * Deletes an unlinked media file. Fails if the file is connected to any project.
 */
export async function deleteMediaItem(id: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/api/media/${id}`);
}
