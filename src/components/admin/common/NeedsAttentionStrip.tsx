import React, { useMemo, useState } from 'react';
import { AlertCircle, FileEdit, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Property, CustomerInquiry } from '../../../types/property';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { documentLanguage } from '../../../i18n/admin/core';

interface NeedsAttentionStripProps {
  projects: Property[];
  inquiries: CustomerInquiry[];
  canViewInquiries: boolean;
  onNavigateInquiries: () => void;
  onNavigateProjects: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const NeedsAttentionStrip: React.FC<NeedsAttentionStripProps> = ({
  projects,
  inquiries,
  canViewInquiries,
  onNavigateInquiries,
  onNavigateProjects,
}) => {
  const { t } = useAdminT();
  const isRtl = documentLanguage() === 'ar';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const [now] = useState(() => Date.now());
  const untouchedInquiries = useMemo(() => {
    if (!canViewInquiries) return [];
    return inquiries.filter((inq) => inq.status === 'new' && now - new Date(inq.createdAt).getTime() > DAY_MS);
  }, [canViewInquiries, inquiries, now]);

  const draftProjects = projects.filter((p) => p.publishStatus === 'draft');

  const hasIssues = untouchedInquiries.length > 0 || draftProjects.length > 0;

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="flex-1 font-bold">{t('dashboard.overview.attention.allClear')}</span>
      </div>
    );
  }

  return (
    <aside aria-label={t('dashboard.overview.attention.title')} className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 sm:p-4.5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        <h2 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
          {t('dashboard.overview.attention.title')}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {untouchedInquiries.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface/90 border border-amber-500/20 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-heading truncate">
                  {t('dashboard.overview.attention.untouchedInquiries', { count: untouchedInquiries.length })}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateInquiries}
              className="brand-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t('dashboard.overview.attention.review')}</span>
              <Arrow className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {draftProjects.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface/90 border border-amber-500/20 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                <FileEdit className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-heading truncate">
                  {t('dashboard.overview.attention.draftProjects', { count: draftProjects.length })}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateProjects}
              className="brand-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t('dashboard.overview.attention.review')}</span>
              <Arrow className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
