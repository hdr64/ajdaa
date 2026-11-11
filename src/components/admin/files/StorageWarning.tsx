import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import type { DiskStorageStats } from '../../../services/mediaService';

interface StorageWarningProps {
  stats: DiskStorageStats | null;
  /** Optional call to action on the end side (the Library offers its orphaned-files filter). */
  action?: { label: string; onClick: () => void };
}

/** Low free-disk banner shared by the Library and Drive views. Renders nothing while space is fine. */
export const StorageWarning: React.FC<StorageWarningProps> = ({ stats, action }) => {
  const { t } = useAdminT();
  if (!stats?.isLowSpace) return null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-heading flex items-center gap-2">
            <span>{t('media.warning.lowDiskSpace')}</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
              {t('media.stat.freeLeft', { gb: stats.freeGb })}
            </span>
          </h4>
          <p className="text-xs text-neutral-text/80 mt-1">
            {t('media.warning.lowDiskSpaceDesc', {
              freeGb: String(stats.freeGb),
              totalGb: String(stats.totalGb),
            })}
          </p>
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer shadow-xs transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
