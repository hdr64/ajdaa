import React, { useEffect } from 'react';
import { FolderOpen, Image as ImageIcon } from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import type { FilesTab } from '../adminRoutes';
import { DriveView } from '../../../components/admin/files/DriveView';
import { LibraryView } from '../../../components/admin/files/LibraryView';

const TAB_STORAGE_KEY = 'ajda_files_tab';

function readStoredTab(): FilesTab | null {
  try {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    return stored === 'drive' || stored === 'library' ? stored : null;
  } catch {
    return null;
  }
}

function storeTab(tab: FilesTab): void {
  try {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // The tab just won't be remembered.
  }
}

/** One Files page: private Drive and public Library as two tabs, one view mounted at a time. */
export const FilesSection: React.FC = () => {
  const { t } = useAdminT();
  const { location, navigate } = useAdmin();

  // The URL wins; without a tab in it the last used tab, then Drive.
  const tab: FilesTab = location.filesTab ?? readStoredTab() ?? 'drive';

  useEffect(() => {
    storeTab(tab);
  }, [tab]);

  const tabs: { id: FilesTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'drive', label: t('files.tab.drive'), icon: FolderOpen },
    { id: 'library', label: t('files.tab.library'), icon: ImageIcon },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex items-center p-1 bg-surface rounded-xl border border-muted-border/40">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => tab !== id && navigate({ section: 'files', filesTab: id })}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                tab === id ? 'bg-accent/10 text-accent' : 'text-neutral-text/60 hover:text-heading'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-neutral-text/50">
          {tab === 'drive' ? t('files.tab.driveHint') : t('files.tab.libraryHint')}
        </p>
      </div>

      {tab === 'drive' ? <DriveView /> : <LibraryView />}
    </div>
  );
};
