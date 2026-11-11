import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { uploadFileInChunks, abortChunkedUpload } from '../services/chunkedUploadService';
import { uploadMedia, type UploadedMedia } from '../services/mediaService';
import { DRIVE_MAX_FILE_BYTES, uploadDriveFile, type DriveFile } from '../services/driveService';
import { useAdminT } from '../i18n/admin/useAdminT';

export type UploadTarget =
  | { kind: 'library'; /** Open library folder; null/undefined = library root. */ folderId?: string | null }
  | { kind: 'drive'; folderId: string | null; folderName?: string };

const LIBRARY_TARGET: UploadTarget = { kind: 'library' };

/** At most this many uploads run at once; the rest wait in the queue. */
const MAX_CONCURRENT_UPLOADS = 3;
/** When everything finished successfully, the panel clears itself after this long. */
const AUTO_DISMISS_MS = 5000;

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
  /** Queued, uploading or processing items. */
  activeCount: number;
  queuedCount: number;
  errorCount: number;
  completedCount: number;
  overallProgress: number;
  uploadFiles: (files: File[], opts?: UploadFilesOptions) => Promise<UploadResult[]>;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  /** Re-queues every item that failed. */
  retryFailed: () => void;
  /** Removes completed items from the list. */
  clearFinished: () => void;
  /** Alias of `clearFinished`, kept for existing callers. */
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

interface Waiter {
  resolve: (result: UploadResult) => void;
  reject: (reason: unknown) => void;
}

