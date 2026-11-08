import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { uploadFileInChunks, abortChunkedUpload } from '../services/chunkedUploadService';
import { uploadMedia, type UploadedMedia } from '../services/mediaService';

export interface ManagedUpload {
  id: string;
  file: File;
  progress: number; // 0 - 100
  uploadedBytes: number;
  totalBytes: number;
  speed?: string;
  remainingSeconds?: number;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  result?: UploadedMedia;
  uploadId?: string;
  abortController?: AbortController;
}

interface UploadManagerContextValue {
  uploads: ManagedUpload[];
  isUploading: boolean;
  activeCount: number;
  completedCount: number;
  overallProgress: number;
  uploadFiles: (files: File[]) => Promise<UploadedMedia[]>;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  clearCompleted: () => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

export const useUploadManager = (): UploadManagerContextValue => {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) {
    throw new Error('useUploadManager must be used within an UploadManagerProvider');
  }
  return ctx;
};

export const UploadManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<ManagedUpload[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Keep a map of active controllers
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const activeCount = useMemo(
    () => uploads.filter((u) => u.status === 'uploading' || u.status === 'queued').length,
    [uploads]
  );

  const completedCount = useMemo(
    () => uploads.filter((u) => u.status === 'completed').length,
    [uploads]
  );

  const isUploading = activeCount > 0;

  const overallProgress = useMemo(() => {
    const active = uploads.filter((u) => u.status === 'uploading' || u.status === 'queued' || u.status === 'completed');
    if (active.length === 0) return 0;
    const totalBytes = active.reduce((acc, u) => acc + u.totalBytes, 0);
    if (totalBytes === 0) return 100;
    const uploadedBytes = active.reduce((acc, u) => acc + (u.status === 'completed' ? u.totalBytes : u.uploadedBytes), 0);
    return Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));
  }, [uploads]);

  const runUploadItem = useCallback(async (item: ManagedUpload): Promise<UploadedMedia> => {
    const controller = new AbortController();
    controllersRef.current.set(item.id, controller);

    setUploads((prev) =>
      prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading', error: undefined } : u))
    );

    try {
      let result: UploadedMedia;

      // For files >= 5MB or non-image types: use resumable chunked upload
      if (item.file.size >= 5 * 1024 * 1024 || !item.file.type.startsWith('image/')) {
        result = await uploadFileInChunks(item.file, {
          signal: controller.signal,
          onProgress: (prog) => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === item.id
                  ? {
                      ...u,
                      progress: prog.percent,
                      uploadedBytes: prog.uploadedBytes,
                      speed: prog.speed,
                      remainingSeconds: prog.remainingSeconds,
                      uploadId: prog.uploadId,
                    }
                  : u
              )
            );
          },
        });
      } else {
        // Small image direct upload with artificial smooth progress
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, progress: 50, uploadedBytes: Math.floor(u.totalBytes / 2) } : u))
        );
        result = await uploadMedia(item.file, { signal: controller.signal });
      }

      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? {
                ...u,
                status: 'completed',
                progress: 100,
                uploadedBytes: u.totalBytes,
                speed: undefined,
                result,
              }
            : u
        )
      );

      return result;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        // Paused or cancelled
        throw err;
      }
      const msg = err instanceof Error ? err.message : 'فشل الرفع';
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'error', error: msg, speed: undefined } : u))
      );
      throw err;
    } finally {
      controllersRef.current.delete(item.id);
    }
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadedMedia[]> => {
      if (!files.length) return [];

      const newItems: ManagedUpload[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        status: 'queued',
      }));

      setUploads((prev) => [...prev, ...newItems]);
      setIsDrawerOpen(true);

      const results = await Promise.allSettled(newItems.map((item) => runUploadItem(item)));
      return results
        .filter((r): r is PromiseFulfilledResult<UploadedMedia> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    [runUploadItem]
  );

  const pauseUpload = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: 'paused', speed: undefined } : u))
    );
  }, []);

  const resumeUpload = useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item) {
        void runUploadItem(item);
      }
    },
    [uploads, runUploadItem]
  );

  const cancelUpload = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }
    const item = uploads.find((u) => u.id === id);
    if (item?.uploadId) {
      void abortChunkedUpload(item.uploadId);
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, [uploads]);

  const retryUpload = useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item) {
        void runUploadItem(item);
      }
    },
    [uploads, runUploadItem]
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const value = useMemo<UploadManagerContextValue>(
    () => ({
      uploads,
      isUploading,
      activeCount,
      completedCount,
      overallProgress,
      uploadFiles,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      retryUpload,
      clearCompleted,
      isDrawerOpen,
      setIsDrawerOpen,
      toggleDrawer,
    }),
    [
      uploads,
      isUploading,
      activeCount,
      completedCount,
      overallProgress,
      uploadFiles,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      retryUpload,
      clearCompleted,
      isDrawerOpen,
      toggleDrawer,
    ]
  );

  return <UploadManagerContext.Provider value={value}>{children}</UploadManagerContext.Provider>;
};
