import React, { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box, ExternalLink, Maximize, X } from 'lucide-react';
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
  /** Edge-to-edge layout (no padding, frame or hint line); the default is a framed window. */
  fullscreen?: boolean;
  /**
   * URL fragment for this viewer (see `model3dHash`). While open the address bar shows it and
   * the browser's Back button closes the viewer instead of leaving the page.
   */
  hash?: string;
}

/** Viewer for a project's 3D model, video or interactive page. Owns Escape and the scroll lock. */
export const Project3dModal: React.FC<Project3dModalProps> = ({ url, title, isAr, onClose, fullscreen = false, hash }) => {
  // True while the history entry carrying `#hash` was pushed by this viewer (not a shared link).
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!hash) return;
    const target = `#${hash}`;
    if (window.location.hash !== target) {
      try {
        // Remember the scroll position of the page behind, so Back lands exactly there.
        window.history.replaceState({ ...window.history.state, scrollY: window.scrollY }, '');
        window.history.pushState(
          { ...window.history.state, model3d: hash },
          '',
          `${window.location.pathname}${window.location.search}${target}`,
        );
        pushedRef.current = true;
      } catch {
        // History unavailable: the viewer still works, only Back behaves as before.
      }
    } else if (window.history.state?.model3d === hash) {
      pushedRef.current = true;
    }
    const handlePop = () => {
      if (window.location.hash !== target) {
        pushedRef.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [hash]);

  // Every close path (X, Escape, backdrop) goes through here. When this viewer pushed a history
  // entry, going back pops it and the popstate handler closes; otherwise close directly.
  const requestClose = useCallback(() => {
    if (hash && pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
      return;
    }
    if (hash && window.location.hash === `#${hash}`) {
      try {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
      } catch {
        // Ignore: the fragment just stays in the address bar.
      }
    }
    onClose();
  }, [hash, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [requestClose]);

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

  // Portalled to <body>: a card with a transform/filter/overflow ancestor would otherwise
  // turn `fixed` into card-sized and clip the viewer.
  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col ${
        fullscreen ? 'bg-black modal3d-open' : 'bg-neutral-950/90 backdrop-blur-sm p-3 sm:p-5 md:p-8 modal3d-fade'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'المجسم ثلاثي الأبعاد' : '3D model viewer'}
    >
      {/* Backdrop click closes */}
      <div className="absolute inset-0 cursor-pointer" onClick={requestClose} aria-hidden="true" />

      <div
        className={`relative z-10 w-full flex flex-col flex-1 min-h-0 ${fullscreen ? '' : 'max-w-6xl mx-auto'}`}
      >
        <div
          className={`flex items-center justify-between gap-3 text-white ${
            fullscreen ? 'relative px-3 py-2 bg-neutral-950 border-b border-white/10 modal3d-header' : 'mb-3'
          }`}
        >
          {fullscreen && (
            <span
              className="modal3d-line pointer-events-none absolute inset-x-0 -bottom-px h-0.5"
              aria-hidden="true"
            />
          )}
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
                aria-label={isAr ? 'فتح في تبويب جديد' : 'Open in new tab'}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/15 flex items-center justify-center transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={requestClose}
              aria-label={isAr ? 'إغلاق المجسم' : 'Close 3D model'}
              title={isAr ? 'إغلاق (Esc)' : 'Close (Esc)'}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/80 text-white/90 hover:text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className={`flex-1 min-h-0 overflow-hidden bg-black ${
            fullscreen ? '' : 'rounded-2xl border border-white/15 shadow-2xl'
          }`}
        >
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

        {fullscreen && (
          <>
            {/* Welcome card: fades out by itself; it never intercepts clicks. */}
            <div
              className="modal3d-intro pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6"
              aria-hidden="true"
            >
              <div className="modal3d-intro-card flex flex-col items-center gap-3 text-center text-white">
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30">
                  <span className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-ping" />
                  <Maximize className="relative h-7 w-7 text-accent-light" />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                  {isAr ? 'وضع ملء الشاشة' : 'Full-screen mode'}
                </span>
                <span className="max-w-[80vw] text-xl sm:text-3xl font-black leading-snug">{title}</span>
              </div>
            </div>
            {/* Exit hint: shown for a few seconds, then gone. */}
            <div
              className="modal3d-hint pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4"
              aria-hidden="true"
            >
              <span className="rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-md">
                <span className="hidden sm:inline">
                  {isAr ? 'اضغط Esc أو زر الرجوع للخروج' : 'Press Esc or Back to exit'}
                </span>
                <span className="sm:hidden">{isAr ? 'اضغط ✕ أو زر الرجوع للخروج' : 'Tap ✕ or Back to exit'}</span>
              </span>
            </div>
          </>
        )}

        {fullscreen ? null : kind === 'model' ? (
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
    </div>,
    document.body,
  );
};
