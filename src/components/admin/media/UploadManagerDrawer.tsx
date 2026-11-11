import React, { useMemo, useState } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  CheckCheck,
  AlertCircle,
  FileText,
  Video as VideoIcon,
  Image as ImageIcon,
  Box,
  File as FileIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import {
  useUploadManager,
  type ManagedUpload,
  type UploadTarget,
} from '../../../context/UploadManagerContext';
import { useAdminT } from '../../../i18n/admin/useAdminT';

/** Rows drawn at once; a folder of thousands of files must not freeze the panel. */
const MAX_VISIBLE_ROWS = 200;

/** Display order: problems first, finished last. */
const STATUS_ORDER: Record<ManagedUpload['status'], number> = {
  error: 0,
  uploading: 1,
  processing: 1,
  paused: 2,
  queued: 3,
  completed: 4,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(file: File) {
  const cls = 'w-4 h-4 shrink-0';
  if (file.type.startsWith('image/')) return <ImageIcon className={`${cls} text-accent`} />;
  if (file.type.startsWith('video/')) return <VideoIcon className={`${cls} text-purple-500`} />;
  if (file.type === 'application/pdf') return <FileText className={`${cls} text-red-500`} />;
  if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) return <Box className={`${cls} text-blue-500`} />;
  return <FileIcon className={`${cls} text-neutral-text/70`} />;
}

function sameTarget(a: UploadTarget, b: UploadTarget): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'drive' && b.kind === 'drive' ? a.folderId === b.folderId : true;
}

const iconButton =
  'p-1 rounded-md cursor-pointer transition text-neutral-text/60 hover:bg-canvas';

