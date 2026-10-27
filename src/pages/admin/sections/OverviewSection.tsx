import React, { useMemo, useState } from 'react';
import { Building2, TrendingUp, Users, Layers, ArrowUpRight, ArrowLeft, ArrowRight, Inbox, Clock } from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { InquiryStatusSelect, WhatsAppLink, PhoneCallLink } from './inquiryUi';
import { formatRelativeTime, formatAdminDateTime } from '../adminFormat';
import { adminLocale, documentLanguage } from '../../../i18n/admin/core';
import { InquiriesTrendChart } from '../../../components/admin/charts/InquiriesTrendChart';
import { UnitStatusChart } from '../../../components/admin/charts/UnitStatusChart';
import { NeedsAttentionStrip } from '../../../components/admin/common/NeedsAttentionStrip';
import { PROJECT_TYPE_KEYS } from '../projectLabels';
import type { AdminKey } from '../../../i18n/admin';

const DAY_MS = 24 * 60 * 60 * 1000;

export const OverviewSection: React.FC = () => {
  const { t } = useAdminT();
  const { projects, inquiries, can, navigate } = useAdmin();
  const canViewInquiries = can('viewInquiries');
  const isRtl = documentLanguage() === 'ar';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const locale = adminLocale(documentLanguage());

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let reserved = 0;
    let rented = 0;
    let sold = 0;
    let area = 0;
    const typeCounts = new Map<string, number>();

    for (const project of projects.data) {
      area += project.area || 0;
      typeCounts.set(project.type, (typeCounts.get(project.type) ?? 0) + 1);
      for (const floor of project.floors ?? []) {
        for (const unit of floor.units) {
          total += 1;
          if (unit.status === 'available') available += 1;
          else if (unit.status === 'reserved') reserved += 1;
          else if (unit.status === 'rented') rented += 1;
          else if (unit.status === 'sold') sold += 1;
        }
      }
    }

    const occupied = rented + sold;
    const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const typeSummary = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${count} ${t(PROJECT_TYPE_KEYS[type as keyof typeof PROJECT_TYPE_KEYS] as AdminKey)}`)
      .slice(0, 3)
      .join(' · ');

    return { total, available, reserved, rented, sold, occupied, area, occupancy, typeSummary };
  }, [projects.data, t]);

  const newInquiries = inquiries.data.filter((i) => i.status === 'new').length;
  const contactedInquiries = inquiries.data.filter((i) => i.status === 'contacted').length;
  const closedInquiries = inquiries.data.length - newInquiries - contactedInquiries;
  const [now] = useState(() => Date.now());

  if (projects.error) return <SectionError message={projects.error} onRetry={() => void projects.reload()} />;
  if (projects.loading && projects.data.length === 0) return <SectionLoading label={t('dashboard.overview.loading')} />;

  const cardClass =
    'p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs hover:border-accent/40 hover:shadow-sm transition-all flex flex-col justify-between cursor-pointer group';

  return (
    <div className="space-y-6">
      {/* 1. Actionable Needs Attention Strip */}
      <NeedsAttentionStrip
        projects={projects.data}
        inquiries={inquiries.data}
        canViewInquiries={canViewInquiries}
        onNavigateInquiries={() => navigate({ section: 'inquiries' })}
        onNavigateProjects={() => navigate({ section: 'projects' })}
      />

      {/* 2. Unified KPI Row */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${canViewInquiries ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {/* Portfolio Card */}
        <div className={cardClass} onClick={() => navigate({ section: 'projects' })}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-text/75 font-bold text-xs">{t('dashboard.overview.stat.portfolio')}</span>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-heading tracking-tight flex items-baseline gap-1.5">
              <span>{projects.data.length}</span>
              <span className="text-xs font-bold text-neutral-text/70">{t('dashboard.overview.stat.projectsUnit')}</span>
            </div>
            <div className="text-xs font-bold text-accent mt-1">
              {stats.area.toLocaleString(locale)} {t('dashboard.overview.stat.areaUnit')}{' '}
              <span className="text-neutral-text/60 text-[11px] font-medium">({t('dashboard.overview.stat.totalArea')})</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-muted-border/20 flex items-center justify-between text-xs text-neutral-text/75">
            <span className="truncate max-w-[150px] font-medium" title={stats.typeSummary}>
              {stats.typeSummary || '—'}
            </span>
            <span className="text-accent font-bold text-[11px] inline-flex items-center gap-0.5 group-hover:underline shrink-0">
              {t('dashboard.overview.stat.viewProjects')}
              <Arrow className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Occupancy Card with multi-status segmented bar */}
        <div className={cardClass} onClick={() => navigate({ section: 'units' })}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-text/75 font-bold text-xs">{t('dashboard.overview.stat.occupancy')}</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-heading tracking-tight flex items-baseline gap-2">
              <span>{stats.occupancy}%</span>
              <span className="text-xs font-bold text-neutral-text/65">
                ({stats.occupied} / {stats.total})
              </span>
            </div>
            {/* Segmented bar: emerald for available, amber for reserved, sky for rented, slate for sold */}
            <div
              className="w-full bg-canvas rounded-full h-2.5 mt-2 overflow-hidden border border-muted-border/30 flex"
              title={t('dashboard.overview.stat.occupancyTooltip')}
            >
              {stats.total > 0 && (
                <>
                  <div style={{ width: `${(stats.available / stats.total) * 100}%`, background: 'var(--viz-available)' }} title={`${stats.available} ${t('common.unitStatus.available')}`} />
                  <div style={{ width: `${(stats.reserved / stats.total) * 100}%`, background: 'var(--viz-reserved)' }} title={`${stats.reserved} ${t('common.unitStatus.reserved')}`} />
                  <div style={{ width: `${(stats.rented / stats.total) * 100}%`, background: 'var(--viz-rented)' }} title={`${stats.rented} ${t('common.unitStatus.rented')}`} />
                  <div style={{ width: `${(stats.sold / stats.total) * 100}%`, background: 'var(--viz-sold)' }} title={`${stats.sold} ${t('common.unitStatus.sold')}`} />
                </>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-muted-border/20 grid grid-cols-4 gap-1 text-[11px] text-center font-bold">
            <span style={{ color: 'var(--viz-available)' }}>{stats.available} {t('common.unitStatus.available')}</span>
            <span style={{ color: 'var(--viz-reserved)' }}>{stats.reserved} {t('common.unitStatus.reserved')}</span>
            <span style={{ color: 'var(--viz-rented)' }}>{stats.rented} {t('common.unitStatus.rented')}</span>
            <span style={{ color: 'var(--viz-sold)' }}>{stats.sold} {t('common.unitStatus.sold')}</span>
          </div>
        </div>

        {/* Inquiries Card */}
        {canViewInquiries && (
          <div className={cardClass} onClick={() => navigate({ section: 'inquiries' })}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-text/75 font-bold text-xs">{t('dashboard.overview.stat.inquiries')}</span>
                <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-heading tracking-tight flex items-baseline gap-1.5">
                <span>{inquiries.data.length}</span>
                <span className="text-xs font-bold text-neutral-text/70">{t('dashboard.overview.stat.inquiriesUnit')}</span>
              </div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                {newInquiries > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                <span>{t('dashboard.overview.inquiries.new', { count: newInquiries })}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-muted-border/20 flex items-center justify-between text-xs text-neutral-text/75">
              <span className="font-medium">
                {t('dashboard.overview.inquiries.tally', { contacted: contactedInquiries, closed: closedInquiries })}
              </span>
              <span className="text-accent font-bold text-[11px] inline-flex items-center gap-0.5 group-hover:underline shrink-0">
                {t('dashboard.overview.stat.viewInquiries')}
                <Arrow className="w-3 h-3" />
              </span>
            </div>
          </div>
        )}

        {/* Units Card */}
        <div className={cardClass} onClick={() => navigate({ section: 'units' })}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-text/75 font-bold text-xs">{t('dashboard.overview.stat.units')}</span>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-heading tracking-tight flex items-baseline gap-1.5">
              <span>{stats.total}</span>
              <span className="text-xs font-bold text-neutral-text/70">{t('dashboard.overview.stat.unitsUnit')}</span>
            </div>
            <div className="text-xs font-bold text-neutral-text/80 mt-1">
              {t('dashboard.overview.stat.availableSubtitle', { count: stats.available })}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-muted-border/20 flex items-center justify-between text-xs text-neutral-text/75">
            <span className="font-medium">
              {t('dashboard.overview.units.acrossFloors', {
                count: projects.data.reduce((sum, p) => sum + (p.floors?.length ?? 0), 0),
              })}
            </span>
            <span className="text-accent font-bold text-[11px] inline-flex items-center gap-0.5 group-hover:underline shrink-0">
              {t('dashboard.overview.stat.viewUnits')}
              <Arrow className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 3. Action before Analysis: Side-by-Side Unit Status & Actionable Inquiries */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Unit Status Breakdown (7 columns on xl) */}
        <div className={canViewInquiries ? 'xl:col-span-7' : 'xl:col-span-12'}>
          <UnitStatusChart
            projects={projects.data}
            onOpenProject={(projectId) => navigate({ section: 'project', projectId })}
          />
        </div>

        {/* Latest Inquiries Action Panel (5 columns on xl) */}
        {canViewInquiries && (
          <div className="xl:col-span-5 rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-muted-border/30">
                <div>
                  <h3 className="text-sm font-black text-heading">{t('dashboard.overview.latest.title')}</h3>
                  <p className="text-xs text-neutral-text/75 mt-0.5">{t('dashboard.overview.latest.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ section: 'inquiries' })}
                  className="brand-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <span>{t('dashboard.overview.latest.viewAll', { count: inquiries.data.length })}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {inquiries.error ? (
                <SectionError message={inquiries.error} onRetry={() => void inquiries.reload()} />
              ) : inquiries.data.length === 0 ? (
                <EmptyState
                  compact
                  icon={Inbox}
                  title={inquiries.loading ? t('dashboard.overview.latest.loading') : t('dashboard.overview.latest.empty')}
                  description={inquiries.loading ? undefined : t('dashboard.overview.latest.emptyHint')}
                />
              ) : (
                <div className="divide-y divide-muted-border/15">
                  {inquiries.data.slice(0, 5).map((inq) => {
                    const isNewAndOld = inq.status === 'new' && now - new Date(inq.createdAt).getTime() > DAY_MS;
                    return (
                      <div key={inq.id} className="py-3 flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent font-black text-xs flex items-center justify-center shrink-0">
                              {inq.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-heading text-xs truncate">{inq.name}</span>
                                {isNewAndOld && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-500/30">
                                    {t('dashboard.overview.inquiries.unhandledBadge')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-text/65 font-mono truncate" dir="ltr">
                                {inq.phone || inq.email || '—'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <PhoneCallLink phone={inq.phone} />
                            <WhatsAppLink phone={inq.phone} />
                            <InquiryStatusSelect inquiry={inq} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-neutral-text/75 bg-canvas/60 px-2.5 py-1.5 rounded-lg border border-muted-border/25">
                          <div className="truncate max-w-[200px] font-bold text-heading">
                            {inq.projectTitle ? (
                              <button
                                type="button"
                                onClick={() => inq.projectId && navigate({ section: 'project', projectId: inq.projectId })}
                                className="hover:text-accent hover:underline cursor-pointer truncate text-start"
                              >
                                {inq.projectTitle}
                              </button>
                            ) : (
                              <span>{t('dashboard.overview.latest.general')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-text/65 shrink-0" title={formatAdminDateTime(inq.createdAt)}>
                            <Clock className="w-3 h-3 text-neutral-text/50" />
                            <span>{formatRelativeTime(inq.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Weekly Trend Analytics */}
      {canViewInquiries && (
        <InquiriesTrendChart inquiries={inquiries.data} />
      )}
    </div>
  );
};
