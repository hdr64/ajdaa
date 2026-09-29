import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ConfirmOptions } from '../../../pages/admin/adminContextDef';

interface ConfirmDialogProps {
  options: ConfirmOptions;
  /** `remember` is the "don't ask again" checkbox, only shown for `options.rememberKey`. */
  onResolve: (confirmed: boolean, remember: boolean) => void;
}

/** Styled replacement for window.confirm, driven by `useAdmin().confirm()`. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ options, onResolve }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    // Default focus on the safe choice.
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onResolve(false, false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResolve]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false, false);
      }}
    >
      <div
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

        {options.rememberKey && (
          <label className="mt-5 flex items-center gap-2 text-xs text-neutral-text/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="w-3.5 h-3.5 cursor-pointer"
            />
            لا تسألني مرة أخرى عن هذا الإجراء
          </label>
        )}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false, false)}
            className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onResolve(true, remember)}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              options.danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'brand-btn-primary'
            }`}
          >
            {options.confirmLabel ?? 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
};
