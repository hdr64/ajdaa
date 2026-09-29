import React from 'react';
import { X } from 'lucide-react';

/** Modal frame shared by the floor and unit forms. */
export function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 my-8">
        <div className="flex items-center justify-between mb-4 border-b border-muted-border/30 pb-3">
          <h4 className="text-sm font-black text-heading">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-surface border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{text}</span>
      {children}
    </label>
  );
}
