import React, { useMemo, useState } from 'react';
import type { Property, UnitStatus } from '../../../types/property';
import { ChartTable, ChartViewToggle } from './chartParts';

/** Fixed series order; colours come from the validated --viz-* tokens in index.css. */
const SERIES: { status: UnitStatus; label: string; color: string }[] = [
  { status: 'available', label: 'متاح', color: 'var(--viz-available)' },
  { status: 'reserved', label: 'محجوز', color: 'var(--viz-reserved)' },
  { status: 'rented', label: 'مؤجر', color: 'var(--viz-rented)' },
  { status: 'sold', label: 'مباع', color: 'var(--viz-sold)' },
];

/** Segments narrower than this (in % of the widest bar) carry no inline number. */
const MIN_LABEL_PERCENT = 7;

interface Row {
  project: Property;
  counts: Record<UnitStatus, number>;
  total: number;
}

/**
 * Units per project, stacked by status. Bars share one scale (the largest
 * project), so both composition and size compare across rows. Identity is
 * never colour-alone: the legend carries labels and totals, wide segments
 * carry their count, every segment has a tooltip, and a table view exists.
 */
export const UnitStatusChart: React.FC<{ projects: Property[]; onOpenProject?: (id: number) => void }> = ({
  projects,
  onOpenProject,
}) => {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<{ project: number; status: UnitStatus } | null>(null);

  const rows = useMemo<Row[]>(() => {
    return projects
      .map((project) => {
        const counts: Record<UnitStatus, number> = { available: 0, reserved: 0, rented: 0, sold: 0 };
        for (const floor of project.floors ?? []) for (const unit of floor.units) counts[unit.status] += 1;
        return { project, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [projects]);

  const totals = useMemo(() => {
    const result: Record<UnitStatus, number> = { available: 0, reserved: 0, rented: 0, sold: 0 };
    for (const row of rows) for (const s of SERIES) result[s.status] += row.counts[s.status];
    return result;
  }, [rows]);

  const scale = Math.max(1, ...rows.map((r) => r.total));

  return (
    <section className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-black text-heading">حالة الوحدات حسب المشروع</h3>
          <p className="text-[11px] text-neutral-text/60 mt-0.5">عدد الوحدات في كل مشروع موزعة حسب الحالة</p>
        </div>
        <ChartViewToggle view={view} onChange={setView} />
      </div>

      {/* Legend: always present for multiple series, with totals as text. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-[11px]">
        {SERIES.map((s) => (
          <li key={s.status} className="inline-flex items-center gap-1.5 text-neutral-text/70">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
            <span className="font-black text-heading tabular-nums">{totals[s.status]}</span>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-xs text-neutral-text/50 py-6 text-center">لا توجد وحدات مسجلة بعد.</p>
      ) : view === 'table' ? (
        <ChartTable
          caption="حالة الوحدات حسب المشروع"
          headers={['المشروع', ...SERIES.map((s) => s.label), 'الإجمالي']}
          rows={rows.map((r) => [r.project.title, ...SERIES.map((s) => r.counts[s.status]), r.total])}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.project.id} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] sm:grid-cols-[minmax(0,12rem)_1fr_2.5rem] items-center gap-3">
              {onOpenProject ? (
                <button
                  type="button"
                  onClick={() => onOpenProject(row.project.id)}
                  className="text-[11px] font-bold text-heading truncate text-start hover:text-accent cursor-pointer"
                  title={row.project.title}
                >
                  {row.project.title}
                </button>
              ) : (
                <span className="text-[11px] font-bold text-heading truncate" title={row.project.title}>
                  {row.project.title}
                </span>
              )}

              <div className="h-5 flex items-stretch" style={{ width: `${(row.total / scale) * 100}%` }}>
                <div className="flex w-full gap-[2px]">
                  {SERIES.filter((s) => row.counts[s.status] > 0).map((s) => {
                    const count = row.counts[s.status];
                    const share = (count / row.total) * 100;
                    const active = hover?.project === row.project.id && hover.status === s.status;
                    const dimmed = hover !== null && !active;
                    const label = `${row.project.title} — ${s.label}: ${count} من ${row.total}`;
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
                        className="relative h-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-accent transition-opacity first:rounded-s-[4px] last:rounded-e-[4px]"
                        style={{ width: `${share}%`, background: s.color, opacity: dimmed ? 0.4 : 1 }}
                      >
                        {(count / scale) * 100 >= MIN_LABEL_PERCENT && (
                          <span className="text-[10px] font-black text-neutral-950 tabular-nums">{count}</span>
                        )}
                        {active && (
                          <div className="absolute bottom-full mb-1.5 z-10 px-2.5 py-1.5 rounded-lg bg-canvas border border-muted-border/50 shadow-lg whitespace-nowrap pointer-events-none">
                            <div className="text-xs font-black text-heading">
                              {count} <span className="font-bold text-neutral-text/60">من {row.total}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-text/65">
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

              <span className="text-[11px] font-black text-heading tabular-nums text-end">{row.total}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
