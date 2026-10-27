import React, { useMemo, useState } from 'react';
import type { Property, UnitStatus } from '../../../types/property';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { ChartTable, ChartViewToggle } from './chartParts';
import { UNIT_STATUS_KEYS } from '../../../pages/admin/projectLabels';
import { ArrowUpDown } from 'lucide-react';

/** Fixed series order; colours come from the validated --viz-* tokens in index.css. */
const STATUS_ORDER: UnitStatus[] = ['available', 'reserved', 'rented', 'sold'];

/** Segments narrower than this (in % of the widest bar) carry no inline number. */
const MIN_LABEL_PERCENT = 7;

interface Row {
  project: Property;
  counts: Record<UnitStatus, number>;
  total: number;
}

type SortMode = 'available' | 'total' | 'occupancy';

export const UnitStatusChart: React.FC<{ projects: Property[]; onOpenProject?: (id: number) => void }> = ({
  projects,
  onOpenProject,
}) => {
  const { t } = useAdminT();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [sortBy, setSortBy] = useState<SortMode>('available');
  const [filterStatus, setFilterStatus] = useState<UnitStatus | null>(null);
  const [hover, setHover] = useState<{ project: number; status: UnitStatus } | null>(null);

  const statusLabel = (status: UnitStatus) => t(UNIT_STATUS_KEYS[status]);

  const rows = useMemo<Row[]>(() => {
    const list = projects
      .map((project) => {
        const counts: Record<UnitStatus, number> = { available: 0, reserved: 0, rented: 0, sold: 0 };
        for (const floor of project.floors ?? []) for (const unit of floor.units) counts[unit.status] += 1;
        return { project, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
      })
      .filter((row) => row.total > 0);

    return list.sort((a, b) => {
      if (sortBy === 'available') {
        const diff = b.counts.available - a.counts.available;
        return diff !== 0 ? diff : b.total - a.total;
      }
      if (sortBy === 'occupancy') {
        const occB = (b.counts.rented + b.counts.sold) / b.total;
        const occA = (a.counts.rented + a.counts.sold) / a.total;
        return occB - occA;
      }
      return b.total - a.total;
    });
  }, [projects, sortBy]);

  const totals = useMemo(() => {
    const result: Record<UnitStatus, number> = { available: 0, reserved: 0, rented: 0, sold: 0 };
    for (const row of rows) for (const s of STATUS_ORDER) result[s] += row.counts[s];
    return result;
  }, [rows]);

  const scale = Math.max(1, ...rows.map((r) => r.total));

  const SERIES = STATUS_ORDER.map((status) => ({
    status,
    label: statusLabel(status),
    color: `var(--viz-${status})`,
  }));

  return (
    <section className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-black text-heading">{t('charts.unitStatus.title')}</h3>
            <p className="text-xs text-neutral-text/75 mt-0.5">{t('charts.unitStatus.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-canvas border border-muted-border/40 rounded-lg p-0.5 text-[11px] font-bold">
              <span className="text-neutral-text/60 px-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
              </span>
              {(['available', 'total', 'occupancy'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortBy(mode)}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                    sortBy === mode ? 'bg-surface text-heading font-black shadow-2xs' : 'text-neutral-text/60 hover:text-heading'
                  }`}
                >
                  {t(`charts.unitStatus.sort.${mode}` as any)}
                </button>
              ))}
            </div>
            <ChartViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {/* Legend: interactive status filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {SERIES.map((s) => {
            const isSelected = filterStatus === s.status;
            return (
              <button
                key={s.status}
                type="button"
                onClick={() => setFilterStatus(isSelected ? null : s.status)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent/10 text-heading ring-1 ring-accent'
                    : filterStatus
                    ? 'border-muted-border/30 opacity-50 bg-canvas text-neutral-text/60'
                    : 'border-muted-border/40 bg-canvas hover:bg-surface-hover text-neutral-text/80'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
                <span>{s.label}</span>
                <span className="font-black text-heading tabular-nums ms-1">{totals[s.status]}</span>
              </button>
            );
          })}
          {filterStatus && (
            <button
              type="button"
              onClick={() => setFilterStatus(null)}
              className="text-[11px] font-bold text-accent hover:underline px-1 cursor-pointer"
            >
              {t('charts.unitStatus.filterAll')}
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-neutral-text/50 py-8 text-center">{t('charts.unitStatus.empty')}</p>
        ) : view === 'table' ? (
          <ChartTable
            caption={t('charts.unitStatus.title')}
            headers={[
              t('common.entity.project'),
              ...SERIES.map((s) => s.label),
              t('charts.unitStatus.total'),
              t('charts.unitStatus.col.availableRate'),
              t('charts.unitStatus.col.occupancyRate'),
            ]}
            rows={rows.map((r) => {
              const availablePct = Math.round((r.counts.available / r.total) * 100);
              const occupancyPct = Math.round(((r.counts.rented + r.counts.sold) / r.total) * 100);
              return [
                r.project.title,
                ...SERIES.map((s) => r.counts[s.status]),
                r.total,
                `${availablePct}%`,
                `${occupancyPct}%`,
              ];
            })}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const barWidthPct = Math.max(12, (row.total / scale) * 100);
              return (
                <div key={row.project.id} className="flex items-center gap-3">
                  <div className="w-36 sm:w-44 shrink-0">
                    {onOpenProject ? (
                      <button
                        type="button"
                        onClick={() => onOpenProject(row.project.id)}
                        className="text-xs font-bold text-heading truncate text-start hover:text-accent cursor-pointer block max-w-full"
                        title={row.project.title}
                      >
                        {row.project.title}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-heading truncate block" title={row.project.title}>
                        {row.project.title}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="h-5 flex items-stretch rounded-md overflow-hidden bg-canvas border border-muted-border/30 shrink-0"
                      style={{ width: `${barWidthPct}%` }}
                    >
                      <div className="flex w-full gap-[1px]">
                        {SERIES.filter((s) => row.counts[s.status] > 0).map((s) => {
                          const count = row.counts[s.status];
                          const share = (count / row.total) * 100;
                          const active = hover?.project === row.project.id && hover.status === s.status;
                          const isHighlighted = filterStatus ? filterStatus === s.status : true;
                          const dimmed = (hover !== null && !active) || !isHighlighted;
                          const label = t('charts.unitStatus.barAria', {
                            project: row.project.title,
                            status: s.label,
                            count,
                            total: row.total,
                          });
                          return (
                            <div
                              key={s.status}
                              tabIndex={0}
                              role="img"
                              aria-label={label}
                              onPointerEnter={() => setHover({ project: row.project.id, status: s.status })}
                              onPointerLeave={() => setHover(null)}
                              onFocus={() => setHover({ project: row.project.id, status: s.status })}
                              onBlur={() => setHover(null)}
                              className="relative h-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-accent transition-opacity first:rounded-s-[3px] last:rounded-e-[3px]"
                              style={{ width: `${share}%`, background: s.color, opacity: dimmed ? 0.35 : 1 }}
                            >
                              {(count / scale) * 100 >= MIN_LABEL_PERCENT && (
                                <span className="text-[10px] font-black text-neutral-950 tabular-nums">{count}</span>
                              )}
                              {active && (
                                <div className="absolute bottom-full mb-1.5 z-10 px-2.5 py-1.5 rounded-lg bg-canvas border border-muted-border/50 shadow-lg whitespace-nowrap pointer-events-none">
                                  <div className="text-xs font-black text-heading">
                                    {t('charts.unitStatus.count', { count, total: row.total })}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-text/80">
                                    <span className="w-3 h-[2px] rounded" style={{ background: s.color }} aria-hidden="true" />
                                    {s.label} · {Math.round(share)}%
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <span className="text-xs font-black text-heading tabular-nums shrink-0">{row.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
