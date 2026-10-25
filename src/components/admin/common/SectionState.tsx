import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';

export interface SectionLoadingProps {
  label?: string;
  variant?: 'table' | 'cards' | 'form' | 'detail';
  rows?: number;
}

/** Responsive Skeleton loader scoped to a section, providing realistic layout placeholders instead of spinners. */
export const SectionLoading: React.FC<SectionLoadingProps> = ({
  label,
  variant = 'table',
  rows = 5,
}) => {
  return (
    <div className="w-full space-y-5 animate-pulse" role="status" aria-label={label ?? 'Loading...'}>
      {/* Top action/toolbar skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="h-10 w-full max-w-xs rounded-xl bg-muted-border/30" />
          <div className="h-9 w-20 rounded-xl bg-muted-border/20 hidden sm:block" />
          <div className="h-9 w-20 rounded-xl bg-muted-border/20 hidden sm:block" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-10 w-28 rounded-xl bg-muted-border/35" />
          <div className="h-10 w-24 rounded-xl bg-muted-border/25" />
        </div>
      </div>

      {variant === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface border border-muted-border/40 p-4 space-y-3.5 shadow-xs"
            >
              <div className="aspect-[16/10] w-full rounded-xl bg-muted-border/30" />
              <div className="space-y-2 pt-1">
                <div className="h-4 w-3/4 rounded-md bg-muted-border/35" />
                <div className="h-3 w-1/2 rounded-md bg-muted-border/20" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-muted-border/20">
                <div className="h-5 w-16 rounded-full bg-muted-border/25" />
                <div className="h-6 w-16 rounded-lg bg-muted-border/20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'table' && (
        <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden">
          {/* Header row */}
          <div className="h-11 bg-canvas/60 border-b border-muted-border/30 px-4 flex items-center gap-4">
            <div className="w-8 h-4 rounded bg-muted-border/30" />
            <div className="w-32 h-4 rounded bg-muted-border/30" />
            <div className="w-24 h-4 rounded bg-muted-border/25 hidden md:block" />
            <div className="w-20 h-4 rounded bg-muted-border/25 hidden sm:block" />
            <div className="w-16 h-4 rounded bg-muted-border/20 ms-auto" />
          </div>
          {/* Body rows */}
          <div className="divide-y divide-muted-border/20">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="h-16 px-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-muted-border/30 shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3.5 w-40 max-w-full rounded-md bg-muted-border/35" />
                  <div className="h-2.5 w-24 rounded-md bg-muted-border/20" />
                </div>
                <div className="w-28 h-3 rounded-md bg-muted-border/25 hidden md:block" />
                <div className="w-20 h-6 rounded-full bg-muted-border/20 hidden sm:block" />
                <div className="flex items-center gap-1.5 ms-auto">
                  <div className="w-8 h-8 rounded-lg bg-muted-border/25" />
                  <div className="w-8 h-8 rounded-lg bg-muted-border/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === 'form' && (
        <div className="rounded-2xl bg-surface border border-muted-border/40 p-6 space-y-6 shadow-xs">
          <div className="h-5 w-48 rounded-lg bg-muted-border/35 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-28 rounded-md bg-muted-border/25" />
                <div className="h-11 w-full rounded-xl bg-canvas border border-muted-border/30" />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-muted-border/20">
            <div className="h-10 w-32 rounded-xl bg-muted-border/40" />
          </div>
        </div>
      )}

      {variant === 'detail' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface border border-muted-border/40 p-6 space-y-4 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-60 rounded-lg bg-muted-border/35" />
                <div className="h-3.5 w-40 rounded-md bg-muted-border/20" />
              </div>
              <div className="h-8 w-24 rounded-full bg-muted-border/25" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-muted-border/20">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-canvas/70 p-2.5 space-y-1.5">
                  <div className="h-2.5 w-16 rounded bg-muted-border/25" />
                  <div className="h-3.5 w-20 rounded bg-muted-border/35" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {label && (
        <div className="flex items-center justify-center gap-2 pt-2 text-[11px] font-bold text-neutral-text/50">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
          <span>{label}</span>
        </div>
      )}
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

/** Compact error shown above data that is still on screen, so a failed refresh never hides the table or its toolbar. */
export const SectionErrorBanner: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => {
  const { t } = useAdminT();
  return (
    <div role="alert" className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/30 text-xs">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-neutral-text/80">{message}</p>
      <button type="button" onClick={onRetry} className="font-bold text-accent hover:underline cursor-pointer">
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
