import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface FilePreviewModalProps {
  url: string;
  title: string;
  /** `frame` renders PDFs and HTML pages in an iframe; `video` uses a player. */
  mode: 'frame' | 'video';
  onClose: () => void;
}

interface Size {
  w: number;
  h: number;
}

const MIN_W = 288;
const MIN_H = 224;
const MARGIN = 8;

/** Eight resize handles: each edge and each corner. `dir` letters say which sides move. */
const HANDLES: { dir: string; className: string }[] = [
  { dir: 'n', className: 'top-0 inset-x-3.5 h-1.5 cursor-ns-resize' },
  { dir: 's', className: 'bottom-0 inset-x-3.5 h-1.5 cursor-ns-resize' },
  { dir: 'w', className: 'left-0 inset-y-3.5 w-1.5 cursor-ew-resize' },
  { dir: 'e', className: 'right-0 inset-y-3.5 w-1.5 cursor-ew-resize' },
  { dir: 'nw', className: 'top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize' },
  { dir: 'ne', className: 'top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize' },
  { dir: 'sw', className: 'bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize' },
  { dir: 'se', className: 'bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize' },
];

const initialSize = (): Size => ({
  w: Math.min(672, window.innerWidth - MARGIN * 2),
  h: Math.min(544, window.innerHeight - MARGIN * 2),
});

/** In-page preview for a file, resizable from every edge and corner while staying centered, so the admin does not leave the editor. */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ url, title, mode, onClose }) => {
  const { t } = useAdminT();
  const [size, setSize] = useState<Size>(initialSize);
  const drag = useRef<{ dir: string; px: number; py: number; start: Size } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, dir: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dir, px: e.clientX, py: e.clientY, start: size };
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    // The modal stays centered, so dragging one side moves both sides by the same amount.
    const { w, h } = d.start;
    let nw = w;
    let nh = h;
    if (d.dir.includes('e')) nw = w + dx * 2;
    if (d.dir.includes('w')) nw = w - dx * 2;
    if (d.dir.includes('s')) nh = h + dy * 2;
    if (d.dir.includes('n')) nh = h - dy * 2;
    setSize({
      w: Math.min(Math.max(nw, MIN_W), window.innerWidth - MARGIN * 2),
      h: Math.min(Math.max(nh, MIN_H), window.innerHeight - MARGIN * 2),
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative shrink-0 bg-surface rounded-2xl border border-muted-border/40 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: size.w, height: size.h }}
        onClick={(e) => e.stopPropagation()}
      >
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
        {HANDLES.map(({ dir, className }) => (
          <div
            key={dir}
            className={`absolute z-10 touch-none ${className}`}
            onPointerDown={(e) => startDrag(e, dir)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </div>
    </div>
  );
};
