import React, { useMemo, useState } from 'react';
import type { CustomerInquiry } from '../../../types/property';
import { ChartTable, ChartViewToggle } from './chartParts';

const WEEKS = 12;
const DAY_MS = 86_400_000;
const LABEL_LOCALE = 'ar-SA-u-ca-gregory-nu-latn';

/** Start of the week (Sunday, the Saudi working-week start) at local midnight. */
function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

const shortDate = (d: Date) => d.toLocaleDateString(LABEL_LOCALE, { day: 'numeric', month: 'short' });

/** Round the axis maximum up to a readable step. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => Math.ceil(value / s) <= 4) ?? magnitude * 10;
  return Math.ceil(value / step) * step;
}

interface Bucket {
  start: Date;
  count: number;
}

/**
 * Inquiries per week for the last 12 weeks. One series, so no legend box: the
 * title names it. Every bar is focusable and carries its own tooltip; the table
 * view holds the same numbers.
 */
export const InquiriesTrendChart: React.FC<{ inquiries: CustomerInquiry[] }> = ({ inquiries }) => {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);

  const buckets = useMemo<Bucket[]>(() => {
    const current = weekStart(new Date());
    const list: Bucket[] = Array.from({ length: WEEKS }, (_, i) => ({
      start: new Date(current.getTime() - (WEEKS - 1 - i) * 7 * DAY_MS),
      count: 0,
    }));
    const first = list[0].start.getTime();
    for (const inquiry of inquiries) {
      const created = new Date(inquiry.createdAt).getTime();
      if (Number.isNaN(created) || created < first) continue;
      const index = Math.floor((weekStart(new Date(created)).getTime() - first) / (7 * DAY_MS));
      if (index >= 0 && index < WEEKS) list[index].count += 1;
    }
    return list;
  }, [inquiries]);

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const max = niceMax(Math.max(...buckets.map((b) => b.count)));
  const ticks = [max, max / 2, 0];
  const thisWeek = buckets[WEEKS - 1].count;
  const lastWeek = buckets[WEEKS - 2].count;

  return (
    <section className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-black text-heading">طلبات الاهتمام أسبوعياً</h3>
          <p className="text-[11px] text-neutral-text/60 mt-0.5">
            آخر {WEEKS} أسبوعاً · {total} طلب · هذا الأسبوع {thisWeek} (الأسبوع الماضي {lastWeek})
          </p>
        </div>
        <ChartViewToggle view={view} onChange={setView} />
      </div>

      {view === 'table' ? (
        <ChartTable
          caption="طلبات الاهتمام لكل أسبوع"
          headers={['الأسبوع', 'عدد الطلبات']}
          rows={buckets.map((b) => [`من ${shortDate(b.start)}`, b.count])}
        />
      ) : (
        <div className="flex gap-2" dir="ltr">
          {/* Y axis: recessive, three ticks */}
          <div className="flex flex-col justify-between h-44 text-[10px] text-neutral-text/50 text-end w-6 shrink-0 -mt-1.5 pb-5">
            {ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className="relative flex-1 min-w-0">
            {/* Gridlines */}
            <div className="absolute inset-x-0 top-0 h-44 pb-5 flex flex-col justify-between pointer-events-none" aria-hidden="true">
              {ticks.map((t) => (
                <div key={t} className="border-t" style={{ borderColor: 'var(--viz-grid)' }} />
              ))}
            </div>

            {/* Bars, oldest on the left (time reads left to right even in RTL) */}
            <div className="relative h-44 pb-5 flex items-end gap-[2px]" role="list" aria-label="طلبات الاهتمام أسبوعياً">
              {buckets.map((bucket, index) => {
                const height = max > 0 ? (bucket.count / max) * 100 : 0;
                const label = `أسبوع ${shortDate(bucket.start)}: ${bucket.count} طلب`;
                return (
                  <div
                    key={bucket.start.getTime()}
                    role="listitem"
                    tabIndex={0}
                    aria-label={label}
                    onPointerEnter={() => setHover(index)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(index)}
                    onBlur={() => setHover(null)}
                    className="relative flex-1 h-full flex items-end justify-center outline-none group cursor-default"
                  >
                    {/* Hit target is the full column; the mark stays thin. */}
                    <div
                      className="w-full max-w-[28px] rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-accent"
                      style={{
                        height: bucket.count > 0 ? `max(${height}%, 3px)` : '0',
                        background: 'var(--accent)',
                        opacity: hover === null || hover === index ? 1 : 0.45,
                      }}
                    />
                    {/* Every third week, anchored on the current one, so labels never collide on phones. */}
                    {(WEEKS - 1 - index) % 3 === 0 && (
                      <span className="absolute -bottom-0.5 translate-y-full text-[9px] text-neutral-text/50 whitespace-nowrap">
                        {shortDate(bucket.start)}
                      </span>
                    )}
                    {hover === index && (
                      <div
                        className="absolute bottom-full mb-1 z-10 px-2.5 py-1.5 rounded-lg bg-canvas border border-muted-border/50 shadow-lg whitespace-nowrap text-center pointer-events-none"
                        dir="rtl"
                      >
                        <div className="text-xs font-black text-heading">{bucket.count} طلب</div>
                        <div className="text-[10px] text-neutral-text/60">أسبوع يبدأ {shortDate(bucket.start)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
