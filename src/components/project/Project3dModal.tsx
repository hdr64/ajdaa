import React, { Suspense, lazy, useEffect } from 'react';
import { Box, ExternalLink, X } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';
import { getModel3dKind, isModel3dUrl } from '../../utils/urlValidation';

// three.js only loads when a visitor opens a library 3D model.
const Model3dViewer = lazy(() => import('../Model3dViewer'));

interface Project3dModalProps {
  /** The raw `model3dUrl` of the project; re-validated here. */
  url: string;
  title: string;
  isAr: boolean;
  onClose: () => void;
}

/** Full-screen viewer for a project's 3D model, video or interactive page. Owns Escape and the scroll lock. */
export const Project3dModal: React.FC<Project3dModalProps> = ({ url, title, isAr, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Re-checked here as a last line of defence: never embed or link a scheme the
  // server would not have accepted.
  const safeUrl = isModel3dUrl(url) ? url : undefined;
  if (!safeUrl) return null;

  // The kind is inferred from the file: a library `.glb` opens in the built-in
  // viewer, a video in a player, an HTML page in a sandboxed iframe; an external
  // https viewer link stays a plain iframe.
  const kind = getModel3dKind(safeUrl);
  const src = resolveMediaUrl(safeUrl);
  const viewerTitle = isAr ? `المجسم ثلاثي الأبعاد - ${title}` : `3D model - ${title}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-sm flex flex-col p-3 sm:p-5 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'المجسم ثلاثي الأبعاد' : '3D model viewer'}
    >
      {/* Backdrop click closes */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between gap-3 mb-3 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <Box className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm font-black truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(kind === 'external' || kind === 'html') && (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                title={isAr ? 'فتح في تبويب جديد' : 'Open in new tab'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/15 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isAr ? 'فتح في تبويب جديد' : 'Open in new tab'}</span>
              </a>
            )}
            <button
              onClick={onClose}
              aria-label={isAr ? 'إغلاق المجسم' : 'Close 3D model'}
              title={isAr ? 'إغلاق (Esc)' : 'Close (Esc)'}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/80 text-white/90 hover:text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
          {kind === 'model' ? (
            <Suspense fallback={null}>
              <Model3dViewer src={src} isAr={isAr} title={viewerTitle} />
            </Suspense>
          ) : kind === 'video' ? (
            <video
              src={src}
              title={viewerTitle}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full bg-black"
            />
          ) : kind === 'html' ? (
            // An uploaded page runs without access to this site (no allow-same-origin).
            <iframe
              src={src}
              title={viewerTitle}
              sandbox="allow-scripts allow-popups allow-forms"
              referrerPolicy="no-referrer"
              allow="fullscreen"
              allowFullScreen
              loading="lazy"
              className="w-full h-full border-0 bg-white"
            />
          ) : (
            <iframe
              src={safeUrl}
              title={viewerTitle}
              sandbox="allow-scripts allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
              allow="fullscreen"
              loading="lazy"
              className="w-full h-full border-0"
            />
          )}
        </div>

        {kind === 'model' ? (
          <p className="mt-2 text-[11px] text-white/50 text-center">
            {isAr ? 'اسحب للتدوير، وحرّك العجلة أو اقرص للتكبير.' : 'Drag to rotate, scroll or pinch to zoom.'}
          </p>
        ) : kind === 'video' ? null : (
          <p className="mt-2 text-[11px] text-white/50 text-center">
            {isAr
              ? 'لا يظهر المجسم؟ بعض المواقع تمنع العرض داخل الصفحة، افتحه في تبويب جديد.'
              : 'Model not loading? Some sites block embedding — open it in a new tab.'}
          </p>
        )}
      </div>
    </div>
  );
};
