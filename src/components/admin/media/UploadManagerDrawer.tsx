import React from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Video as VideoIcon,
  Image as ImageIcon,
  Box,
  File as FileIcon,
} from 'lucide-react';
import { useUploadManager, type ManagedUpload } from '../../../context/UploadManagerContext';
import { useLanguage } from '../../../hooks/useLanguage';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-accent" />;
  if (file.type.startsWith('video/')) return <VideoIcon className="w-5 h-5 text-purple-500" />;
  if (file.type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) return <Box className="w-5 h-5 text-blue-500" />;
  return <FileIcon className="w-5 h-5 text-neutral-text/70" />;
}

export const UploadManagerDrawer: React.FC = () => {
  const {
    uploads,
    isDrawerOpen,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
  } = useUploadManager();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (!isDrawerOpen || uploads.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 end-6 z-50 w-84 sm:w-96 flex flex-col gap-2 pointer-events-auto">
      {uploads.map((item: ManagedUpload) => {
        const isDone = item.status === 'completed';
        const isErr = item.status === 'error';
        const isPaused = item.status === 'paused';
        const isUploading = item.status === 'uploading';

        return (
          <div
            key={item.id}
            className="p-3.5 rounded-2xl bg-surface/95 backdrop-blur-md border border-muted-border/60 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <div className="flex items-center justify-between gap-3">
              {/* File details & type icon */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-canvas border border-muted-border/40 flex items-center justify-center shrink-0 shadow-xs">
                  {getFileIcon(item.file)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-heading truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-text/50 font-mono mt-0.5">
                    <span>{formatBytes(item.file.size)}</span>
                    {item.speed && <span className="text-accent font-bold">{item.speed}</span>}
                    {item.remainingSeconds !== undefined && item.remainingSeconds > 0 && (
                      <span>~{item.remainingSeconds}s</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action controls */}
              <div className="flex items-center gap-1 shrink-0">
                {isUploading && (
                  <button
                    type="button"
                    onClick={() => pauseUpload(item.id)}
                    className="p-1.5 rounded-lg text-neutral-text/60 hover:text-amber-500 hover:bg-amber-500/10 cursor-pointer transition"
                    title={isAr ? 'إيقاف مؤقت' : 'Pause'}
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}

                {isPaused && (
                  <button
                    type="button"
                    onClick={() => resumeUpload(item.id)}
                    className="p-1.5 rounded-lg text-accent hover:bg-accent/10 cursor-pointer transition"
                    title={isAr ? 'استئناف الرفع' : 'Resume'}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                {isErr && (
                  <button
                    type="button"
                    onClick={() => retryUpload(item.id)}
                    className="p-1.5 rounded-lg text-accent hover:bg-accent/10 cursor-pointer transition"
                    title={isAr ? 'إعادة المحاولة' : 'Retry'}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => cancelUpload(item.id)}
                  className="p-1.5 rounded-lg text-neutral-text/40 hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition"
                  title={isAr ? 'إلغاء' : 'Cancel'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress bar & status */}
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono font-bold text-neutral-text/70 min-w-[28px]">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                ) : isErr ? (
                  <AlertCircle className="w-4 h-4 text-red-500 inline" />
                ) : (
                  `${item.progress}%`
                )}
              </span>

              <div className="flex-1 bg-canvas rounded-full h-1.5 overflow-hidden border border-muted-border/30">
                <div
                  className={`h-full transition-all duration-200 ${
                    isDone
                      ? 'bg-emerald-500'
                      : isErr
                      ? 'bg-red-500'
                      : isPaused
                      ? 'bg-amber-500'
                      : 'bg-accent'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>

            {isErr && item.error && (
              <p className="text-[10px] text-red-500 truncate">{item.error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
