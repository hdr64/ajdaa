import React from 'react';
import { BarChart3, Table2 } from 'lucide-react';

/** Chart / table switch: the table is the accessible and exact-number view of every chart. */
export const ChartViewToggle: React.FC<{ view: 'chart' | 'table'; onChange: (view: 'chart' | 'table') => void }> = ({
  view,
  onChange,
}) => (
  <div className="inline-flex rounded-lg border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label="طريقة العرض">
    {(
      [
        ['chart', 'رسم', BarChart3],
        ['table', 'جدول', Table2],
      ] as const
    ).map(([key, label, Icon]) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        aria-pressed={view === key}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
          view === key ? 'bg-surface text-heading shadow-xs' : 'text-neutral-text/55 hover:text-heading'
        }`}
      >
        <Icon className="w-3 h-3" />
        {label}
      </button>
    ))}
  </div>
);

export const ChartTable: React.FC<{
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}> = ({ caption, headers, rows }) => (
  <div className="max-h-72 overflow-auto rounded-xl border border-muted-border/30">
    <table className="w-full text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-surface">
        <tr className="text-neutral-text/55 text-[11px]">
          {headers.map((header, i) => (
            <th key={header} className={`px-3 py-2 font-bold ${i === 0 ? 'text-start' : 'text-end'}`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-muted-border/15">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={`px-3 py-1.5 ${i === 0 ? 'text-start text-heading font-bold' : 'text-end tabular-nums text-neutral-text/80'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
