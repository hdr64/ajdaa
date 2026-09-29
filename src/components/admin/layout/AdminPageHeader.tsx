import React from 'react';
import { Menu, RefreshCw } from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  onOpenMenu: () => void;
  /** Receives the DOM node sections portal their primary actions into. */
  actionsSlotRef: (node: HTMLDivElement | null) => void;
}

/**
 * Fixed-height header shared by every admin page. `shrink-0` matters: the header
 * lives in a flex column next to scrolling content and would otherwise be
 * squeezed on long pages.
 */
export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({ title, subtitle, onOpenMenu, actionsSlotRef }) => {
  const { realtimeConnected, refreshAll, projects, inquiries } = useAdmin();
  const refreshing = projects.loading || inquiries.loading;

  return (
    <header className="shrink-0 h-16 sm:h-20 px-4 sm:px-6 bg-surface/85 border-b border-muted-border/30 backdrop-blur-xl flex items-center justify-between gap-3 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMenu}
          className="md:hidden p-2 rounded-xl border border-muted-border/40 text-neutral-text/70 hover:text-heading cursor-pointer shrink-0"
          aria-label="فتح القائمة"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-black text-heading leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[10px] text-neutral-text/60 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border font-bold text-[11px] ${
            realtimeConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
          }`}
          title={realtimeConnected ? 'البيانات حية ومزامنة' : 'في انتظار الاتصال الحي'}
        >
          <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="hidden lg:inline">{realtimeConnected ? 'البيانات حية ومزامنة' : 'في انتظار الاتصال الحي'}</span>
        </div>

        <button
          onClick={() => void refreshAll()}
          disabled={refreshing}
          title="تحديث البيانات"
          aria-label="تحديث البيانات"
          className="p-2.5 rounded-xl border border-muted-border/40 hover:border-accent hover:text-accent bg-surface transition cursor-pointer text-neutral-text/70 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Section-owned primary actions are portalled here. */}
        <div ref={actionsSlotRef} className="flex items-center gap-2" />
      </div>
    </header>
  );
};
