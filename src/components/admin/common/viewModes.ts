/**
 * View-layout vocabulary shared by the admin switchers. Kept in a plain module
 * (not the .tsx) so `react/only-export-components` stays happy and both
 * `ViewSwitcher.tsx` and pages can import the types without pulling in JSX.
 */

export type ViewMode = 'table' | 'list' | 'grid';

export const VIEW_MODES: readonly ViewMode[] = ['table', 'list', 'grid'];

export const isViewMode = (value: unknown): value is ViewMode =>
  value === 'table' || value === 'list' || value === 'grid';

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  table: 'جدول',
  list: 'قائمة',
  grid: 'شبكة',
};

export type GridColumns = 1 | 2 | 3 | 4 | 5;

export const isGridColumns = (value: unknown): value is GridColumns =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

/** Offered by `GridColumnsSwitcher`; a page that only needs 2/3/4 passes its own list. */
export const GRID_COLUMN_OPTIONS: readonly GridColumns[] = [2, 3, 4];

/**
 * Tailwind only emits classes it can see literally in the source, so the column
 * count is looked up in a static table instead of being interpolated. The ramp
 * keeps phones at one column and only widens from `md`/`lg`/`xl` upwards.
 */
const GRID_COLUMN_CLASSES: Record<GridColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
};

export function gridColumnsClass(n: GridColumns): string {
  return GRID_COLUMN_CLASSES[n];
}
