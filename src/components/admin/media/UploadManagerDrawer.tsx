import React from 'react';
import {
  Upload,
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
  Trash2,
  ChevronDown,
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
  if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-accent" />;
  if (file.type.startsWith('video/')) return <VideoIcon className="w-4 h-4 text-purple-500" />;
  if (file.type === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) return <Box className="w-4 h-4 text-blue-500" />;
  return <FileIcon className="w-4 h-4 text-neutral-text/70" />;
}

export const UploadManagerDrawer: React.FC = () => {
  const {
    uploads,
    isDrawerOpen,
    setIsDrawerOpen,
    overallProgress,
    activeCount,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
  } = useUploadManager();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (!isDrawerOpen || uploads.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 end-6 z-50 w-84 sm:w-96 rounded-2xl bg-surface/95 backdrop-blur-md border border-muted-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="p-3 bg-canvas/80 border-b border-muted-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Upload className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black text-heading truncate">
              {isAr ? 'مدير رفع الملفات' : 'Upload Manager'}
              {activeCount > 0 && <span className="ms-1.5 text-accent font-mono text-[10px]">({activeCount})</span>}
            </h4>
            <p className="text-[10px] text-neutral-text/50 font-mono">
              {overallProgress}% {isAr ? 'مكتمل إجمالاً' : 'overall'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={clearCompleted}
            className="p-1 rounded-lg text-neutral-text/50 hover:text-heading hover:bg-surface transition cursor-pointer"
            title={isAr ? 'مسح الملفات المكتملة' : 'Clear completed'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="p-1 rounded-lg text-neutral-text/50 hover:text-heading hover:bg-surface transition cursor-pointer"
            title={isAr ? 'تصغير' : 'Minimize'}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="w-full bg-muted-border/20 h-1">
        <div
          className="bg-accent h-1 transition-all duration-300"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Items list */}
      <div className="p-2 space-y-2 overflow-y-auto divide-y divide-muted-border/20">
        {uploads.map((item: ManagedUpload) => {
          const isDone = item.status === 'completed';
          const isErr = item.status === 'error';
          const isPaused = item.status === 'paused';
          const isUploading = item.status === 'uploading';

          return (
            <div key={item.id} className="pt-2 first:pt-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-canvas border border-muted-border/40 flex items-center justify-center shrink-0">
                    {getFileIcon(item.file)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-heading truncate" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-neutral-text/50 font-mono">
                      <span>{formatBytes(item.file.size)}</span>
                      {item.speed && <span className="text-accent font-bold">{item.speed}</span>}
                      {item.remainingSeconds !== undefined && item.remainingSeconds > 0 && (
                        <span>~{item.remainingSeconds}s</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Control buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {isUploading && (
                    <button
                      type="button"
                      onClick={() => pauseUpload(item.id)}
                      className="p-1 rounded-md text-neutral-text/60 hover:text-amber-500 hover:bg-amber-500/10 cursor-pointer transition"
                      title={isAr ? 'إيقاف مؤقت' : 'Pause'}
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isPaused && (
                    <button
                      type="button"
                      onClick={() => resumeUpload(item.id)}
                      className="p-1 rounded-md text-accent hover:bg-accent/10 cursor-pointer transition"
                      title={isAr ? 'استئناف الرفع' : 'Resume'}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isErr && (
                    <button
                      type="button"
                      onClick={() => retryUpload(item.id)}
                      className="p-1 rounded-md text-accent hover:bg-accent/10 cursor-pointer transition"
                      title={isAr ? 'إعادة المحاولة' : 'Retry'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => cancelUpload(item.id)}
                    className="p-1 rounded-md text-neutral-text/40 hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition"
                    title={isAr ? 'إلغاء' : 'Cancel'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Individual progress bar */}
              <div className="flex items-center gap-2">
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
                <span className="text-[10px] font-mono text-neutral-text/60 min-w-[32px] text-end">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                  ) : isErr ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />
                  ) : (
                    `${item.progress}%`
                  )}
                </span>
              </div>

              {isErr && item.error && (
                <p className="text-[9px] text-red-500 truncate">{item.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