export const UploadManagerDrawer: React.FC = () => {
  const {
    uploads,
    isDrawerOpen,
    setIsDrawerOpen,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    retryFailed,
    clearFinished,
    errorCount,
    completedCount,
    overallProgress,
  } = useUploadManager();
  const { t } = useAdminT();
  const [collapsed, setCollapsed] = useState(false);

  // Array.prototype.sort is stable, so items keep their upload order inside a group.
  const sorted = useMemo(
    () => [...uploads].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [uploads]
  );

  const sharedTarget = useMemo(
    () => (uploads.length > 0 && uploads.every((u) => sameTarget(u.target, uploads[0].target)) ? uploads[0].target : null),
    [uploads]
  );

  if (!isDrawerOpen || uploads.length === 0) {
    return null;
  }

  const targetLabel = (target: UploadTarget): string =>
    target.kind === 'drive' ? target.folderName || t('files.upload.targetDrive') : t('files.upload.targetLibrary');

  const visible = sorted.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div
      className="fixed bottom-24 end-6 z-50 w-[calc(100vw-2rem)] max-w-96 sm:w-96 rounded-2xl bg-surface/95 backdrop-blur-md border border-muted-border/60 shadow-2xl pointer-events-auto overflow-hidden"
      role="region"
      aria-label={t('files.upload.title')}
    >
      {/* Header: always visible */}
      <div className="px-3 pt-2.5 pb-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-heading truncate">
              {t('files.upload.title')}
              <span className="ms-2 font-mono font-medium text-neutral-text/60">
                {t('files.upload.summary', { done: completedCount, total: uploads.length })}
              </span>
            </p>
            {sharedTarget && (
              <p className="text-[10px] text-neutral-text/50 truncate" title={targetLabel(sharedTarget)}>
                {targetLabel(sharedTarget)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={`${iconButton} hover:text-heading`}
              title={collapsed ? t('files.upload.expand') : t('files.upload.collapse')}
              aria-label={collapsed ? t('files.upload.expand') : t('files.upload.collapse')}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className={`${iconButton} hover:text-heading`}
              title={t('files.upload.hide')}
              aria-label={t('files.upload.hide')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-canvas rounded-full h-1.5 overflow-hidden border border-muted-border/30">
          <div
            className={`h-full transition-all duration-200 ${errorCount > 0 ? 'bg-amber-500' : 'bg-accent'}`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {(errorCount > 0 || completedCount > 0) && (
          <div className="flex items-center gap-1.5">
            {errorCount > 0 && (
              <button
                type="button"
                onClick={retryFailed}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md text-accent hover:bg-accent/10 cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3" />
                {t('files.upload.retryFailed')} ({errorCount})
              </button>
            )}
            {completedCount > 0 && (
              <button
                type="button"
                onClick={clearFinished}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md text-neutral-text/70 hover:bg-canvas cursor-pointer transition"
              >
                <CheckCheck className="w-3 h-3" />
                {t('files.upload.clearFinished')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body: one compact row per file */}
      {!collapsed && (
        <ul className="max-h-[50vh] overflow-y-auto border-t border-muted-border/40">
          {visible.map((item) => {
            const isDone = item.status === 'completed';
            const isErr = item.status === 'error';
            const isPaused = item.status === 'paused';
            const isQueued = item.status === 'queued';
            const isUploading = item.status === 'uploading';
            const isProcessing = item.status === 'processing';

            return (
              <li key={item.id} className="relative px-3 py-1.5 border-b border-muted-border/20 last:border-b-0">
                <div className="flex items-center gap-2 min-h-6">
                  {getFileIcon(item.file)}
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-heading truncate" title={item.file.name}>
                      {item.file.name}
                    </span>
                    {!sharedTarget && (
                      <span className="shrink-0 max-w-20 truncate text-[9px] leading-4 px-1 rounded bg-canvas border border-muted-border/40 text-neutral-text/60">
                        {targetLabel(item.target)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-neutral-text/50 shrink-0">
                    {formatBytes(item.file.size)}
                  </span>

                  {/* Status */}
                  <span className="text-[10px] font-mono font-bold text-neutral-text/70 shrink-0 min-w-9 text-end">
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                    ) : isErr ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />
                    ) : isProcessing ? (
                      <Loader2
                        className="w-3.5 h-3.5 animate-spin text-accent inline"
                        aria-label={t('files.upload.processing')}
                      />
                    ) : isQueued ? (
                      <span className="font-sans font-medium text-neutral-text/50">{t('files.upload.queued')}</span>
                    ) : isPaused ? (
                      <span className="font-sans font-medium text-amber-500">{t('files.upload.paused')}</span>
                    ) : (
                      `${item.progress}%`
                    )}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center shrink-0">
                    {isUploading && (
                      <button
                        type="button"
                        onClick={() => pauseUpload(item.id)}
                        className={`${iconButton} hover:text-amber-500`}
                        title={t('files.upload.pause')}
                        aria-label={t('files.upload.pause')}
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isPaused && (
                      <button
                        type="button"
                        onClick={() => resumeUpload(item.id)}
                        className={`${iconButton} text-accent`}
                        title={t('files.upload.resume')}
                        aria-label={t('files.upload.resume')}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isErr && (
                      <button
                        type="button"
                        onClick={() => retryUpload(item.id)}
                        className={`${iconButton} text-accent`}
                        title={t('files.upload.retry')}
                        aria-label={t('files.upload.retry')}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => cancelUpload(item.id)}
                        className={`${iconButton} hover:text-red-500`}
                        title={t('files.upload.cancel')}
                        aria-label={t('files.upload.cancel')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isErr && item.error && (
                  <p className="text-[10px] text-red-500 truncate ps-6" title={item.error}>
                    {item.error}
                  </p>
                )}

                {/* 2 px progress line */}
                {!isDone && !isErr && !isQueued && (
                  <div className="absolute bottom-0 inset-x-0 h-0.5 bg-canvas">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isPaused
                          ? 'bg-amber-500'
                          : isProcessing
                            ? 'bg-gradient-to-r from-accent via-sky-400 to-emerald-500 animate-pulse'
                            : 'bg-accent'
                      }`}
                      style={{ width: `${isProcessing ? 100 : item.progress}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
          {hiddenCount > 0 && (
            <li className="px-3 py-1.5 text-[10px] text-center text-neutral-text/50">
              {t('files.upload.more', { count: hiddenCount })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
