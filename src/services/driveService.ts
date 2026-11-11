import { ApiError, api, getAuthToken, resolveMediaUrl } from './api';
import type { UploadedMedia } from './mediaService';

/** Client for the admin Drive (`/api/drive`): private files, virtual folders, trash, share links. */

export type DriveKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

export interface DriveFolder {
  id: string;
  name: string;
  parentId: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriveFile {
  id: string;
  name: string;
  folderId: string | null;
  slug: string;
  mimeType: string;
  kind: DriveKind;
  size: number;
  isPublic: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriveListing {
  folder: { id: string; name: string } | null;
  breadcrumbs: { id: string; name: string }[];
  folders: DriveFolder[];
  files: DriveFile[];
}

export interface DriveFolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface DriveUsage {
  fileCount: number;
  totalBytes: number;
  trashedBytes: number;
}

export interface DriveItemIds {
  folderIds: string[];
  fileIds: string[];
}

/** Largest file the Drive accepts (matches the server). */
export const DRIVE_MAX_FILE_BYTES = 5 * 1024 ** 3;
/** Files up to this size go in one request; bigger ones are sent in resumable chunks. */
const SIMPLE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const CHUNK_BYTES = 8 * 1024 * 1024;
const CHUNK_RETRIES = 4;
/** Joining 5 GB of parts on the server takes a while. */
const COMPLETE_TIMEOUT_MS = 15 * 60 * 1000;

export function fetchDriveList(params: { view?: 'files' | 'trash' | 'search'; folderId?: string | null; q?: string }): Promise<DriveListing> {
  return api.get<DriveListing>('/api/drive/list', {
    query: { view: params.view ?? 'files', folderId: params.folderId ?? undefined, q: params.q },
  });
}

export async function fetchDriveFolders(): Promise<DriveFolderNode[]> {
  return (await api.get<{ folders: DriveFolderNode[] }>('/api/drive/folders')).folders;
}

export const fetchDriveUsage = () => api.get<DriveUsage>('/api/drive/usage');

export const createDriveFolder = (name: string, parentId: string | null) =>
  api.post<DriveFolder>('/api/drive/folders', { name, parentId });

export const updateDriveFolder = (id: string, patch: { name?: string; parentId?: string | null }) =>
  api.patch<DriveFolder>(`/api/drive/folders/${id}`, patch);

export const copyDriveFolder = (id: string, parentId: string | null) =>
  api.post<DriveFolder>(`/api/drive/folders/${id}/copy`, { parentId });

export const updateDriveFile = (id: string, patch: { name?: string; isPublic?: boolean; slug?: string }) =>
  api.patch<DriveFile>(`/api/drive/files/${id}`, patch);

export const copyDriveFile = (id: string, folderId: string | null) =>
  api.post<DriveFile>(`/api/drive/files/${id}/copy`, { folderId });

/** Publishes a copy of a Drive file into the public media library; the Drive file stays private. */
export const publishDriveFileToLibrary = (id: string) =>
  api.post<UploadedMedia>(`/api/drive/files/${id}/to-library`, {});

export const moveDriveItems = (items: DriveItemIds, targetId: string | null) =>
  api.post<{ success: boolean }>('/api/drive/move', { ...items, targetId });

export const trashDriveItems = (items: DriveItemIds) => api.post<{ success: boolean }>('/api/drive/trash', items);
export const restoreDriveItems = (items: DriveItemIds) => api.post<{ success: boolean }>('/api/drive/restore', items);
export const purgeDriveItems = (items: DriveItemIds) => api.post<{ success: boolean; deleted: number }>('/api/drive/purge', items);
export const emptyDriveTrash = () => api.post<{ success: boolean; deleted: number }>('/api/drive/trash/empty');

export interface DriveUploadOptions {
  folderId: string | null;
  /** Path below `folderId` (folder uploads), e.g. `Photos/2024/a.jpg`. Defaults to the file name. */
  relPath?: string;
  signal?: AbortSignal;
  /** Called with 0-100 while a chunked (large) upload runs. */
  onProgress?: (percent: number) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Uploads one file: small files in a single request, anything over 50 MB in resumable
 * chunks (up to 5 GB). A failed chunk is retried with a growing pause before the
 * upload gives up; chunks the server already has are skipped.
 */
export async function uploadDriveFile(file: File, opts: DriveUploadOptions): Promise<DriveFile> {
  if (file.size <= SIMPLE_UPLOAD_MAX_BYTES) {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload<DriveFile>('/api/drive/upload', formData, {
      signal: opts.signal,
      query: { folderId: opts.folderId ?? undefined, relPath: opts.relPath },
    });
  }

  const totalChunks = Math.ceil(file.size / CHUNK_BYTES);
  const { uploadId } = await api.post<{ uploadId: string }>(
    '/api/drive/upload/chunked/init',
    { relPath: opts.relPath ?? file.name, folderId: opts.folderId, totalSize: file.size, totalChunks, chunkSize: CHUNK_BYTES },
    { signal: opts.signal }
  );

  const done = new Set<number>();
  try {
    const status = await api.get<{ uploadedChunks: number[] }>(`/api/drive/upload/chunked/status/${uploadId}`, { signal: opts.signal });
    status.uploadedChunks.forEach((i) => done.add(i));
  } catch {
    // a fresh session has nothing yet
  }

  try {
    for (let i = 0; i < totalChunks; i++) {
      if (done.has(i)) continue;
      const blob = file.slice(i * CHUNK_BYTES, Math.min((i + 1) * CHUNK_BYTES, file.size));
      for (let attempt = 1; ; attempt++) {
        if (opts.signal?.aborted) throw new Error('Upload aborted');
        try {
          const formData = new FormData();
          formData.append('file', new File([blob], `part_${i}`, { type: 'application/octet-stream' }));
          await api.upload('/api/drive/upload/chunked/chunk', formData, { signal: opts.signal, query: { uploadId, chunkIndex: i } });
          break;
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          // Only network trouble and server hiccups are worth retrying; a 4xx will not get better.
          const retryable = status === 0 || status === 408 || status >= 500;
          if (!retryable || attempt >= CHUNK_RETRIES || opts.signal?.aborted) throw err;
          await sleep(1000 * 2 ** (attempt - 1));
        }
      }
      done.add(i);
      opts.onProgress?.(Math.min(99, Math.floor((done.size / totalChunks) * 100)));
    }
    const created = await api.post<DriveFile>('/api/drive/upload/chunked/complete', { uploadId }, { signal: opts.signal, timeoutMs: COMPLETE_TIMEOUT_MS });
    opts.onProgress?.(100);
    return created;
  } catch (err) {
    // The session is useless after an abort or a hard failure; free its chunks on the server.
    void api.delete(`/api/drive/upload/chunked/abort/${uploadId}`).catch(() => undefined);
    throw err;
  }
}

/** The permanent share link. It only opens while the file is shared. */
export function driveShareUrl(file: Pick<DriveFile, 'slug'>): string {
  return `${window.location.origin}/d/${file.slug}`;
}

async function fetchDriveBlob(id: string, inline: boolean): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(resolveMediaUrl(`/api/drive/files/${id}/download${inline ? '?inline=1' : ''}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  return response.blob();
}

/** Saves a file through the browser's download flow. */
export async function downloadDriveFile(file: Pick<DriveFile, 'id' | 'name'>): Promise<void> {
  const blob = await fetchDriveBlob(file.id, false);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A blob URL for previewing a safe type in the admin. The caller revokes it. */
export async function driveBlobUrl(file: Pick<DriveFile, 'id'>): Promise<string> {
  return URL.createObjectURL(await fetchDriveBlob(file.id, true));
}

/** Kinds the admin can preview in place (small enough to load as a blob). */
export const DRIVE_PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
export function canPreviewDriveFile(file: Pick<DriveFile, 'kind' | 'size'>): boolean {
  return (file.kind === 'image' || file.kind === 'pdf') && file.size <= DRIVE_PREVIEW_MAX_BYTES;
}
