import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X as CloseIcon } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { resolveMediaUrl } from '../../../services/api';
import { getModel3dKind, isModel3dFileUrl, toUploadPath } from '../../../utils/urlValidation';

const PREVIEW_PREFIX = '/api/media/site-preview/';

/** `/uploads/site/a/index.html?x=1` -> the framed preview URL of the same page. */
function toPreviewSrc(stored: string): string {
  const rest = toUploadPath(stored).replace(/^\/uploads\//, '');
  return resolveMediaUrl(`${PREVIEW_PREFIX}${rest}`);
}

/**
 * Turns the location reported by a framed page back into the stored form
 * (`/uploads/...html?query#hash`). Returns null when it is not a valid HTML page link.
 */
function toStoredUrl(msg: { path?: unknown; search?: unknown; hash?: unknown }): string | null {
  if (typeof msg.path !== 'string' || !msg.path.startsWith(PREVIEW_PREFIX)) return null;
  let path = msg.path.slice(PREVIEW_PREFIX.length);
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const search = typeof msg.search === 'string' ? msg.search : '';
  const hash = typeof msg.hash === 'string' ? msg.hash : '';
  const stored = `/uploads/${path}${search}${hash}`;
  return isModel3dFileUrl(stored) && getModel3dKind(stored) === 'html' ? stored : null;
}

interface PagePickerStepProps {
  /** The page to start from: a stored `/uploads/...html` path (a query string is kept). */
  startUrl: string;
  /** Called with the stored path of the page the admin is looking at. */
  onConfirm: (storedUrl: string) => void;
  /** Back / cancel button; `backLabel` says which. */
  onBack: () => void;
  backLabel: string;
  disabled?: boolean;
}

/**
 * "Choose a page": frames the chosen site so the admin can click through it, and
 * captures the page they stop on. The framed page reports its own location (the
 * preview route injects the script); the parent cannot read a sandboxed frame.
 */
export const PagePickerStep: React.FC<PagePickerStepProps> = ({ startUrl, onConfirm, onBack, backLabel, disabled }) => {
  const { t, dir } = useAdminT();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [src] = useState(() => toPreviewSrc(startUrl));
  const [current, setCurrent] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const Arrow = dir === 'rtl' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; path?: unknown; search?: unknown; hash?: unknown } | null;
      if (!data || data.type !== 'ajda-capture-nav') return;
      setReported(true);
      setCurrent(toStoredUrl(data));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Until the page reports, keep the file the admin chose as the answer.
  const effective = reported ? current : startUrl;

  return (
    <>
      <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col gap-3">
        <p className="text-[11px] text-neutral-text/60">{t('media.picker.pageHint')}</p>
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-muted-border/50 bg-canvas">
          <span className="text-[10px] font-black text-accent shrink-0">{t('media.picker.pageCurrent')}</span>
          <span dir="ltr" className="text-[11px] font-mono text-heading truncate min-w-0 text-start" title={effective ?? ''}>
            {effective ?? t('media.picker.pageInvalid')}
          </span>
        </div>
        <div className="flex-1 min-h-[320px] rounded-xl overflow-hidden border border-muted-border/40 bg-white">
          <iframe
            ref={frameRef}
            src={src}
            title={t('media.picker.pageTitle')}
            sandbox="allow-scripts allow-popups allow-forms"
            referrerPolicy="no-referrer"
            allow="fullscreen"
            className="w-full h-full border-0"
          />
        </div>
      </div>
      <div className="p-4 bg-surface border-t border-muted-border/20 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="px-4 py-2 rounded-xl bg-surface hover:bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          <Arrow className="w-3.5 h-3.5" />
          {backLabel}
        </button>
        <button
          type="button"
          onClick={() => effective && onConfirm(effective)}
          disabled={!effective || disabled}
          className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {t('media.picker.usePage')}
        </button>
      </div>
    </>
  );
};

interface PagePickerDialogProps {
  startUrl: string;
  onConfirm: (storedUrl: string) => void;
  onClose: () => void;
}

/** The same step as a stand-alone dialog: opened from the capture button next to the entry URL. */
export const PagePickerDialog: React.FC<PagePickerDialogProps> = ({ startUrl, onConfirm, onClose }) => {
  const { t } = useAdminT();
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl h-[85vh] rounded-2xl bg-surface border border-muted-border/40 shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('media.picker.pageTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-muted-border/20 flex items-center justify-between">
          <h3 className="text-sm font-black text-heading">{t('media.picker.pageTitle')}</h3>
          <button
            onClick={onClose}
            aria-label={t('media.action.cancel')}
            className="p-1 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <PagePickerStep
          startUrl={startUrl}
          onConfirm={(u) => {
            onConfirm(u);
            onClose();
          }}
          onBack={onClose}
          backLabel={t('media.action.cancel')}
        />
      </div>
    </div>
  );
};
