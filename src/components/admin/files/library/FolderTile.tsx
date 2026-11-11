import React, { useEffect, useRef, useState } from 'react';
import { Folder, FolderInput, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { MediaFolderDto } from '../../../../services/mediaService';

/**
 * One library folder tile, in the same visual style as the neighbouring Library
 * cards (amber folder icon, same card and row classes). Grid variant is a card;
 * list variant is one row. The menu holds Rename, Move to... and Delete; the
 * actions themselves live in `LibraryView` (it owns the dialogs and toasts).
 */
export const FolderTile: React.FC<{
  folder: MediaFolderDto;
  variant: 'grid' | 'list';
  countLabel: string;
  renameLabel: string;
  moveLabel: string;
  deleteLabel: string;
  onOpen: (folder: MediaFolderDto) => void;
  onRename: (folder: MediaFolderDto) => void;
  onMove: (folder: MediaFolderDto) => void;
  onDelete: (folder: MediaFolderDto) => void;
}> = ({ folder, variant, countLabel, renameLabel, moveLabel, deleteLabel, onOpen, onRename, onMove, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    // pointerdown, not click: the kebab buttons stop click propagation (see FileActionsMenu).
    document.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
    };
  }, [menuOpen]);

  const menu = (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-label={folder.name}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-muted-surface cursor-pointer"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute end-0 top-full mt-1 z-30 w-44 py-1 rounded-xl bg-surface border border-muted-border/40 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onRename(folder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-start text-heading hover:bg-muted-surface cursor-pointer"
          >
            <Pencil className="w-4 h-4 shrink-0" />
            {renameLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onMove(folder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-start text-heading hover:bg-muted-surface cursor-pointer"
          >
            <FolderInput className="w-4 h-4 shrink-0" />
            {moveLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete(folder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-start text-red-500 hover:bg-muted-surface cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );

  if (variant === 'grid') {
    return (
      // Compact chip (Drive style): a folder is a navigation target, not a media card.
      <div className="relative inline-flex items-center gap-1 max-w-64 ps-3 pe-1 py-1.5 rounded-xl bg-surface border border-muted-border/30 hover:border-accent/40 shadow-xs transition">
        <button
          type="button"
          onClick={() => onOpen(folder)}
          className="flex items-center gap-2 min-w-0 text-start cursor-pointer"
          title={`${folder.name} · ${countLabel}`}
        >
          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate text-xs font-bold text-heading" dir="auto">
            {folder.name}
          </span>
          <span className="shrink-0 text-[10px] font-bold text-neutral-text/50">{countLabel}</span>
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-muted-border/20 last:border-b-0 hover:bg-canvas/50 transition">
      <button
        type="button"
        onClick={() => onOpen(folder)}
        className="flex items-center gap-3 min-w-0 flex-1 text-start cursor-pointer"
        title={folder.name}
      >
        <span className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Folder className="w-5 h-5 text-amber-500" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold text-heading line-clamp-2 leading-snug break-words" dir="auto">
            {folder.name}
          </span>
          <span className="block text-[10px] text-neutral-text/50 mt-0.5">{countLabel}</span>
        </span>
      </button>
      {menu}
    </div>
  );
};
