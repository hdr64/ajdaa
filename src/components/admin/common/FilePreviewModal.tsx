import React from 'react';
import { X } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { ResizableFrame } from './ResizableFrame';
import { useEscapeKey } from './useEscapeKey';

interface FilePreviewModalProps {
  url: string;
  title: string;
  /** `frame` renders PDFs and HTML pages in an iframe; `video` uses a player. */
  mode: 'frame' | 'video';
  onClose: () => void;
}

const initialSize = () => ({
  w: Math.min(672, window.innerWidth - 16),
  h: Math.min(544, window.innerHeight - 16),
});

/** In-page preview for a file, resizable from every edge and corner while staying centered, so the admin does not leave the editor. */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ url, title, mode, onClose }) => {
  const { t } = useAdminT();
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <ResizableFrame initial={initialSize()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-muted-border/30">
          <span className="text-xs font-black text-heading truncate min-w-0">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-muted-surface cursor-pointer"
            aria-label={t('media.common.close')}
            title={t('media.common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-neutral-950">
          {mode === 'video' ? (
            <video src={url} controls className="w-full h-full" />
          ) : (
            <iframe src={url} title={title} className="w-full h-full bg-white" />
          )}
        </div>
      </ResizableFrame>
    </div>
  );
};
