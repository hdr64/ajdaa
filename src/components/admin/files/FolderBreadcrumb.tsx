import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';

export interface FolderCrumb {
  id: string;
  name: string;
}

/**
 * Clickable folder path shared by Drive and the Library:
 * `rootLabel > A > B`, the current crumb is plain text, the others accent links.
 */
export const FolderBreadcrumb: React.FC<{
  rootLabel: string;
  crumbs: FolderCrumb[];
  onOpen: (id: string | null) => void;
}> = ({ rootLabel, crumbs, onOpen }) => {
  const { language } = useAdminT();
  const Forward = language === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => onOpen(null)}
        className={`font-bold cursor-pointer hover:underline ${crumbs.length > 0 ? 'text-accent' : 'text-heading'}`}
      >
        {rootLabel}
      </button>
      {crumbs.map((crumb, i, all) => (
        <React.Fragment key={crumb.id}>
          <Forward className="w-3.5 h-3.5 text-neutral-text/40 shrink-0" />
          <button
            type="button"
            onClick={() => onOpen(crumb.id)}
            className={`font-bold cursor-pointer hover:underline ${i === all.length - 1 ? 'text-heading' : 'text-accent'}`}
          >
            {crumb.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
