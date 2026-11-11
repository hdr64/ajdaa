import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export interface FileActionItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  /** Renders as a link (download) instead of a button. */
  href?: string;
  danger?: boolean;
  /** Looks inactive but stays clickable (the click explains why the action is blocked). */
  muted?: boolean;
  title?: string;
  /** Draws a divider above this item (used to set delete apart). */
  separated?: boolean;
}

const ITEM_CLASS = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-start cursor-pointer';

/** Kebab menu for one library file: keeps the card quiet and delete away from the other actions. */
export const FileActionsMenu: React.FC<{ ariaLabel: string; items: FileActionItem[] }> = ({ ariaLabel, items }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // pointerdown, not click: the kebab buttons stop click propagation, which would keep
    // every other open menu from ever seeing the outside click.
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-lg text-neutral-text/70 hover:text-heading hover:bg-muted-surface cursor-pointer"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute end-0 bottom-full mb-1 z-30 w-48 py-1 rounded-xl bg-surface border border-muted-border/40 shadow-xl"
        >
          {items.map((item) => {
            const tone = item.muted
              ? 'text-neutral-text/50 hover:bg-muted-surface'
              : item.danger
                ? 'text-red-500 hover:bg-red-500/10'
                : 'text-heading hover:bg-muted-surface';
            const cls = `${ITEM_CLASS} ${tone}`;
            return (
              <React.Fragment key={item.key}>
                {item.separated && <div className="my-1 border-t border-muted-border/30" />}
                {item.href ? (
                  <a
                    role="menuitem"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    title={item.title}
                    onClick={() => setOpen(false)}
                    className={cls}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    title={item.title}
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className={cls}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
