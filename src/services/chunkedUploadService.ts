import { api, resolveMediaUrl } from './api';
import type { UploadedMedia } from './mediaService';

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

export interface ChunkProgress {
  uploadId: string;
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  speed?: string;
  remainingSeconds?: number;
}

export interface ChunkedUploadOptions {
  chunkSize?: number;
  onProgress?: (progress: ChunkProgress) => void;
  signal?: AbortSignal;
}

export async function uploadFileInChunks(
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<UploadedMedia> {
  const chunkSize = options.chunkSize || CHUNK_SIZE;
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / chunkSize) || 1;

  // 1. Initialize session
  const initRes = await api.post<{ uploadId: string; chunkSize: number; totalChunks: number }>(
    '/api/media/upload/chunked/init',
    {
      filename: file.name,
      totalSize,
      totalChunks,
      chunkSize,
      mimeType: file.type || undefined,
    },
    { signal: options.signal }
  );

  const { uploadId } = initRes;

  // 2. Check existing chunks for resumption
  let alreadyUploadedChunks: Set<number> = new Set();
  try {
    const status = await api.get<{ uploadedChunks: number[] }>(
      `/api/media/upload/chunked/status/${uploadId}`,
      { signal: options.signal }
    );
    alreadyUploadedChunks = new Set(status.uploadedChunks);
  } catch {
    // start from 0
  }

  let totalUploadedBytes = 0;
  for (const idx of alreadyUploadedChunks) {
    const start = idx * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    totalUploadedBytes += end - start;
  }

  const startTime = Date.now();
  let lastTime = startTime;
  let lastBytes = totalUploadedBytes;

  // Report initial progress
  if (options.onProgress) {
    const percent = Math.min(100, Math.round((totalUploadedBytes / totalSize) * 100));
    options.onProgress({
      uploadId,
      uploadedBytes: totalUploadedBytes,
      totalBytes: totalSize,
      percent,
    });
  }

  // 3. Upload missing chunks
  for (let i = 0; i < totalChunks; i++) {
    if (options.signal?.aborted) {
      throw new Error('Upload aborted');
    }

    if (alreadyUploadedChunks.has(i)) {
      continue;
    }

    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunkBlob = file.slice(start, end);
    const chunkFile = new File([chunkBlob], `part_${i}`, { type: 'application/octet-stream' });

    const formData = new FormData();
    formData.append('file', chunkFile);

    await api.upload<{ receivedChunk: number }>(
      `/api/media/upload/chunked/chunk?uploadId=${uploadId}&chunkIndex=${i}`,
      formData,
      { signal: options.signal }
    );

    totalUploadedBytes += chunkBlob.size;

    // Calculate speed and progress
    const now = Date.now();
    const elapsedSec = (now - lastTime) / 1000;
    let speedStr = '';
    let remainingSec: number | undefined;

    if (elapsedSec >= 0.5) {
      const bytesDiff = totalUploadedBytes - lastBytes;
      const speedBps = bytesDiff / elapsedSec;
      const speedMBps = speedBps / (1024 * 1024);
      speedStr = speedMBps >= 1 ? `${speedMBps.toFixed(1)} MB/s` : `${Math.round(speedBps / 1024)} KB/s`;

      const remainingBytes = totalSize - totalUploadedBytes;
      if (speedBps > 0) {
        remainingSec = Math.round(remainingBytes / speedBps);
      }

      lastTime = now;
      lastBytes = totalUploadedBytes;
    }

    if (options.onProgress) {
      const percent = Math.min(100, Math.round((totalUploadedBytes / totalSize) * 100));
      options.onProgress({
        uploadId,
        uploadedBytes: totalUploadedBytes,
        totalBytes: totalSize,
        percent,
        speed: speedStr,
        remainingSeconds: remainingSec,
      });
    }
  }

  // 4. Complete session
  const completeRes = await api.post<UploadedMedia>(
    '/api/media/upload/chunked/complete',
    { uploadId },
    { signal: options.signal }
  );

  if (options.onProgress) {
    options.onProgress({
      uploadId,
      uploadedBytes: totalSize,
      totalBytes: totalSize,
      percent: 100,
    });
  }

  return {
    ...completeRes,
    url: resolveMediaUrl(completeRes.url),
  };
}

export async function abortChunkedUpload(uploadId: string): Promise<void> {
  await api.delete(`/api/media/upload/chunked/abort/${uploadId}`).catch(() => {});
}

