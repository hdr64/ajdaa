import React from 'react';
import { Box, Copy, ExternalLink, File as FileIcon, FileText, Globe, Image as ImageIcon, Video as VideoIcon, X } from 'lucide-react';
import { useAdminT } from '../../../../i18n/admin/useAdminT';
import { formatAdminDate } from '../../../../pages/admin/adminFormat';
import { mediaPublicUrl, type MediaFileDto } from '../../../../services/mediaService';
import { resolveMediaUrl } from '../../../../services/api';
import { formatBytes } from '../../drive/driveFormat';
import { ResizableFrame } from '../../common/ResizableFrame';
import { useEscapeKey } from '../../common/useEscapeKey';

interface MediaPreviewDialogProps {
  file: MediaFileDto;
  onCopy: (link: string) => void;
  onClose: () => void;
}

const TYPE_ICONS: Record<MediaFileDto['fileType'], React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: VideoIcon,
  pdf: FileText,
  model3d: Box,
  html: Globe,
  document: FileText,
  other: FileIcon,
};

const initialSize = () => ({
  w: Math.min(1000, window.innerWidth - 32),
  h: Math.min(680, window.innerHeight - 32),
});

/** A read-only link field with a copy button. */
const LinkField: React.FC<{ label: string; value: string; copyLabel: string; onCopy: () => void }> = ({
  label,
  value,
  copyLabel,
  onCopy,
}) => (
  <div className="flex-1 basis-56 min-w-0">
    <span className="block text-[10px] font-bold text-neutral-text/60 mb-1">{label}</span>
    <div className="flex items-center gap-2">
      <input
        readOnly
        dir="ltr"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-canvas border border-muted-border/50 text-[11px] text-heading"
      />
      <button
        type="button"
        onClick={onCopy}
        title={copyLabel}
        aria-label={copyLabel}
        className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 cursor-pointer shrink-0"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

/**
 * File details for the Library: links and a live preview. The panel is
 * resizable from every edge; the details sit below the preview.
 */
export const MediaPreviewDialog: React.FC<MediaPreviewDialogProps> = ({
  file,
  onCopy,
  onClose,
}) => {
  const { t } = useAdminT();
  useEscapeKey(onClose);

  const TypeIcon = TYPE_ICONS[file.fileType];
  const directUrl = resolveMediaUrl(file.url);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={file.originalName}
    >
      <ResizableFrame initial={initialSize()} min={{ w: 320, h: 360 }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-muted-border/30 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <TypeIcon className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <p className="text-sm font-black text-heading truncate" title={file.originalName}>
              {file.originalName}
            </p>
            <p className="text-[11px] text-neutral-text/55 truncate">
              <bdi dir="ltr">{file.mimeType}</bdi> · <bdi dir="ltr">{formatBytes(file.size)}</bdi> ·{' '}
              <bdi>{formatAdminDate(file.createdAt)}</bdi>
            </p>
          </div>
          <a
            href={file.fileType === 'html' ? mediaPublicUrl(file) : directUrl}
            target="_blank"
            rel="noreferrer"
            title={t('media.preview.openInTab')}
            aria-label={t('media.preview.openInTab')}
            className="p-2 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-muted-surface cursor-pointer shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            title={t('media.common.close')}
            aria-label={t('media.common.close')}
            className="p-2 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-muted-surface cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: preview on top, the two links in one row below (they wrap when the frame is narrow). */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-40 min-w-0 bg-neutral-950/90 flex items-center justify-center overflow-hidden">
            {file.fileType === 'image' ? (
              <img src={directUrl} alt={file.originalName} className="max-w-full max-h-full object-contain p-3" />
            ) : file.fileType === 'html' ? (
              <iframe
                src={mediaPublicUrl(file)}
                title={file.originalName}
                sandbox="allow-scripts allow-popups allow-forms"
                className="w-full h-full border-0 bg-white"
              />
            ) : file.fileType === 'video' ? (
              <video controls autoPlay src={directUrl} className="max-w-full max-h-full" />
            ) : file.fileType === 'pdf' ? (
              <iframe src={directUrl} title={file.originalName} className="w-full h-full border-0 bg-white" />
            ) : (
              <div className="p-8 text-center text-white space-y-3">
                <FileText className="w-14 h-14 mx-auto text-accent" />
                <p className="text-sm font-bold break-all">{file.originalName}</p>
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs"
                >
                  <span>{t('media.preview.openInTab')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          <div className="shrink-0 max-h-[45%] overflow-y-auto p-4 flex flex-wrap content-start gap-3 text-start border-t border-muted-border/30">
            <LinkField
              label={t('media.preview.publicLink')}
              value={mediaPublicUrl(file)}
              copyLabel={t('media.action.copyUrl')}
              onCopy={() => onCopy(mediaPublicUrl(file))}
            />
            <LinkField
              label={t('media.preview.fileLink')}
              value={directUrl}
              copyLabel={t('media.action.copyFileUrl')}
              onCopy={() => onCopy(directUrl)}
            />
          </div>
        </div>
      </ResizableFrame>
    </div>
  );
};
