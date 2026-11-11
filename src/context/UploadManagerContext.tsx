import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { uploadFileInChunks, abortChunkedUpload } from '../services/chunkedUploadService';
import { uploadMedia, type UploadedMedia } from '../services/mediaService';
import { DRIVE_MAX_FILE_BYTES, uploadDriveFile, type DriveFile } from '../services/driveService';
import { useAdminT } from '../i18n/admin/useAdminT';

export type UploadTarget = { kind: 'library' } | { kind: 'drive'; folderId: string | null; folderName?: string };

const LIBRARY_TARGET: UploadTarget = { kind: 'library' };

export interface UploadFilesOptions {
  /** Where the files go. Defaults to the media library. */
  target?: UploadTarget;
  /** Per-file path below the target folder (folder uploads), same order as `files`. Drive only. */
  relPaths?: (string | undefined)[];
}

export type UploadResult = UploadedMedia | DriveFile;

export interface ManagedUpload {
  id: string;
  file: File;
  progress: number; // 0 - 100
  uploadedBytes: number;
  totalBytes: number;
  speed?: string;
  remainingSeconds?: number;
  status: 'queued' | 'uploading' | 'processing' | 'paused' | 'completed' | 'error';
  error?: string;
  target: UploadTarget;
  /** Path below the target folder (Drive folder uploads). */
  relPath?: string;
  result?: UploadResult;
  uploadId?: string;
  abortController?: AbortController;
}

interface UploadManagerContextValue {
  uploads: ManagedUpload[];
  isUploading: boolean;
  activeCount: number;
  completedCount: number;
  overallProgress: number;
  uploadFiles: (files: File[], opts?: UploadFilesOptions) => Promise<UploadResult[]>;
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
  const { t, isAr } = useAdminT();

  // Keep a map of active controllers and auto-dismiss timers
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up timers on unmount
  React.useEffect(() => {
    const timers = dismissTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const activeCount = useMemo(
    () => uploads.filter((u) => u.status === 'uploading' || u.status === 'queued' || u.status === 'processing').length,
    [uploads]
  );

  const completedCount = useMemo(
    () => uploads.filter((u) => u.status === 'completed').length,
    [uploads]
  );

  const isUploading = activeCount > 0;

  const overallProgress = useMemo(() => {
    const active = uploads.filter(
      (u) => u.status === 'uploading' || u.status === 'queued' || u.status === 'completed' || u.status === 'processing'
    );
    if (active.length === 0) return 0;
    const totalBytes = active.reduce((acc, u) => acc + u.totalBytes, 0);
    if (totalBytes === 0) return 100;
    const uploadedBytes = active.reduce(
      (acc, u) => acc + (u.status === 'completed' || u.status === 'processing' ? u.totalBytes : u.uploadedBytes),
      0
    );
    return Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));
  }, [uploads]);

  const runUploadItem = useCallback(async (item: ManagedUpload): Promise<UploadResult> => {
    const controller = new AbortController();
    controllersRef.current.set(item.id, controller);

    setUploads((prev) =>
      prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading', error: undefined } : u))
    );

    try {
      let result: UploadResult;

      if (item.target.kind === 'drive') {
        if (item.file.size > DRIVE_MAX_FILE_BYTES) {
          throw new Error(t('drive.upload.tooLarge', { name: item.file.name }));
        }
        // Files up to 50 MB go in one request with no progress events.
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, progress: 60, uploadedBytes: Math.floor(u.totalBytes / 2) } : u))
        );
        result = await uploadDriveFile(item.file, {
          folderId: item.target.folderId,
          relPath: item.relPath,
          signal: controller.signal,
          onProgress: (percent) => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === item.id
                  ? { ...u, progress: percent, uploadedBytes: Math.floor((u.totalBytes * percent) / 100) }
                  : u
              )
            );
          },
        });
      } else if (item.file.size >= 5 * 1024 * 1024 || !item.file.type.startsWith('image/')) {
        // For files >= 5MB or non-image types: use resumable chunked upload
        result = await uploadFileInChunks(item.file, {
          signal: controller.signal,
          onProgress: (prog) => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === item.id
                  ? {
                      ...u,
                      status: prog.phase === 'processing' ? 'processing' : u.status,
                      progress: prog.percent,
                      uploadedBytes: prog.uploadedBytes,
                      speed: prog.phase === 'processing' ? undefined : prog.speed,
                      remainingSeconds: prog.phase === 'processing' ? undefined : prog.remainingSeconds,
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
          prev.map((u) => (u.id === item.id ? { ...u, progress: 60, uploadedBytes: Math.floor(u.totalBytes / 2) } : u))
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

      // Keep for 5 seconds after finish then disappear automatically
      const timer = setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== item.id));
        dismissTimersRef.current.delete(item.id);
      }, 5000);
      dismissTimersRef.current.set(item.id, timer);

      return result;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        // Paused or cancelled
        throw err;
      }
      const msg = err instanceof Error ? err.message : isAr ? 'فشل الرفع' : 'Upload failed';
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'error', error: msg, speed: undefined } : u))
      );
      throw err;
    } finally {
      controllersRef.current.delete(item.id);
    }
  }, [t, isAr]);

  const uploadFiles = useCallback(
    async (files: File[], opts?: UploadFilesOptions): Promise<UploadResult[]> => {
      if (!files.length) return [];
      const target = opts?.target ?? LIBRARY_TARGET;

      const newItems: ManagedUpload[] = files.map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        status: 'queued',
        target,
        relPath: target.kind === 'drive' ? opts?.relPaths?.[index] : undefined,
      }));

      setUploads((prev) => [...prev, ...newItems]);
      setIsDrawerOpen(true);

      const results = await Promise.allSettled(newItems.map((item) => runUploadItem(item)));
      return results
        .filter((r): r is PromiseFulfilledResult<UploadResult> => r.status === 'fulfilled')
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
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }
    const item = uploads.find((u) => u.id === id);
    // Drive uploads abort their own server session when the request is cancelled.
    if (item?.uploadId && item.target.kind === 'library') {
      void abortChunkedUpload(item.uploadId);
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, [uploads]);

  const retryUpload = useCallback(
    (id: string) => {
      const timer = dismissTimersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        dismissTimersRef.current.delete(id);
      }
      const item = uploads.find((u) => u.id === id);
      if (item) {
        void runUploadItem(item);
      }
    },
    [uploads, runUploadItem]
  );

  const clearCompleted = useCallback(() => {
    dismissTimersRef.current.forEach((t) => clearTimeout(t));
    dismissTimersRef.current.clear();
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