export const UploadManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<ManagedUpload[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { t, isAr } = useAdminT();

  // Scheduler state lives in refs: it changes without needing a render, and the
  // async upload code must always see the current values.
  /** Static data of every known item (file, target, path); status lives in state. */
  const itemsRef = useRef<Map<string, ManagedUpload>>(new Map());
  /** Items waiting for a free slot, in upload order. */
  const pendingRef = useRef<string[]>([]);
  /** Items running right now. Its size is the number of used slots. */
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  /** The promise each `uploadFiles` call waits on, per item. Settled once per item. */
  const waitersRef = useRef<Map<string, Waiter>>(new Map());
  /** Server-side chunk session of library uploads, needed to abort them on cancel. */
  const uploadSessionsRef = useRef<Map<string, string>>(new Map());
  const uploadsRef = useRef<ManagedUpload[]>([]);
  const pumpRef = useRef<() => void>(() => {});

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const queuedCount = useMemo(() => uploads.filter((u) => u.status === 'queued').length, [uploads]);
  const errorCount = useMemo(() => uploads.filter((u) => u.status === 'error').length, [uploads]);
  const completedCount = useMemo(() => uploads.filter((u) => u.status === 'completed').length, [uploads]);
  const activeCount = useMemo(
    () => uploads.filter((u) => u.status === 'uploading' || u.status === 'queued' || u.status === 'processing').length,
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

  const settleWaiter = useCallback((id: string, outcome: { ok: true; result: UploadResult } | { ok: false; reason: unknown }) => {
    const waiter = waitersRef.current.get(id);
    if (!waiter) return;
    waitersRef.current.delete(id);
    if (outcome.ok) waiter.resolve(outcome.result);
    else waiter.reject(outcome.reason);
  }, []);

  /**
   * Runs one item and always frees its slot afterwards. A pause or cancel aborts
   * the controller; those paths own the state and the waiter, so this function
   * only reports real failures.
   */
  const runUploadItem = useCallback(
    async (id: string): Promise<void> => {
      const item = itemsRef.current.get(id);
      if (!item) {
        pumpRef.current();
        return;
      }

      // Registered synchronously, before the first await, so the scheduler's
      // slot count is correct when it starts the next item in the same loop.
      const controller = new AbortController();
      controllersRef.current.set(id, controller);

      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'uploading', error: undefined } : u)));

      try {
        let result: UploadResult;

        if (item.target.kind === 'drive') {
          if (item.file.size > DRIVE_MAX_FILE_BYTES) {
            throw new Error(t('drive.upload.tooLarge', { name: item.file.name }));
          }
          // Files up to 50 MB go in one request with no progress events.
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, progress: 60, uploadedBytes: Math.floor(u.totalBytes / 2) } : u))
          );
          result = await uploadDriveFile(item.file, {
            folderId: item.target.folderId,
            relPath: item.relPath,
            signal: controller.signal,
            onProgress: (percent) => {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === id ? { ...u, progress: percent, uploadedBytes: Math.floor((u.totalBytes * percent) / 100) } : u
                )
              );
            },
          });
        } else if (item.file.size >= 5 * 1024 * 1024 || !item.file.type.startsWith('image/')) {
          // For files >= 5MB or non-image types: use resumable chunked upload
          result = await uploadFileInChunks(item.file, {
            folderId: item.target.folderId,
            signal: controller.signal,
            onProgress: (prog) => {
              if (prog.uploadId) uploadSessionsRef.current.set(id, prog.uploadId);
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === id
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
            prev.map((u) => (u.id === id ? { ...u, progress: 60, uploadedBytes: Math.floor(u.totalBytes / 2) } : u))
          );
          result = await uploadMedia(item.file, { signal: controller.signal, folderId: item.target.folderId });
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.id === id
              ? { ...u, status: 'completed', progress: 100, uploadedBytes: u.totalBytes, speed: undefined, result }
              : u
          )
        );
        uploadSessionsRef.current.delete(id);
        settleWaiter(id, { ok: true, result });
      } catch (err: unknown) {
        // Paused or cancelled: pauseUpload / cancelUpload already updated state and waiters.
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : isAr ? 'فشل الرفع' : 'Upload failed';
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, status: 'error', error: msg, speed: undefined } : u))
          );
          uploadSessionsRef.current.delete(id);
          settleWaiter(id, { ok: false, reason: err });
        }
      } finally {
        // Only release our own slot: after a pause and quick resume the id may
        // already be running again under a new controller.
        if (controllersRef.current.get(id) === controller) controllersRef.current.delete(id);
        pumpRef.current();
      }
    },
    [t, isAr, settleWaiter]
  );

  /** Starts waiting items while a slot is free. Safe to call at any time. */
  const pump = useCallback(() => {
    while (controllersRef.current.size < MAX_CONCURRENT_UPLOADS && pendingRef.current.length > 0) {
      const id = pendingRef.current.shift() as string;
      if (!itemsRef.current.has(id) || controllersRef.current.has(id)) continue;
      void runUploadItem(id);
    }
  }, [runUploadItem]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  /** Puts an item back at the end of the queue (resume, retry). */
  const enqueue = useCallback(
    (id: string, resetProgress: boolean) => {
      if (!itemsRef.current.has(id)) return;
      if (pendingRef.current.includes(id) || controllersRef.current.has(id)) return;
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                status: 'queued',
                error: undefined,
                speed: undefined,
                remainingSeconds: undefined,
                ...(resetProgress ? { progress: 0, uploadedBytes: 0 } : {}),
              }
            : u
        )
      );
      pendingRef.current.push(id);
      pump();
    },
    [pump]
  );

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

      // One promise per item; the call resolves when every item has settled.
      const settled = newItems.map(
        (item) =>
          new Promise<UploadResult>((resolve, reject) => {
            itemsRef.current.set(item.id, item);
            waitersRef.current.set(item.id, { resolve, reject });
          })
      );

      setUploads((prev) => [...prev, ...newItems]);
      setIsDrawerOpen(true);
      pendingRef.current.push(...newItems.map((item) => item.id));
      pump();

      const results = await Promise.allSettled(settled);
      return results
        .filter((r): r is PromiseFulfilledResult<UploadResult> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    [pump]
  );

  const pauseUpload = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (!controller) return; // only a running item can be paused
      controller.abort();
      controllersRef.current.delete(id); // free the slot right away
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'paused', speed: undefined } : u)));
      pump();
    },
    [pump]
  );

  const resumeUpload = useCallback((id: string) => enqueue(id, false), [enqueue]);
  const retryUpload = useCallback((id: string) => enqueue(id, true), [enqueue]);

  const retryFailed = useCallback(() => {
    uploadsRef.current.filter((u) => u.status === 'error').forEach((u) => enqueue(u.id, true));
  }, [enqueue]);

  const cancelUpload = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
        controllersRef.current.delete(id);
      }
      pendingRef.current = pendingRef.current.filter((pendingId) => pendingId !== id);

      const sessionId = uploadSessionsRef.current.get(id);
      const item = itemsRef.current.get(id);
      // Drive uploads abort their own server session when the request is cancelled.
      if (sessionId && item?.target.kind === 'library') {
        void abortChunkedUpload(sessionId);
      }
      uploadSessionsRef.current.delete(id);
      itemsRef.current.delete(id);

      // The call that started this item must not hang on a cancelled upload.
      settleWaiter(id, { ok: false, reason: new Error('Upload cancelled') });
      setUploads((prev) => prev.filter((u) => u.id !== id));
      pump();
    },
    [pump, settleWaiter]
  );

  const clearFinished = useCallback(() => {
    uploadsRef.current.filter((u) => u.status === 'completed').forEach((u) => itemsRef.current.delete(u.id));
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  }, []);

  // When everything has completed (nothing waiting, running, paused or failed),
  // clear the list and close the panel after a short pause. Any new upload changes
  // `uploads`, which cancels the timer. A failed item keeps the list open.
  useEffect(() => {
    if (uploads.length === 0 || !uploads.every((u) => u.status === 'completed')) return;
    const timer = setTimeout(() => {
      uploads.forEach((u) => itemsRef.current.delete(u.id));
      setUploads([]);
      setIsDrawerOpen(false);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [uploads]);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const value = useMemo<UploadManagerContextValue>(
    () => ({
      uploads,
      isUploading,
      activeCount,
      queuedCount,
      errorCount,
      completedCount,
      overallProgress,
      uploadFiles,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      retryUpload,
      retryFailed,
      clearFinished,
      clearCompleted: clearFinished,
      isDrawerOpen,
      setIsDrawerOpen,
      toggleDrawer,
    }),
    [
      uploads,
      isUploading,
      activeCount,
      queuedCount,
      errorCount,
      completedCount,
      overallProgress,
      uploadFiles,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      retryUpload,
      retryFailed,
      clearFinished,
      isDrawerOpen,
      toggleDrawer,
    ]
  );

  return <UploadManagerContext.Provider value={value}>{children}</UploadManagerContext.Provider>;
};
