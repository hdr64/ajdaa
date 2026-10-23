import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';

/** Loading / error block scoped to one section, so one failing request never blanks the whole dashboard. */
export const SectionLoading: React.FC<{ label?: string }> = ({ label }) => {
  const { t } = useAdminT();
  return (
    <div className="py-20 text-center space-y-4">
      <div className="w-11 h-11 rounded-full border-2 border-accent/25 border-t-accent animate-spin mx-auto" />
      <p className="text-xs font-bold text-neutral-text/60">{label ?? t('common.state.loading')}</p>
    </div>
  );
};

export const SectionError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => {
  const { t } = useAdminT();
  return (
    <div className="p-10 rounded-2xl bg-surface border border-red-500/30 text-center space-y-4">
      <AlertCircle className="w-9 h-9 text-red-400 mx-auto" />
      <p className="text-sm font-black text-heading">{t('common.state.errorTitle')}</p>
      <p className="text-xs text-neutral-text/60 max-w-lg mx-auto leading-relaxed">{message}</p>
      <button
        onClick={onRetry}
        className="brand-btn-secondary font-bold text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('common.action.retry')}
      </button>
    </div>
  );
};

export const NoAccess: React.FC = () => {
  const { t } = useAdminT();
  return (
    <div className="p-10 rounded-2xl bg-surface border border-muted-border/40 text-center space-y-2">
      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
      <p className="text-sm font-black text-heading">{t('common.state.noAccessTitle')}</p>
      <p className="text-xs text-neutral-text/60">{t('common.state.noAccessHint')}</p>
    </div>
  );
};
