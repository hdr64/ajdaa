import { api, resolveMediaUrl } from './api';

export interface UploadedMedia {
  id?: string;
  url: string;
  slug?: string | null;
  filename: string;
  originalName?: string;
  mimeType?: string;
  fileType?: string;
  size?: number;
  /** Library folder of the item (uploads into a folder; extractions: the new folder). */
  folderId?: string | null;
  /** Set when a .zip was extracted: the folder the extraction created. */
  folderName?: string | null;
  /** Set when a .zip was extracted: every library item it produced. */
  extracted?: UploadedMedia[];
  /** Staged (picker) upload: the row is hidden from the Library until confirmed. */
  pending?: boolean;
}

export interface MediaFolderDto {
  id: string;
  name: string;
  parentId: string | null;
  /** Files directly inside the folder. */
  fileCount: number;
  createdAt: string;
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
  /** Permanent public link name: `/f/<slug>`, HTML pages at `/html/<slug>/`. */
  slug?: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  fileType: 'image' | 'video' | 'pdf' | 'model3d' | 'html' | 'document' | 'other';
  size: number;
  thumbnailUrl?: string | null;
  /** Relative disk path under the uploads directory (websites: `bundle/entry.html`). */
  storageKey?: string;
  /** Virtual library folder the file sits in; null = library root. */
  folderId?: string | null;
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

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  /** Target library folder; sent as `?folderId=` only when set, so existing calls stay byte-identical. */
  folderId?: string | null;
  /** Staged (picker) upload: sent as `?staged=1`; the row stays hidden until confirmed. */
  staged?: boolean;
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

  // Combine folderId and staged so either flag alone keeps existing calls byte-identical.
  const query = new URLSearchParams();
  if (options.folderId) query.set('folderId', options.folderId);
  if (options.staged) query.set('staged', '1');
  const qs = query.toString();

  const result = await api.upload<UploadedMedia>(
    qs ? `/api/media/upload?${qs}` : '/api/media/upload',
    formData,
    {
      signal: options.signal,
    },
  );

  return {
    id: result.id,
    url: resolveMediaUrl(result.url),
    filename: result.filename,
    originalName: result.originalName,
    mimeType: result.mimeType,
    fileType: result.fileType,
    size: result.size,
    folderId: result.folderId,
    pending: result.pending,
  };
}

/**
 * Fetches paginated media files from the media library.
 */
export async function fetchMediaList(params: {
  page?: number;
  limit?: number;
  type?: 'all' | 'image' | 'video' | 'pdf' | 'model3d' | 'html' | 'other';
  status?: 'all' | 'linked' | 'orphaned';
  search?: string;
  /** `root`, a folder id, or `all` (flat results). Omitted = today's behaviour (the picker). */
  folder?: 'all' | 'root' | string;
  /** `newest` is the server default and is not sent. */
  sort?: 'newest' | 'oldest' | 'name' | 'size';
  /** Also lists the current admin's own staged (pending) rows: `includePending=mine`. */
  includePending?: boolean;
} = {}): Promise<MediaListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.folder) query.set('folder', params.folder);
  if (params.sort && params.sort !== 'newest') query.set('sort', params.sort);
  if (params.includePending) query.set('includePending', 'mine');

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

/* -------------------------------- staged uploads ------------------------------- */

/** Everything one picker session uploaded as staged: file rows and the extraction folder. */
export interface StagedIds {
  fileIds: string[];
  folderIds: string[];
}

export const emptyStagedIds = (): StagedIds => ({ fileIds: [], folderIds: [] });

export function hasStagedIds(ids: StagedIds): boolean {
  return ids.fileIds.length > 0 || ids.folderIds.length > 0;
}

/**
 * Confirms staged rows (makes them visible). Ids that are not pending or not
 * owned by the current admin are skipped by the server; resolves to 0 on a
 * network failure so the caller can tell "nothing confirmed" from a count.
 */
export async function confirmStagedMedia(ids: StagedIds): Promise<number> {
  try {
    const res = await api.post<{ confirmed: number }>('/api/media/staged/confirm', {
      fileIds: ids.fileIds,
      folderIds: ids.folderIds,
    });
    return res.confirmed;
  } catch {
    return 0;
  }
}

/**
 * Discards staged rows (deletes row and disk file). Runs while the picker is
 * closing, so network errors are swallowed and resolve to 0.
 */
export async function discardStagedMedia(ids: StagedIds): Promise<number> {
  try {
    const res = await api.post<{ discarded: number }>('/api/media/staged/discard', {
      fileIds: ids.fileIds,
      folderIds: ids.folderIds,
    });
    return res.discarded;
  } catch {
    return 0;
  }
}

/**
 * The permanent public link of a library file (same origin as the site): `/f/<slug>`,
 * or `/html/<slug>/` for HTML pages. Falls back to the direct file URL when the
 * file has no slug yet.
 */
export function mediaPublicUrl(file: { url: string; slug?: string | null; fileType?: string }): string {
  if (!file.slug) return resolveMediaUrl(file.url);
  const path = file.fileType === 'html' ? `/html/${file.slug}/` : `/f/${file.slug}`;
  return `${window.location.origin}${path}`;
}

/** Changes a file's slug; the old public link stops working. */
export async function updateMediaSlug(id: string, slug: string): Promise<{ id: string; slug: string }> {
  return api.patch<{ id: string; slug: string }>(`/api/media/${id}`, { slug });
}

/* ------------------------------ library folders ------------------------------ */

/** Every library folder with its direct file count (not paginated). */
export async function fetchMediaFolders(): Promise<MediaFolderDto[]> {
  return (await api.get<{ folders: MediaFolderDto[] }>('/api/media/folders')).folders;
}

export async function createMediaFolder(name: string, parentId: string | null): Promise<MediaFolderDto> {
  return api.post<MediaFolderDto>('/api/media/folders', { name, parentId });
}

export async function updateMediaFolder(
  id: string,
  patch: { name?: string; parentId?: string | null }
): Promise<MediaFolderDto> {
  return api.patch<MediaFolderDto>(`/api/media/folders/${id}`, patch);
}

/** Deleting a folder never deletes files: they and the child folders move up one level. */
export async function deleteMediaFolder(
  id: string
): Promise<{ success: boolean; movedFiles: number; movedFolders: number }> {
  return api.delete<{ success: boolean; movedFiles: number; movedFolders: number }>(`/api/media/folders/${id}`);
}

/** Moves files into a folder (`folderId: null` = library root). Disk paths never change. */
export async function moveMediaFiles(ids: string[], folderId: string | null): Promise<{ moved: number }> {
  return api.post<{ moved: number }>('/api/media/move', { ids, folderId });
}

/**
 * Fetches server disk storage statistics and available space.
 */
export async function fetchStorageStats(): Promise<DiskStorageStats> {
  return api.get<DiskStorageStats>('/api/media/storage-stats');
}
