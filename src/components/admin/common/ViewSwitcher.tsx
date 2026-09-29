import React from 'react';
import { LayoutGrid, Rows3, Table2, type LucideIcon } from 'lucide-react';
import {
  GRID_COLUMN_OPTIONS,
  VIEW_MODES,
  VIEW_MODE_LABELS,
  type GridColumns,
  type ViewMode,
} from './viewModes';

const VIEW_MODE_ICONS: Record<ViewMode, LucideIcon> = {
  table: Table2,
  list: Rows3,
  grid: LayoutGrid,
};

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Layouts this page actually implements; defaults to all three. */
  modes?: readonly ViewMode[];
}

/** Segmented icon control that picks how a section lays its data out. */
export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ value, onChange, modes = VIEW_MODES }) => (
  <div className="inline-flex rounded-xl border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label="طريقة العرض">
    {modes.map((mode) => {
      const Icon = VIEW_MODE_ICONS[mode];
      const label = VIEW_MODE_LABELS[mode];
      return (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          aria-label={label}
          title={label}
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            value === mode ? 'brand-fill text-canvas shadow-xs' : 'text-neutral-text/55 hover:text-heading'
          }`}
        >
          <Icon className="w-4 h-4" />
        </button>
      );
    })}
  </div>
);

interface GridColumnsSwitcherProps {
  value: GridColumns;
  onChange: (columns: GridColumns) => void;
  options?: readonly GridColumns[];
}

/** Column-count picker for grid layouts; meaningless on phones, so it hides below `lg`. */
export const GridColumnsSwitcher: React.FC<GridColumnsSwitcherProps> = ({
  value,
  onChange,
  options = GRID_COLUMN_OPTIONS,
}) => (
  <div className="hidden lg:flex items-center gap-2">
    <span className="text-[11px] font-bold text-neutral-text/60">الأعمدة</span>
    <div className="inline-flex rounded-xl border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label="الأعمدة">
      {options.map((option) => {
        const label = `${option} أعمدة`;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            aria-label={label}
            title={label}
            className={`w-8 py-1.5 rounded-lg text-[11px] font-bold tabular-nums cursor-pointer transition ${
              value === option ? 'brand-fill text-canvas shadow-xs' : 'text-neutral-text/55 hover:text-heading'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  </div>
);
