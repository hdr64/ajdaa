import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ConfirmOptions } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface ConfirmDialogProps {
  options: ConfirmOptions;
  /** `remember` is the "don't ask again" checkbox, only shown for `options.rememberKey`. */
  onResolve: (confirmed: boolean, remember: boolean) => void;
}

/** Buttons, checkboxes and links; the only focusable elements a dialog holds. */
const FOCUSABLE = 'button, input, select, textarea, a[href]';

/** Styled replacement for window.confirm, driven by `useAdmin().confirm()`. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ options, onResolve }) => {
  const { t } = useAdminT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    // Focus moves to the dialog and returns to whatever opened it, so a keyboard
    // user is never dropped at the top of the page on close.
    const restoreTo = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onResolve(false, false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Wrap at both ends: Tab past the last button lands on the first one.
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      restoreTo?.focus();
    };
  }, [onResolve]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false, false);
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              options.danger ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-sm font-black text-heading">
              {options.title}
            </h3>
            {options.message && (
              <p className="text-xs text-neutral-text/65 mt-1.5 leading-relaxed">{options.message}</p>
            )}
          </div>
        </div>

        {options.rememberKey && !options.danger && (
          <label className="mt-5 flex items-center gap-2 text-xs text-neutral-text/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="w-3.5 h-3.5 cursor-pointer"
            />
            {t('common.confirm.remember')}
          </label>
        )}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false, false)}
            className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            {t('common.action.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true, remember)}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              options.danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'brand-btn-primary'
            }`}
          >
            {options.confirmLabel ?? t('common.action.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
